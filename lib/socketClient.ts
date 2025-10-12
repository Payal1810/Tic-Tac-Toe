import { io } from "socket.io-client";

// Create socket instance
export const socket = io(
  process.env.NODE_ENV === "production"
    ? "https://your-domain.com"
    : "http://localhost:3000",
  {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20000,
  }
);