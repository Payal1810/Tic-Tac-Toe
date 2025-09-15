"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { validateRoomCode } from "@/lib/validation";

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

    setIsLoading(true);
    setError("");

    try {
      // Navigate to room
      router.push(`/room/${roomCode.trim()}`);
    } catch {
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

          {/* User Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-center text-sm text-gray-500">
              <p>Coins: {user.coins}</p>
              <p className="mt-1">
                Member since: {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}