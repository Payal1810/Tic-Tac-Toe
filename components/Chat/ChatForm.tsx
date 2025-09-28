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
      {error && <div className="text-red-500 text-sm mb-2 px-2">{error}</div>}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-4 w-full">
        <input
          type="text"
          value={message}
          className="flex-1 px-4 py-2 rounded-lg border focus:outline-none"
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here..."
        />
        <button
          type="submit"
          className=" text-white px-4 py-2 rounded-lg bg-blue-500"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatForm;