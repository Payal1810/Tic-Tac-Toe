import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { userService, gameService } from "./lib/db.mjs";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory state per room: gameId, board, nextTurn, boardSize, players (active with symbols)
const roomState = new Map<
  string,
  {
    gameId: number;
    board: Array<"X" | "O" | null>;
    nextTurn: "X" | "O";
    boardSize: number;
    players: Array<{ id: number; username: string; symbol: "X" | "O" }>;
  }
>();

app.prepare().then(() => {
  const httpServer = createServer(handle);
  const io = new Server(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === "production" ? "https://your-domain.com" : "*",
      methods: ["GET", "POST"],
    },
  });

  type PlayerInRoom = { id: number; username: string; symbol: "X" | "O" };

  io.on("connection", (socket) => {
    console.log(`[Server] User connected: ${socket.id}`);

    // Handle socket authentication with existing user data
    socket.on("authenticate-user", ({ user }) => {
      socket.data.user = user;
      console.log(`[Server] authenticate-user for`, {
        socketId: socket.id,
        user: { id: user?.id, username: user?.username },
      });
      // Acknowledge authentication so clients can safely proceed
      socket.emit("auth-ok", {
        user: { id: user?.id, username: user?.username },
      });
    });

    // Handle user registration
    socket.on("register", async (data) => {
      try {
        const user = await userService.register(
          data.username,
          data.email,
          data.password
        );
        socket.emit("register_result", { success: true, user });
        console.log(`New user registered: ${data.username}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Registration failed";
        console.error("Registration error:", errorMessage);
        socket.emit("register_result", {
          success: false,
          error: errorMessage,
        });
      }
    });

    // Handle user login
    socket.on("login", async (data) => {
      try {
        const result = await userService.login(data.username, data.password);
        socket.data.user = result.user;
        socket.emit("login_result", { success: true, user: result.user });
        console.log(`User logged in: ${data.username}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Login failed";
        console.error("Login error:", errorMessage);
        socket.emit("login_result", { success: false, error: errorMessage });
      }
    });

    // Helper: ensure authenticated user present on socket
    const requireAuth = () => {
      if (!socket.data.user) {
        socket.emit("roomError", {
          code: "AUTH_REQUIRED",
          message: "Please login first",
        });
        return false;
      }
      return true;
    };

    // Simple server-side validators
    const normalizeCode = (raw?: string): string | null => {
      if (!raw || typeof raw !== "string") return null;
      const trimmed = raw.trim();
      if (trimmed.length < 1 || trimmed.length > 20) return null;
      if (!/^[a-zA-Z0-9]+$/.test(trimmed)) return null;
      return trimmed;
    };

    const validateMessageContent = (content?: string): string | null => {
      if (typeof content !== "string") return null;
      const trimmed = content.trim();
      if (trimmed.length === 0 || trimmed.length > 500) return null;
      return trimmed;
    };

    // Utility: generic winner computation for NxN
    const buildWinLines = (size: number): number[][] => {
      const lines: number[][] = [];
      for (let r = 0; r < size; r++) {
        lines.push(Array.from({ length: size }, (_, c) => r * size + c));
      }
      for (let c = 0; c < size; c++) {
        lines.push(Array.from({ length: size }, (_, r) => r * size + c));
      }
      lines.push(Array.from({ length: size }, (_, i) => i * (size + 1)));
      lines.push(Array.from({ length: size }, (_, i) => (i + 1) * (size - 1)));
      return lines;
    };

    // Utility: check winner (generic NxN)
    const computeWinner = (
      board: Array<"X" | "O" | null>,
      size: number
    ): "X" | "O" | null => {
      const lines = buildWinLines(size);
      for (const line of lines) {
        const first = board[line[0]];
        if (!first) continue;
        if (line.every((idx) => board[idx] === first)) return first;
      }
      return null;
    };

    // Helper: get active users (by sockets) currently joined to a room
    const getActiveUsersInRoom = (
      code: string
    ): Array<{ id: number; username: string }> => {
      const room = io.sockets.adapter.rooms.get(code);
      if (!room) return [];
      const results: Array<{ id: number; username: string }> = [];
      for (const socketId of room) {
        const s = io.sockets.sockets.get(socketId);
        const u = s?.data?.user as { id: number; username: string } | undefined;
        if (u && !results.some((p) => p.id === u.id)) {
          results.push({ id: u.id, username: u.username });
        }
      }
      return results;
    };

    const deriveActivePlayersWithSymbols = (
      code: string
    ): Array<{ id: number; username: string; symbol: "X" | "O" }> => {
      const actives = getActiveUsersInRoom(code);
      const players: Array<{
        id: number;
        username: string;
        symbol: "X" | "O";
      }> = [];
      if (actives[0]) players.push({ ...actives[0], symbol: "X" });
      if (actives[1]) players.push({ ...actives[1], symbol: "O" });
      return players;
    };

    // Shared join logic so both joinRoom and legacy join-room use the same path
    const handleJoinRoom = async (rawCode: string) => {
      console.log("[Server] handleJoinRoom called", {
        socketId: socket.id,
        rawCode,
        authedUser: socket.data.user?.username,
      });
      if (!requireAuth()) return;
      const code = normalizeCode(rawCode);
      if (!code) {
        socket.emit("roomError", {
          code: "BAD_CODE",
          message: "Invalid room code",
        });
        console.warn("[Server] BAD_CODE emitted", {
          socketId: socket.id,
          rawCode,
        });
        return;
      }
      const currentUser = socket.data.user;
      try {
        console.log("[Server] findOrCreateRoom", {
          code,
          userId: currentUser.id,
        });
        const room = await gameService.findOrCreateRoom(code, currentUser.id);
        const players = await gameService.getRoomPlayersByRoomId(room.id);
        console.log("[Server] current players", players);
        // Enforce capacity for new entrants using live socket room size (ignores historical DB rows)
        const roomSize = io.sockets.adapter.rooms.get(code)?.size ?? 0;
        console.log("[Server] live room size", { code, roomSize });
        if (
          !players.some((p: PlayerInRoom) => p.id === currentUser.id) &&
          roomSize >= 2
        ) {
          socket.emit("roomError", {
            code: "ROOM_FULL",
            message: "Room is full",
          });
          console.warn("[Server] ROOM_FULL emitted", {
            code,
            socketId: socket.id,
          });
          return;
        }
        // Assign symbol if user not yet in room
        if (!players.some((p: PlayerInRoom) => p.id === currentUser.id)) {
          const symbol: "X" | "O" =
            players.length === 0 ? "X" : players[0].symbol === "X" ? "O" : "X";
          const opponent = players[0]?.id;
          console.log("[Server] addPlayerToRoom", {
            roomId: room.id,
            userId: currentUser.id,
            symbol,
            opponent,
          });
          await gameService.addPlayerToRoom(
            room.id,
            currentUser.id,
            symbol,
            opponent
          );
        }

        socket.join(room.code);
        console.log("[Server] socket.join", {
          code: room.code,
          socketId: socket.id,
        });
        const updatedPlayers = await gameService.getRoomPlayersByRoomId(
          room.id
        );
        const you = updatedPlayers.find(
          (p: PlayerInRoom) => p.id === currentUser.id
        );

        // Send chat history to the joiner
        const chatHistory = await gameService.getChatHistory(room.code);
        socket.emit("chat_history", chatHistory);
        console.log("[Server] emitted chat_history to joiner", {
          count: Array.isArray(chatHistory) ? chatHistory.length : 0,
        });

        // Notify joiner and others
        socket.emit("roomJoined", {
          room: { id: room.id, code: room.code, status: room.status },
          players: updatedPlayers,
          you,
        });
        console.log("[Server] emitted roomJoined to joiner", {
          code: room.code,
          playersCount: updatedPlayers.length,
          you,
        });
        socket.to(room.code).emit("userJoined", { player: you });
        console.log("[Server] emitted userJoined to room", { code: room.code });

        // If a game is already in progress for this room, sync the joiner
        const current = roomState.get(code);
        if (current) {
          socket.emit("gameUpdate", {
            board: current.board,
            nextTurn: current.nextTurn,
          });
        }

        // Auto-start a new game when the second active socket joins and no game is active
        const liveSizeAfterJoin = io.sockets.adapter.rooms.get(code)?.size ?? 0;
        console.log("[Server] live room size after join", {
          code,
          liveSizeAfterJoin,
        });
        if (!current && liveSizeAfterJoin === 2) {
          try {
            // Notify both clients the room is ready so UIs can redirect
            io.to(code).emit("roomReady", {
              room: { id: room.id, code: room.code },
              players: updatedPlayers,
            });
            console.log("[Server] emitted roomReady to room", { code });

            const game = await gameService.createGame(room.id);
            const boardSize = 3;
            const board: Array<"X" | "O" | null> = Array(
              boardSize * boardSize
            ).fill(null);
            const nextTurn: "X" | "O" = "X";
            const activePlayers = deriveActivePlayersWithSymbols(code);
            roomState.set(code, {
              gameId: game.id,
              board,
              nextTurn,
              boardSize,
              players: activePlayers,
            });
            io.to(code).emit("gameStarted", {
              game: {
                id: game.id,
                roomId: room.id,
                started_at: game.started_at,
              },
              board,
              nextTurn,
              players: activePlayers,
              boardSize,
            });
          } catch (e) {
            console.error("Auto start game failed:", e);
          }
        }

        console.log(`User ${currentUser.username} joined room ${room.code}`);
      } catch (error) {
        console.error("Error joining room:", error);
        socket.emit("roomError", {
          code: "JOIN_FAILED",
          message: "Failed to join room",
        });
      }
    };

    // Create room
    socket.on("createRoom", async ({ code }) => {
      if (!requireAuth()) return;
      const currentUser = socket.data.user;
      try {
        const normalized = normalizeCode(code) || socket.id.slice(0, 6);
        const room = await gameService.findOrCreateRoom(
          normalized,
          currentUser.id
        );
        const players = await gameService.getRoomPlayersByRoomId(room.id);
        // Assign symbol if not already in room
        const alreadyInRoom = players.some(
          (p: PlayerInRoom) => p.id === currentUser.id
        );
        if (!alreadyInRoom) {
          const symbol: "X" | "O" =
            players.length === 0
              ? "X"
              : players.length === 1
              ? players[0].symbol === "X"
                ? "O"
                : "X"
              : "X";
          await gameService.addPlayerToRoom(room.id, currentUser.id, symbol);
        }

        socket.join(room.code);
        const updatedPlayers = await gameService.getRoomPlayersByRoomId(
          room.id
        );
        const you = updatedPlayers.find(
          (p: PlayerInRoom) => p.id === currentUser.id
        );
        socket.emit("roomCreated", {
          room: { id: room.id, code: room.code, status: room.status },
          player: you,
        });
      } catch (error) {
        console.error("Error creating room:", error);
        socket.emit("roomError", {
          code: "CREATE_FAILED",
          message: "Failed to create room",
        });
      }
    });

    // Join room (new contract)
    socket.on("joinRoom", async ({ code }) => {
      await handleJoinRoom(code);
    });

    // Backward compatibility: join-room -> joinRoom
    socket.on("join-room", async (data) => {
      const currentUser = socket.data.user || data.user;
      if (!currentUser) {
        socket.emit("roomError", {
          code: "AUTH_REQUIRED",
          message: "Please login first",
        });
        return;
      }
      socket.data.user = currentUser;
      await handleJoinRoom(data.room);
    });

    // Leave room
    socket.on("leaveRoom", async ({ code }) => {
      if (!requireAuth()) return;
      const normalized = normalizeCode(code);
      if (!normalized) {
        socket.emit("roomError", {
          code: "BAD_CODE",
          message: "Invalid room code",
        });
        return;
      }
      const currentUser = socket.data.user;
      try {
        const room = await gameService.getRoomByCode(normalized);
        if (!room) {
          socket.emit("roomError", {
            code: "ROOM_NOT_FOUND",
            message: "Room not found",
          });
          return;
        }
        await gameService.removePlayerFromRoom(room.id);
        socket.leave(normalized);
        socket.to(normalized).emit("userLeft", { userId: currentUser.id });
      } catch (error) {
        console.error("Error leaving room:", error);
        socket.emit("roomError", {
          code: "LEAVE_FAILED",
          message: "Failed to leave room",
        });
      }
    });

    // Chat: new event names
    socket.on("sendMessage", async ({ code, content }) => {
      if (!requireAuth()) return;
      const normalized = normalizeCode(code);
      const message = validateMessageContent(content);
      if (!normalized) {
        socket.emit("message_error", { error: "Invalid room code" });
        return;
      }
      if (!message) {
        socket.emit("message_error", { error: "Invalid message" });
        return;
      }
      try {
        const saved = await gameService.saveChatMessage(
          normalized,
          socket.data.user.id,
          message
        );
        io.to(normalized).emit("receiveMessage", {
          sender: {
            id: socket.data.user.id,
            username: socket.data.user.username,
          },
          content: message,
          created_at: saved.created_at || new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error handling sendMessage:", error);
        socket.emit("message_error", { error: "Failed to send message" });
      }
    });

    // Helper function to create/restart a game (reduces duplication)
    const initializeGame = async (
      code: string,
      room: { id: number; code: string },
      size?: number
    ) => {
      const players = await gameService.getRoomPlayersByRoomId(room.id);
      if (players.length < 2) {
        socket.emit("roomError", {
          code: "NEED_TWO",
          message: "Need two players to start",
        });
        return false;
      }
      const game = await gameService.createGame(room.id);
      const boardSize =
        typeof size === "number" && size >= 3 && size <= 6 ? size : 3;
      const board: Array<"X" | "O" | null> = Array(boardSize * boardSize).fill(
        null
      );
      const nextTurn: "X" | "O" = "X";
      const activePlayers = deriveActivePlayersWithSymbols(code);
      roomState.set(code, {
        gameId: game.id,
        board,
        nextTurn,
        boardSize,
        players: activePlayers,
      });
      return { game, board, nextTurn, activePlayers, boardSize };
    };

    // ---------------- Game flow events ----------------
    socket.on(
      "startGame",
      async ({ code, size }: { code: string; size?: number }) => {
        if (!requireAuth()) return;
        const normalized = normalizeCode(code);
        if (!normalized) {
          socket.emit("roomError", {
            code: "BAD_CODE",
            message: "Invalid room code",
          });
          return;
        }
        try {
          const room = await gameService.getRoomByCode(normalized);
          if (!room) {
            socket.emit("roomError", {
              code: "ROOM_NOT_FOUND",
              message: "Room not found",
            });
            return;
          }
          const result = await initializeGame(normalized, room, size);
          if (!result) return;

          io.to(normalized).emit("gameStarted", {
            game: {
              id: result.game.id,
              roomId: room.id,
              started_at: result.game.started_at,
            },
            board: result.board,
            nextTurn: result.nextTurn,
            players: result.activePlayers,
            boardSize: result.boardSize,
          });
        } catch (error) {
          console.error("Error starting game:", error);
          socket.emit("roomError", {
            code: "START_FAILED",
            message: "Failed to start game",
          });
        }
      }
    );

    socket.on(
      "playerMove",
      async ({ code, position }: { code: string; position: number }) => {
        if (!requireAuth()) return;
        const normalized = normalizeCode(code);
        if (
          !normalized ||
          typeof position !== "number" ||
          position < 0 ||
          position > 8
        ) {
          socket.emit("invalidMove", { reason: "BAD_POSITION" });
          return;
        }
        const state = roomState.get(normalized);
        if (!state) {
          socket.emit("invalidMove", { reason: "NOT_IN_PROGRESS" });
          return;
        }
        const sizeToUse = state.boardSize || 3;
        if (position < 0 || position >= sizeToUse * sizeToUse) {
          socket.emit("invalidMove", { reason: "BAD_POSITION" });
          return;
        }
        const currentUser = socket.data.user as {
          id: number;
          username: string;
        };
        try {
          const room = await gameService.getRoomByCode(normalized);
          if (!room) {
            socket.emit("invalidMove", { reason: "NOT_IN_PROGRESS" });
            return;
          }
          const statePlayers = roomState.get(normalized)?.players;
          // Fallback to DB if state not initialized yet
          const players =
            statePlayers || (await gameService.getRoomPlayersByRoomId(room.id));
          const me = players.find(
            (p: { id: number; username: string; symbol: "X" | "O" }) =>
              p.id === currentUser.id
          );
          if (!me) {
            socket.emit("invalidMove", { reason: "NOT_IN_PROGRESS" });
            return;
          }
          // Turn validation
          if (me.symbol !== state.nextTurn) {
            socket.emit("invalidMove", { reason: "OUT_OF_TURN" });
            return;
          }
          if (state.board[position] !== null) {
            socket.emit("invalidMove", { reason: "CELL_FILLED" });
            return;
          }
          // Apply move
          state.board[position] = me.symbol;
          await gameService.appendMove(state.gameId, currentUser.id, position);
          io.to(normalized).emit("gameUpdate", {
            board: state.board,
            nextTurn: state.nextTurn === "X" ? "O" : "X",
          });
          // Check game end
          const winner = computeWinner(state.board, sizeToUse);
          const isDraw = !winner && state.board.every((cell) => cell !== null);
          if (winner || isDraw) {
            const winnerPlayer = winner
              ? players.find((p) => p.symbol === winner)
              : undefined;
            await gameService.finalizeGame(
              state.gameId,
              winner ? "COMPLETED" : "DRAW",
              winnerPlayer?.id ?? null
            );
            io.to(normalized).emit("gameOver", {
              result: winner ? "COMPLETED" : "DRAW",
              winner: winnerPlayer
                ? {
                    id: winnerPlayer.id,
                    username: winnerPlayer.username,
                    symbol: winner as "X" | "O",
                  }
                : undefined,
            });
            // keep room open; clear in-memory so playAgain can start fresh
            roomState.delete(normalized);
          } else {
            // rotate turn
            state.nextTurn = state.nextTurn === "X" ? "O" : "X";
          }
        } catch (error) {
          console.error("Error handling move:", error);
          socket.emit("invalidMove", { reason: "NOT_IN_PROGRESS" });
        }
      }
    );

    socket.on(
      "playAgain",
      async ({ code, size }: { code: string; size?: number }) => {
        if (!requireAuth()) return;
        const normalized = normalizeCode(code);
        if (!normalized) {
          socket.emit("roomError", {
            code: "BAD_CODE",
            message: "Invalid room code",
          });
          return;
        }
        try {
          const room = await gameService.getRoomByCode(normalized);
          if (!room) {
            socket.emit("roomError", {
              code: "ROOM_NOT_FOUND",
              message: "Room not found",
            });
            return;
          }
          const result = await initializeGame(normalized, room, size);
          if (!result) return;

          io.to(normalized).emit("gameRestarted", {
            game: { id: result.game.id, roomId: room.id },
            board: result.board,
            nextTurn: result.nextTurn,
            boardSize: result.boardSize,
          });
        } catch (error) {
          console.error("Error restarting game:", error);
          socket.emit("roomError", {
            code: "RESTART_FAILED",
            message: "Failed to restart game",
          });
        }
      }
    );

    // Backward compatibility: message -> sendMessage
    socket.on("message", async (data) => {
      const currentUser = socket.data.user;
      console.log("[Server] Legacy message event received:", {
        roomId: data.roomId,
        message: data.message,
        sender: currentUser?.username,
        socketId: socket.id,
      });

      if (!currentUser) {
        socket.emit("message_error", { error: "Please login first" });
        return;
      }

      // Check if socket is in the room
      const rooms = Array.from(socket.rooms);
      console.log("[Server] Socket is in rooms:", rooms);
      console.log("[Server] Trying to emit to room:", data.roomId);

      try {
        await gameService.saveChatMessage(
          data.roomId,
          currentUser.id,
          data.message
        );
        console.log("[Server] Message saved to DB");

        // Get all sockets in this room
        const socketsInRoom = await io.in(data.roomId).fetchSockets();
        console.log(
          "[Server] Sockets in room:",
          socketsInRoom.length,
          "sockets"
        );

        const messageData = {
          sender: currentUser.username,
          message: data.message,
          timestamp: new Date().toISOString(),
        };

        // Emit to the entire room
        io.in(data.roomId).emit("message", messageData);
        console.log(
          "[Server] Message emitted to room via io.in():",
          data.roomId
        );

        // Also emit directly to sender to ensure they get it
        socket.emit("message", messageData);
        console.log("[Server] Message also emitted directly to sender");
      } catch (error) {
        console.error("[Server] Error handling legacy message:", error);
        socket.emit("message_error", { error: "Failed to send message" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("Shutting down gracefully...");
    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        console.log("HTTP server closed");
        resolve();
      });
    });
    process.exit(0);
  });

  httpServer.listen(port, () => {
    console.log(`Server running on http://${hostname}:${port}`);
  });
});