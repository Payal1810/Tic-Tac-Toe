"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ChatForm from "@/components/Chat/ChatForm";
import ChatMessage from "@/components/Chat/ChatMessage";
import GameBoard from "@/components/GameBoard";
import { useAuth } from "@/hooks/useAuth";
import { socket } from "@/lib/socketClient";

export default function RoomPage() {
  const params = useParams<{ roomid: string }>();
  const router = useRouter();
  const roomId = params.roomid;

  const [messages, setMessages] = useState<
    Array<{ sender: string; message: string; timestamp: string }>
  >([]);
  const [isJoined, setIsJoined] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, router]);

  // Join room when authenticated and socket is ready
  useEffect(() => {
    if (!user || isJoined) return;

    // Authenticate socket with user data
    socket.emit("authenticate-user", { user });

    // Join the room
    socket.emit("join-room", { room: roomId, user });
    setIsJoined(true);

    console.log(`Joining room ${roomId} as ${user.username}`);
  }, [user, roomId, isJoined]);

  // Set up socket event listeners
  useEffect(() => {
    if (!user) return;

    // Handle incoming messages
    const handleMessage = (data: {
      sender: string;
      message: string;
      timestamp: string;
    }) => {
      console.log("Received message:", data);
      setMessages((prev) => [...prev, data]);
    };

    // Handle user joined events
    const handleUserJoined = (message: string) => {
      setMessages((prev) => [
        ...prev,
        {
          sender: "System",
          message,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    // Handle chat history
    const handleChatHistory = (
      history: Array<{ username: string; content: string; created_at: string }>
    ) => {
      console.log("Chat history:", history);
      const formattedHistory = history.map((msg) => ({
        sender: msg.username,
        message: msg.content,
        timestamp: msg.created_at,
      }));
      setMessages(formattedHistory);
    };

    // Handle errors
    const handleRoomError = (error: { error: string }) => {
      console.error("Room error:", error);
      setConnectionError(error.error);
    };

    const handleMessageError = (error: { error: string }) => {
      console.error("Message error:", error);
      setConnectionError(`Failed to send message: ${error.error}`);

      // Clear error after 3 seconds
      setTimeout(() => setConnectionError(null), 3000);
    };

    // Register event listeners
    socket.on("message", handleMessage);
    socket.on("user_joined", handleUserJoined);
    socket.on("chat_history", handleChatHistory);
    socket.on("room_error", handleRoomError);
    socket.on("message_error", handleMessageError);

    // Cleanup
    return () => {
      socket.off("message", handleMessage);
      socket.off("user_joined", handleUserJoined);
      socket.off("chat_history", handleChatHistory);
      socket.off("room_error", handleRoomError);
      socket.off("message_error", handleMessageError);
    };
  }, [user]);

  const handleSendMessage = (message: string) => {
    if (!user || !message.trim()) return;

    console.log("Sending message:", message);
    socket.emit("message", { roomId, message });
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="flex mt-24 justify-center w-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading...</h2>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="flex mt-24 justify-center w-full">
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
    );
  }

  // Joining room state
  if (!isJoined) {
    return (
      <div className="flex mt-24 justify-center w-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Joining room {roomId}...</h2>
          <p>Connecting to the room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0715] from-[#0B0715] to-[#110A24] bg-gradient-to-b">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-widest text-center mb-2 text-purple-300 drop-shadow-[0_0_14px_rgba(168,85,247,0.6)]">
            TIC TAC TOE
          </h1>
        </div>
        <div className="flex items-center gap-4">

          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm rounded-md border border-fuchsia-500/40 text-fuchsia-300 hover:text-white bg-fuchsia-500/10 hover:bg-fuchsia-500/20 transition-colors shadow-[0_0_10px_rgba(217,70,239,0.35)]"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Connection Error Alert */}
      {connectionError && (
        <div className="mx-4 md:mx-6 mb-4 p-4 rounded-lg border border-red-500/40 bg-red-500/10 text-red-200">
          <div className="flex">
            <div className="ml-1">
              <h3 className="text-sm font-semibold">Connection Error</h3>
              <div className="mt-1 text-sm">{connectionError}</div>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setConnectionError(null)}
                className="text-red-300 hover:text-red-200"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Game Board Left, Chat Right */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-4 md:p-6">
        {/* Left Side - Game Board */}
        <div className="flex-1 flex justify-center items-start">
          <GameBoard roomId={roomId} currentUser={user.username} />
        </div>

        {/* Right Side - Chat */}
        <div className="flex-1 flex flex-col lg:max-w-md">
          {/* Chat Area */}
          <div className="flex-1 h-[420px] lg:h-[620px] overflow-y-auto p-4 mb-4 rounded-2xl border border-purple-500/40 bg-[#0F0A23]/60 backdrop-blur-sm shadow-[0_0_20px_rgba(168,85,247,0.25)]">
            {messages.length === 0 ? (
              <div className="text-center text-purple-200/60 mt-10">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <ChatMessage
                  key={index}
                  sender={msg.sender}
                  message={msg.message}
                  isOwnMessage={msg.sender === user.username}
                />
              ))
            )}
          </div>

          {/* Chat Input */}
          <ChatForm onSendMessage={handleSendMessage} />
        </div>
      </div>
    </div>
  );
}