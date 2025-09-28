import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { userService, gameService } from "./lib/db.mjs";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handle);
  const io = new Server(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === "production" ? "https://your-domain.com" : "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle socket authentication with existing user data
    socket.on("authenticate-user", ({ user }) => {
      socket.data.user = user;
      console.log(`:white_check_mark: Socket authenticated for user: ${user.username}`);
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
        console.log(`:white_check_mark: New user registered: ${data.username}`);
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
        console.log(`:white_check_mark: User logged in: ${data.username}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Login failed";
        console.error("Login error:", errorMessage);
        socket.emit("login_result", { success: false, error: errorMessage });
      }
    });

    // Handle joining room
    socket.on("join-room", async (data) => {
      // Use user from event data if socket.data.user is not set
      const currentUser = socket.data.user || data.user;

      if (!currentUser) {
        socket.emit("room_error", { error: "Please login first" });
        return;
      }

      // Set user in socket data for future use
      socket.data.user = currentUser;

      try {
        socket.join(data.room);

        // Get or create room in database using authenticated user
        await gameService.findOrCreateRoom(data.room, currentUser.id);

        // Get chat history and send to user
        const chatHistory = await gameService.getChatHistory(data.room);
        socket.emit("chat_history", chatHistory);

        // Notify others in room
        socket
          .to(data.room)
          .emit("user_joined", `${currentUser.username} joined room`);

        console.log(`User ${currentUser.username} joined room ${data.room}`);
      } catch (error) {
        console.error("Error joining room:", error);
        socket.emit("room_error", { error: "Failed to join room" });
      }
    });

    // Handle chat messages
    socket.on("message", async (data) => {
      if (!socket.data.user) {
        socket.emit("message_error", { error: "Please login first" });
        return;
      }

      try {
        // Save message to database using authenticated user
        await gameService.saveChatMessage(
          data.roomId,
          socket.data.user.id,
          data.message
        );

        // Broadcast to room (including sender)
        io.to(data.roomId).emit("message", {
          sender: socket.data.user.username,
          message: data.message,
          timestamp: new Date().toISOString(),
        });

        console.log(
          `Message saved: ${socket.data.user.username} in room ${data.roomId}`
        );
      } catch (error) {
        console.error("Error handling message:", error);
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