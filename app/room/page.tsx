"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { validateRoomCode } from "@/lib/validation";
import { socket } from "@/lib/socketClient";

export default function RoomPage() {
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      setError("Please enter a room code");
      return;
    }

    // Validate room code
    const validation = validateRoomCode(roomCode.trim());
    if (!validation.success) {
      setError(validation.error || "Invalid room code");
      return;
    }

    console.log("[JoinPage] Join clicked", { input: roomCode });
    setIsLoading(true);
    console.log("[JoinPage] isLoading=true");
    setError("");

    const code = roomCode.trim();

    // Authenticate socket and attempt to join; redirect only when 2 players present
    try {
      if (user) {
        console.log("[JoinPage] emit authenticate-user", {
          user: { id: user.id, username: user.username },
        });
        socket.emit("authenticate-user", { user });
      }

      const onRoomReady = (payload: { room: { id: number; code: string } }) => {
        console.log("[JoinPage] roomReady", payload);
        cleanup();
        router.push(`/room/${payload.room.code}`);
      };

      const onRoomError = (err: { code: string; message: string }) => {
        console.warn("[JoinPage] roomError", err);
        setError(err.message || "Failed to join room");
        cleanup(true);
      };

      const cleanup = (stopLoading = false) => {
        console.log("[JoinPage] cleanup", { stopLoading });
        socket.off("roomReady", onRoomReady);
        socket.off("roomError", onRoomError);
        if (stopLoading) setIsLoading(false);
      };

      socket.on("roomReady", onRoomReady);
      socket.on("roomError", onRoomError);

      // Wait for auth acknowledgement before joining to avoid race conditions
      const onAuthOk = () => {
        console.log("[JoinPage] auth-ok received, emitting joinRoom", { code });
        socket.off("auth-ok", onAuthOk);
        socket.emit("joinRoom", { code });
      };
      socket.on("auth-ok", onAuthOk);
      // If auth-ok never arrives (e.g., already authed), still attempt join after short delay
      setTimeout(() => {
        console.log("[JoinPage] auth-ok fallback -> emit joinRoom", { code });
        socket.off("auth-ok", onAuthOk);
        socket.emit("joinRoom", { code });
      }, 200);

      // Safety timeout
      setTimeout(() => {
        console.warn("[JoinPage] join timeout fired");
        if (isLoading) {
          cleanup(true);
          setError("Join timed out. Try again.");
        }
      }, 10000);
    } catch (e) {
      console.error("[JoinPage] exception in handleJoinRoom", e);
      setError("Failed to join room. Please try again.");
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJoinRoom();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRoomCode(value);

    // Clear error when user starts typing
    if (error) {
      setError("");
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Loading...</h2>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Please login first</h2>
            <button
              onClick={() => router.push("/")}
              className="text-indigo-600 hover:text-indigo-500"
            >
              Go to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user.username}!
          </h1>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:text-red-500 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Room Join Form */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="roomCode"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Enter Room Code
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., 123"
              disabled={isLoading}
              maxLength={20}
            />
            {error && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>

          <button
            onClick={handleJoinRoom}
            disabled={!roomCode.trim() || isLoading}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Joining..." : "Join Room"}
          </button>
        </div>
      </div>
    </div>
  );
}