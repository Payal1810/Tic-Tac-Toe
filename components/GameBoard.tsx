"use client";

import React, { useState, useEffect, useCallback } from "react";
import { socket } from "@/lib/socketClient";

type Player = "X" | "O" | null;
type Board = Player[];

interface GameBoardProps {
  roomId: string;
  currentUser: string;
}

// Helper to get user data once
const getUserData = () => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function GameBoard({ roomId, currentUser }: GameBoardProps) {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [nextTurn, setNextTurn] = useState<"X" | "O">("X");
  const [isGameOver, setIsGameOver] = useState(false);
  const [winnerSymbol, setWinnerSymbol] = useState<"X" | "O" | null>(null);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [isGameActive, setIsGameActive] = useState(false);
  const [mySymbol, setMySymbol] = useState<"X" | "O" | null>(null);
  const [playersCount, setPlayersCount] = useState(0);
  const [isWaitingForPlayer, setIsWaitingForPlayer] = useState(true);
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);

  // Note: currentUser will be used for multiplayer features in the future
  console.log("Game room:", roomId, "user:", currentUser);

  // Subscribe to server events - DO NOT join/authenticate here, parent already did
  useEffect(() => {
    const userData = getUserData();
    if (!userData) return;

    // Handle when room is joined - track player count
    const handleRoomJoined = (payload: {
      room: { id: number; code: string; status: string };
      players: Array<{ id: number; username: string; symbol: string }>;
      you: { id: number; username: string; symbol: string };
    }) => {
      console.log("[GameBoard] roomJoined", payload);
      setPlayersCount(payload.players.length);
      setIsWaitingForPlayer(payload.players.length < 2);
      setMySymbol(payload.you.symbol as "X" | "O");
    };

    // Handle when 2 players are ready
    const handleRoomReady = (payload: {
      room: { id: number; code: string };
      players: Array<{ id: number; username: string; symbol: string }>;
    }) => {
      console.log("[GameBoard] roomReady - 2 players present!", payload);
      setPlayersCount(payload.players.length);
      setIsWaitingForPlayer(false);
    };

    // Handle when another user joins
    const handleUserJoined = (payload: {
      player: { id: number; username: string; symbol: string };
    }) => {
      console.log("[GameBoard] userJoined", payload);
      setPlayersCount((prev) => prev + 1);
    };

    const handleStarted = (payload: {
      game: { id: number; roomId: number; started_at: string };
      board: Board;
      nextTurn: "X" | "O";
      players: Array<{ id: number; username: string; symbol: "X" | "O" }>;
    }) => {
      console.log("[GameBoard] gameStarted", payload);
      setBoard(payload.board);
      setNextTurn(payload.nextTurn);
      setIsGameOver(false);
      setWinnerSymbol(null);
      setWinnerName(null);
      setIsDraw(false);
      setIsGameActive(true);
      setIsWaitingForPlayer(false);
      setPlayersCount(payload.players.length);

      // Find player's symbol using userData from closure
      const mine = payload.players.find((p) =>
        userData?.id ? p.id === userData.id : p.username === userData?.username
      );
      setMySymbol(mine?.symbol ?? null);
    };

    const handleUpdate = (payload: { board: Board; nextTurn: "X" | "O" }) => {
      console.log("[GameBoard] gameUpdate", payload);
      setBoard(payload.board);
      setNextTurn(payload.nextTurn);
      setIsGameActive(true);
    };

    const handleOver = (payload: {
      result: "DRAW" | "COMPLETED" | "CANCELLED";
      winner?: { id: number; username: string; symbol: "X" | "O" };
    }) => {
      console.log("[GameBoard] gameOver", payload);
      setIsGameOver(true);
      if (payload.result === "DRAW") {
        setIsDraw(true);
        setWinnerSymbol(null);
        setWinnerName(null);
      } else if (payload.winner) {
        setWinnerSymbol(payload.winner.symbol);
        setWinnerName(payload.winner.username);
        setIsDraw(false);
      }
      setIsGameActive(false);
    };

    const handleRestarted = (payload: {
      game: { id: number; roomId: number };
      board: Board;
      nextTurn: "X" | "O";
    }) => {
      console.log("[GameBoard] gameRestarted", payload);
      setBoard(payload.board);
      setNextTurn(payload.nextTurn);
      setIsGameOver(false);
      setWinnerSymbol(null);
      setWinnerName(null);
      setIsDraw(false);
      setIsGameActive(true);
    };

    const handleInvalid = (payload?: { reason?: string }) => {
      console.warn("[GameBoard] invalidMove", payload);
      // Optionally, show a toast or temporary UI message
      // For now, no-op to keep UI simple
    };

    // Only listen to game events - the parent component already authenticated and joined
    console.log(
      "[GameBoard] Setting up game event listeners for room:",
      roomId
    );

    socket.on("roomJoined", handleRoomJoined);
    socket.on("roomReady", handleRoomReady);
    socket.on("userJoined", handleUserJoined);
    socket.on("gameStarted", handleStarted);
    socket.on("gameUpdate", handleUpdate);
    socket.on("gameOver", handleOver);
    socket.on("gameRestarted", handleRestarted);
    socket.on("invalidMove", handleInvalid);

    return () => {
      socket.off("roomJoined", handleRoomJoined);
      socket.off("roomReady", handleRoomReady);
      socket.off("userJoined", handleUserJoined);
      socket.off("gameStarted", handleStarted);
      socket.off("gameUpdate", handleUpdate);
      socket.off("gameOver", handleOver);
      socket.off("gameRestarted", handleRestarted);
      socket.off("invalidMove", handleInvalid);
    };
  }, [roomId]);

  // Memoize callbacks to prevent re-renders
  const handleSquareClick = useCallback(
    (index: number) => {
      console.log("[GameBoard] square click", {
        index,
        currentCell: board[index],
        isGameOver,
        isGameActive,
      });
      if (!isGameActive || isGameOver || board[index] !== null) return;
      socket.emit("playerMove", { code: roomId, position: index });
    },
    [board, isGameOver, isGameActive, roomId]
  );

  // Start / play again (server-authoritative)
  const resetGame = useCallback(() => {
    socket.emit("playAgain", { code: roomId });
  }, [roomId]);

  const startGame = useCallback(() => {
    socket.emit("startGame", { code: roomId });
  }, [roomId]);

  const leaveRoom = useCallback(() => {
    socket.emit("leaveRoom", { code: roomId });
    if (typeof window !== "undefined") window.history.back();
  }, [roomId]);

  // Memoize renderSquare to prevent unnecessary re-renders
  const renderSquare = useCallback(
    (index: number) => {
      const outOfTurn = mySymbol !== null && nextTurn !== mySymbol;
      const isDisabled =
        isGameOver || !isGameActive || outOfTurn || board[index] !== null;

      return (
        <button
          key={index}
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl border border-cyan-400/40
          bg-[#120E2A] text-3xl sm:text-4xl font-extrabold tracking-widest
          hover:bg-[#141037] transition-colors duration-200
          shadow-[inset_0_0_12px_rgba(34,211,238,0.2),0_0_14px_rgba(34,211,238,0.2)]
          ${
            board[index] === "X"
              ? "text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]"
              : "text-fuchsia-300 drop-shadow-[0_0_12px_rgba(217,70,239,0.6)]"
          }
          ${isGameOver ? "cursor-not-allowed opacity-80" : "cursor-pointer"}
        `}
          onClick={() => handleSquareClick(index)}
          disabled={Boolean(isDisabled)}
          type="button"
        >
          {board[index]}
        </button>
      );
    },
    [board, mySymbol, nextTurn, isGameOver, isGameActive, handleSquareClick]
  );

  return (
    <div className="relative w-full max-w-xl mx-auto rounded-3xl p-6 sm:p-8 bg-[#0F0A23]/60 border border-cyan-400/30 shadow-[0_0_25px_rgba(34,211,238,0.25)]">
      {/* Title */}

      {/* Game Status */}
      <div className="mb-5 text-center">
        {isWaitingForPlayer && !isGameActive ? (
          <div className="space-y-3">
            <div className="inline-block animate-pulse">
              <p className="text-base sm:text-lg font-bold text-yellow-300 mb-2">
                Waiting for Player 2...
              </p>
            </div>
            <p className="text-xs sm:text-sm text-purple-200/80">
              Share this room code with a friend:
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-900/40 border border-purple-400/40 rounded-lg">
              <span className="text-lg sm:text-xl font-mono font-bold text-purple-200 tracking-wider">
                {roomId}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(roomId);
                  setShowCopiedMessage(true);
                  setTimeout(() => setShowCopiedMessage(false), 2000);
                }}
                className="px-2 py-1 text-xs bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 rounded transition-colors"
                title="Copy room code"
              >
                {showCopiedMessage ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-purple-300/60 mt-2">
              Players in room: {playersCount}/2
            </p>
          </div>
        ) : (
          <>
            <p
              className={`text-sm sm:text-base font-semibold ${
                isGameOver && winnerSymbol
                  ? "text-emerald-300"
                  : isGameOver && isDraw
                  ? "text-yellow-300"
                  : "text-cyan-200/80"
              }`}
            >
              {isGameOver
                ? isDraw
                  ? "It's a draw!"
                  : winnerSymbol
                  ? `Player ${winnerSymbol}${
                      winnerName ? ` (${winnerName})` : ""
                    } wins!`
                  : "Game Over!"
                : !isGameActive
                ? "Waiting for game to start..."
                : mySymbol !== null && nextTurn === mySymbol
                ? `Your turn (${mySymbol})`
                : `It's ${nextTurn}'s turn`}
            </p>
            <p className="text-[11px] sm:text-xs text-purple-200/60 mt-1">
              Room: {roomId}
            </p>
          </>
        )}
      </div>

      {/* Game Board */}
      <div className="relative mx-auto mb-6 sm:mb-8 p-3 rounded-2xl bg-[#120E2A] border border-cyan-400/30 shadow-[0_0_30px_rgba(34,211,238,0.25)]">
        <div className="grid grid-cols-3 gap-2">
          {Array(9)
            .fill(null)
            .map((_, index) => renderSquare(index))}
        </div>
      </div>

      {/* Game Controls */}
      <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
        {!isGameActive && !isGameOver && (
          <button
            onClick={startGame}
            className="px-5 sm:px-6 py-2 rounded-xl text-white font-semibold bg-emerald-500/20 border border-emerald-400/40 hover:bg-emerald-500/30 shadow-[0_0_16px_rgba(16,185,129,0.35)] transition-colors"
          >
            START GAME
          </button>
        )}
        {isGameOver && (
          <button
            onClick={resetGame}
            className="px-5 sm:px-6 py-2 rounded-xl text-white font-semibold bg-cyan-500/20 border border-cyan-400/40 hover:bg-cyan-500/30 shadow-[0_0_16px_rgba(34,211,238,0.35)] transition-colors"
          >
            PLAY AGAIN
          </button>
        )}
        <button
          type="button"
          onClick={leaveRoom}
          className="px-5 sm:px-6 py-2 rounded-xl text-white font-semibold bg-rose-500/20 border border-rose-400/40 hover:bg-rose-500/30 shadow-[0_0_16px_rgba(244,63,94,0.35)] transition-colors"
        >
          LEAVE
        </button>
      </div>

      {/* Game Stats */}
      <div className="mt-5 text-center text-xs sm:text-sm text-purple-200/80">
        <p>
          Current Player:{" "}
          <span
            className={`font-extrabold drop-shadow-[0_0_8px_rgba(59,130,246,0.55)] ${
              nextTurn === "X" ? "text-cyan-300" : "text-fuchsia-300"
            }`}
          >
            {nextTurn}
          </span>
        </p>
      </div>
    </div>
  );
}