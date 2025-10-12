"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { validateRoomCode } from "@/lib/validation";
import { socket } from "@/lib/socketClient";

// Generate a random 6-digit room code
const generateRoomCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Reusable corner decoration component to reduce duplication
const CornerDecorations = () => (
  <>
    <div className="absolute top-2 left-2 w-6 h-6 border-l-2 border-t-2 border-purple-400"></div>
    <div className="absolute top-2 right-2 w-6 h-6 border-r-2 border-t-2 border-purple-400"></div>
    <div className="absolute bottom-2 left-2 w-6 h-6 border-l-2 border-b-2 border-purple-400"></div>
    <div className="absolute bottom-2 right-2 w-6 h-6 border-r-2 border-b-2 border-purple-400"></div>
  </>
);

export default function RoomPage() {
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [mode, setMode] = useState<"select" | "create" | "join">("select");

  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  // Use refs for timeouts to ensure proper cleanup
  const createTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const joinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authFallbackRef = useRef<NodeJS.Timeout | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, router]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (createTimeoutRef.current) clearTimeout(createTimeoutRef.current);
      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      if (authFallbackRef.current) clearTimeout(authFallbackRef.current);
    };
  }, []);

  const handleCreateRoom = useCallback(async () => {
    // Auto-generate a 6-digit room code
    const code = generateRoomCode();

    console.log("[CreateRoom] Create clicked", { generatedCode: code });
    setIsCreating(true);
    setError("");

    try {
      if (user) {
        console.log("[CreateRoom] emit authenticate-user", {
          user: { id: user.id, username: user.username },
        });
        socket.emit("authenticate-user", { user });
      }

      const onRoomCreated = (payload: {
        room: { id: number; code: string; status: string };
        player: { id: number; username: string; symbol: string };
      }) => {
        console.log("[CreateRoom] :white_check_mark: roomCreated received", payload);
        cleanup();
        router.push(`/room/${payload.room.code}`);
      };

      const onRoomError = (err: { code?: string; message: string }) => {
        console.warn("[CreateRoom] :x: roomError received", err);
        setError(err.message || "Failed to create room");
        cleanup(true);
      };

      const cleanup = (stopLoading = false) => {
        console.log("[CreateRoom] cleanup", { stopLoading });
        socket.off("roomCreated", onRoomCreated);
        socket.off("roomError", onRoomError);
        if (createTimeoutRef.current) {
          clearTimeout(createTimeoutRef.current);
          createTimeoutRef.current = null;
        }
        if (authFallbackRef.current) {
          clearTimeout(authFallbackRef.current);
          authFallbackRef.current = null;
        }
        if (stopLoading) setIsCreating(false);
      };

      socket.on("roomCreated", onRoomCreated);
      socket.on("roomError", onRoomError);

      // Wait for auth acknowledgement before creating
      const onAuthOk = () => {
        console.log("[CreateRoom] :white_check_mark: auth-ok received, emitting createRoom", {
          code,
        });
        socket.off("auth-ok", onAuthOk);
        if (authFallbackRef.current) {
          clearTimeout(authFallbackRef.current);
          authFallbackRef.current = null;
        }
        socket.emit("createRoom", { code });
      };
      socket.on("auth-ok", onAuthOk);

      // Fallback if auth-ok already happened - increased to 500ms for better reliability
      authFallbackRef.current = setTimeout(() => {
        console.log(
          "[CreateRoom] :stopwatch: auth-ok fallback (500ms) -> emit createRoom",
          {
            code,
          }
        );
        socket.off("auth-ok", onAuthOk);
        socket.emit("createRoom", { code });
      }, 500);

      // Safety timeout - increased to 15 seconds for slower connections
      createTimeoutRef.current = setTimeout(() => {
        console.warn("[CreateRoom] create timeout fired after 15s");
        cleanup(true);
        setError(
          "Create timed out. Please check your connection and try again."
        );
      }, 15000);
    } catch (e) {
      console.error("[CreateRoom] exception in handleCreateRoom", e);
      setError("Failed to create room. Please try again.");
      setIsCreating(false);
    }
  }, [user, router]);

  // Auto-create room when mode changes to "create"
  useEffect(() => {
    if (mode === "create" && !isCreating) {
      setIsCreating(true);
      handleCreateRoom();
    }
  }, [mode, isCreating, handleCreateRoom]);

  const handleJoinRoom = useCallback(async () => {
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

      // Listen for roomJoined - this is sent immediately when you join
      const onRoomJoined = (payload: {
        room: { id: number; code: string; status: string };
        players: Array<{ id: number; username: string; symbol: string }>;
        you: { id: number; username: string; symbol: string };
      }) => {
        console.log("[JoinPage] :white_check_mark: roomJoined received", payload);
        cleanup();
        router.push(`/room/${payload.room.code}`);
      };

      const onRoomError = (err: { code?: string; message: string }) => {
        console.warn("[JoinPage] :x: roomError received", err);
        setError(err.message || "Failed to join room");
        cleanup(true);
      };

      const cleanup = (stopLoading = false) => {
        console.log("[JoinPage] cleanup", { stopLoading });
        socket.off("roomJoined", onRoomJoined);
        socket.off("roomError", onRoomError);
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }
        if (authFallbackRef.current) {
          clearTimeout(authFallbackRef.current);
          authFallbackRef.current = null;
        }
        if (stopLoading) setIsLoading(false);
      };

      socket.on("roomJoined", onRoomJoined);
      socket.on("roomError", onRoomError);

      // Wait for auth acknowledgement before joining to avoid race conditions
      const onAuthOk = () => {
        console.log("[JoinPage] :white_check_mark: auth-ok received, emitting joinRoom", {
          code,
        });
        socket.off("auth-ok", onAuthOk);
        if (authFallbackRef.current) {
          clearTimeout(authFallbackRef.current);
          authFallbackRef.current = null;
        }
        socket.emit("joinRoom", { code });
      };
      socket.on("auth-ok", onAuthOk);

      // If auth-ok never arrives (e.g., already authed), still attempt join after short delay - increased to 500ms
      authFallbackRef.current = setTimeout(() => {
        console.log("[JoinPage] :stopwatch: auth-ok fallback (500ms) -> emit joinRoom", {
          code,
        });
        socket.off("auth-ok", onAuthOk);
        socket.emit("joinRoom", { code });
      }, 500);

      // Safety timeout - increased to 15 seconds for slower connections
      joinTimeoutRef.current = setTimeout(() => {
        console.warn("[JoinPage] join timeout fired after 15s");
        cleanup(true);
        setError("Join timed out. Please check your connection and try again.");
      }, 15000);
    } catch (e) {
      console.error("[JoinPage] exception in handleJoinRoom", e);
      setError("Failed to join room. Please try again.");
      setIsLoading(false);
    }
  }, [roomCode, user, router]);

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
      <div className="min-h-screen bg-[#0B0715] from-[#0B0715] to-[#110A24] bg-gradient-to-b flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-purple-300">Loading...</h2>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#0B0715] from-[#0B0715] to-[#110A24] bg-gradient-to-b flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-purple-300 mb-4">
            Please login first
          </h2>
          <button
            onClick={() => router.push("/")}
            className="text-fuchsia-400 hover:text-fuchsia-300"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  // Mode: Select (Initial screen)
  if (mode === "select") {
    return (
      <div className="min-h-screen bg-[#0B0715] from-[#0B0715] to-[#110A24] bg-gradient-to-b flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logout button in top right */}
          <div className="absolute top-4 right-4">
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-500/40 rounded-md bg-red-500/10 hover:bg-red-500/20 transition-colors"
            >
              Logout
            </button>
          </div>

          {/* CREATE ROOM Card */}
          <div className="mb-8">
            <div className="relative border-2 border-purple-500/60 rounded-lg bg-[#1A0F2E]/80 backdrop-blur-sm p-8 shadow-[0_0_30px_rgba(168,85,247,0.4)]">
              <CornerDecorations />

              <h2 className="text-2xl font-bold text-center mb-6 text-purple-300 tracking-widest">
                CREATE ROOM
              </h2>

              <div className="flex items-center justify-center mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-4xl shadow-lg">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              </div>

              <p className="text-center text-purple-200/80 mb-6 text-sm">
                SELECT
              </p>

              <button
                onClick={() => setMode("create")}
                disabled={isCreating}
                className="w-full py-3 px-6 border-2 border-purple-500/60 rounded-md text-purple-200 font-semibold bg-purple-900/40 hover:bg-purple-800/60 hover:border-purple-400 transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                CREATE ROOM
              </button>
            </div>
          </div>

          {/* JOIN ROOM Card */}
          <div>
            <div className="relative border-2 border-purple-500/60 rounded-lg bg-[#1A0F2E]/80 backdrop-blur-sm p-8 shadow-[0_0_30px_rgba(168,85,247,0.4)]">
              <CornerDecorations />

              <h2 className="text-2xl font-bold text-center mb-8 text-purple-300 tracking-widest">
                JOIN ROOM
              </h2>

              <button
                onClick={() => setMode("join")}
                className="w-full py-3 px-6 border-2 border-purple-500/60 rounded-md text-purple-200 font-semibold bg-purple-900/40 hover:bg-purple-800/60 hover:border-purple-400 transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)]"
              >
                JOIN ROOM
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mode: Create Room (Auto-generate and create)
  if (mode === "create") {
    return (
      <div className="min-h-screen bg-[#0B0715] from-[#0B0715] to-[#110A24] bg-gradient-to-b flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="relative border-2 border-purple-500/60 rounded-lg bg-[#1A0F2E]/80 backdrop-blur-sm p-8 shadow-[0_0_30px_rgba(168,85,247,0.4)]">
            <CornerDecorations />

            <h2 className="text-2xl font-bold text-center mb-8 text-purple-300 tracking-widest">
              CREATING ROOM
            </h2>

            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-400"></div>
              <p className="mt-4 text-purple-200/80">Please wait...</p>
            </div>

            {error && (
              <div className="mt-6 p-4 border border-red-500/40 bg-red-500/10 rounded-md">
                <p className="text-red-300 text-sm text-center">{error}</p>
                <button
                  onClick={() => {
                    setMode("select");
                    setError("");
                    setIsCreating(false);
                  }}
                  className="mt-3 w-full py-2 px-4 border border-purple-500/40 rounded-md text-purple-200 hover:bg-purple-900/40 transition-colors"
                >
                  Back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Mode: Join Room (Enter code)
  if (mode === "join") {
    return (
      <div className="min-h-screen bg-[#0B0715] from-[#0B0715] to-[#110A24] bg-gradient-to-b flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Back button */}
          <div className="mb-4">
            <button
              onClick={() => {
                setMode("select");
                setRoomCode("");
                setError("");
              }}
              className="px-4 py-2 text-sm text-purple-300 hover:text-purple-200 border border-purple-500/40 rounded-md bg-purple-900/20 hover:bg-purple-900/40 transition-colors"
            >
              ← Back
            </button>
          </div>

          <div className="relative border-2 border-purple-500/60 rounded-lg bg-[#1A0F2E]/80 backdrop-blur-sm p-8 shadow-[0_0_30px_rgba(168,85,247,0.4)]">
            <CornerDecorations />

            <h2 className="text-2xl font-bold text-center mb-8 text-purple-300 tracking-widest">
              JOIN ROOM
            </h2>

            {isLoading ? (
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-400"></div>
                <p className="mt-4 text-purple-200/80">Joining room...</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <label className="block text-purple-200/80 text-sm mb-2 tracking-wider">
                    ENTER ROOM CODE:
                  </label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    className="w-full px-4 py-3 bg-[#0F0A23] border-2 border-purple-500/40 rounded-md text-purple-100 text-center text-xl tracking-widest focus:outline-none focus:border-purple-400 focus:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all placeholder-purple-500/30"
                    placeholder="982183"
                    maxLength={20}
                    autoFocus
                  />
                  {error && (
                    <p className="mt-2 text-red-400 text-sm text-center">
                      {error}
                    </p>
                  )}
                </div>

                <p className="text-center text-purple-200/60 text-sm mb-6">
                  JOINING WITH ROOM CODE
                </p>

                <button
                  onClick={handleJoinRoom}
                  disabled={!roomCode.trim()}
                  className="w-full py-3 px-6 border-2 border-purple-500/60 rounded-md text-purple-200 font-semibold bg-purple-900/40 hover:bg-purple-800/60 hover:border-purple-400 transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  JOIN ROOM
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}