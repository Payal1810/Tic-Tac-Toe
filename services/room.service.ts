import { query } from "../lib/db.mjs";
import {
  validateRoomCode,
  validateMessage,
  sanitizeInput,
} from "../lib/validation";

interface Room {
  id: number;
  created_by: number;
  code: string;
  created_at: string;
  status: "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}

interface ChatMessage {
  id: number;
  room_id: number;
  sender_id: number;
  content: string;
  created_at: string;
  username?: string;
}

interface RoomResult {
  success: boolean;
  room?: Room;
  error?: string;
}

interface MessageResult {
  success: boolean;
  message?: ChatMessage;
  error?: string;
}

export class RoomService {
  async findOrCreateRoom(
    roomCode: string,
    createdBy: number
  ): Promise<RoomResult> {
    try {
      // Sanitize and validate room code
      const cleanRoomCode = sanitizeInput(roomCode);
      const validation = validateRoomCode(cleanRoomCode);
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      // Try to find existing room
      let result = await query(
        "SELECT * FROM rooms WHERE code = $1 AND status IN ($2, $3)",
        [cleanRoomCode, "WAITING", "IN_PROGRESS"]
      );

      if (result.rows.length === 0) {
        // Create new room
        result = await query(
          "INSERT INTO rooms (created_by, code, status) VALUES ($1, $2, $3) RETURNING *",
          [createdBy, cleanRoomCode, "WAITING"]
        );
      }

      return { success: true, room: result.rows[0] as Room };
    } catch (error) {
      console.error("Room creation error:", error);
      return { success: false, error: "Failed to create or find room" };
    }
  }

  async getRoomByCode(roomCode: string): Promise<Room | null> {
    try {
      const cleanRoomCode = sanitizeInput(roomCode);
      const result = await query("SELECT * FROM rooms WHERE code = $1", [
        cleanRoomCode,
      ]);
      return (result.rows[0] as Room) || null;
    } catch (error) {
      console.error("Get room error:", error);
      return null;
    }
  }

  async saveChatMessage(
    roomCode: string,
    userId: number,
    content: string
  ): Promise<MessageResult> {
    try {
      // Sanitize and validate inputs
      const cleanRoomCode = sanitizeInput(roomCode);
      const cleanContent = sanitizeInput(content);

      const roomValidation = validateRoomCode(cleanRoomCode);
      if (!roomValidation.success) {
        return { success: false, error: roomValidation.error };
      }

      const messageValidation = validateMessage(cleanContent);
      if (!messageValidation.success) {
        return { success: false, error: messageValidation.error };
      }

      // Get or create room
      const roomResult = await this.findOrCreateRoom(cleanRoomCode, userId);
      if (!roomResult.success || !roomResult.room) {
        return { success: false, error: "Failed to find or create room" };
      }

      // Save message
      const result = await query(
        "INSERT INTO chat_message (room_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *",
        [roomResult.room.id, userId, cleanContent]
      );

      return { success: true, message: result.rows[0] as ChatMessage };
    } catch (error) {
      console.error("Save message error:", error);
      return { success: false, error: "Failed to save message" };
    }
  }

  async getChatHistory(roomCode: string): Promise<ChatMessage[]> {
    try {
      const cleanRoomCode = sanitizeInput(roomCode);
      const result = await query(
        `SELECT cm.*, u.username
         FROM chat_message cm
         JOIN users u ON cm.sender_id = u.id
         JOIN rooms r ON cm.room_id = r.id
         WHERE r.code = $1
         ORDER BY cm.created_at ASC
         LIMIT 50`,
        [cleanRoomCode]
      );
      return result.rows as ChatMessage[];
    } catch (error) {
      console.error("Get chat history error:", error);
      return [];
    }
  }

  async joinRoom(userId: number, roomCode: string): Promise<RoomResult> {
    try {
      const roomResult = await this.findOrCreateRoom(roomCode, userId);
      if (!roomResult.success) {
        return roomResult;
      }

      // Add user to room_details if not already present
      const existingEntry = await query(
        "SELECT * FROM room_details WHERE room_id = $1 AND player_id = $2",
        [roomResult.room!.id, userId]
      );

      if (existingEntry.rows.length === 0) {
        await query(
          "INSERT INTO room_details (room_id, player_id, symbol, joined_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)",
          [roomResult.room!.id, userId, "X"] // Default to X, can be improved later
        );
      }

      return roomResult;
    } catch (error) {
      console.error("Join room error:", error);
      return { success: false, error: "Failed to join room" };
    }
  }
}