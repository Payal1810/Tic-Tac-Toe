import React from "react";

interface ChatMessageProps {
  isOwnMessage: boolean;
  sender: string;
  message: string;
}

export default function ChatMessage({
  isOwnMessage,
  sender,
  message,
}: ChatMessageProps) {
  return (
    <div
      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} mb-3`}
    >
      <div
        className={`max-w-xs rounded-xl px-4 py-2
        ${
          isOwnMessage
            ? "bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-100 shadow-[0_0_14px_rgba(217,70,239,0.35)]"
            : "bg-[#0F0A23] border border-purple-500/40 text-purple-100 shadow-[0_0_14px_rgba(168,85,247,0.25)]"
        }`}
      >
        <p className="text-xs font-bold opacity-80">{sender}</p>
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}