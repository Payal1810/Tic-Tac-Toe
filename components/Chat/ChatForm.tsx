"use client";
import React, { useState } from "react";
import { validateMessage } from "@/lib/validation";

const ChatForm = ({
  onSendMessage,
}: {
  onSendMessage: (message: string) => void;
}) => {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Frontend validation using Yup schema
    const messageValidation = validateMessage(message);
    if (!messageValidation.success) {
      setError(messageValidation.error || "Invalid message");
      return;
    }

    onSendMessage(message);
    setMessage("");
  };
  return (
    <div className="w-full">
      {error && <div className="text-rose-300 text-sm mb-2 px-2">{error}</div>}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-2 w-full">
        <div className="relative flex-1">
          <input
            type="text"
            value={message}
            className="w-full px-4 py-2 rounded-xl border border-purple-500/40 bg-[#0F0A23] text-purple-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 shadow-[0_0_14px_rgba(168,85,247,0.25)]"
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2 rounded-xl text-white font-semibold bg-fuchsia-500/20 border border-fuchsia-400/40 hover:bg-fuchsia-500/30 shadow-[0_0_16px_rgba(217,70,239,0.35)] transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatForm;