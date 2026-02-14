import { Pool } from "pg";
import bcrypt from "bcryptjs";

// Create a connection pool with individual parameters (more reliable)
const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "TicTacToe",
  user: "postgres",
  password: "Abcd@1234",
  ssl: false, // Disable SSL for local development
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on("connect", () => {
  console.log("Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error(":x: Unexpected error on idle client", err);
});

// Helper function to execute queries
const query = async (text: string, params?: unknown[]) => {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
};

// User authentication functions
const userService = {
  // Register new user
  async register(username: string, email: string, password: string) {
    try {
      // Check if username or email already exists
      const existingUser = await query(
        "SELECT id FROM users WHERE username = $1 OR email = $2",
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error("Username or email already exists");
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const result = await query(
        "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, coins, created_at",
        [username, email, hashedPassword]
      );

      console.log(`New user registered: ${username}`);
      return result.rows[0];
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  },

  // Login user
  async login(username: string, password: string) {
    try {
      // Find user by username
      const result = await query("SELECT * FROM users WHERE username = $1", [
        username,
      ]);

      if (result.rows.length === 0) {
        throw new Error("Invalid username or password");
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error("Invalid username or password");
      }

      // Update last login
      await query(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
        [user.id]
      );

      console.log(`User logged in: ${username}`);

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          coins: user.coins,
        },
      };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  // Get user by ID
  async getUserById(userId: number) {
    const result = await query(
      "SELECT id, username, email, coins FROM users WHERE id = $1",
      [userId]
    );
    return result.rows[0];
  },
};

// Room and game functions
const gameService = {
  // Find or create room
  async findOrCreateRoom(roomCode: string, createdBy: number) {
    // Try to find existing room
    let result = await query(
      "SELECT * FROM rooms WHERE code = $1 AND status IN ('WAITING', 'IN_PROGRESS')",
      [roomCode]
    );

    if (result.rows.length === 0) {
      // Create new room
      result = await query(
        "INSERT INTO rooms (created_by, code, status) VALUES ($1, $2, $3) RETURNING *",
        [createdBy, roomCode, "WAITING"]
      );
      console.log(`Created new room: ${roomCode}`);
    }

    return result.rows[0];
  },

  // Get room by code
  async getRoomByCode(roomCode: string) {
    const result = await query("SELECT * FROM rooms WHERE code = $1", [
      roomCode,
    ]);
    return result.rows[0];
  },

  // Save chat message
  async saveChatMessage(roomCode: string, userId: number, content: string) {
    try {
      // Get or create room
      const room = await this.findOrCreateRoom(roomCode, userId);

      if (!room) {
        throw new Error("Failed to find or create room");
      }

      // Save message
      const result = await query(
        "INSERT INTO chat_message (room_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *",
        [room.id, userId, content]
      );

      console.log(`Message saved: User ${userId} in room ${roomCode}`);
      return result.rows[0];
    } catch (error) {
      console.error("Error saving chat message:", error);
      throw error;
    }
  },

  // Get room chat history
  async getChatHistory(roomCode: string) {
    try {
      const result = await query(
        `
        SELECT cm.content, cm.created_at, u.username
        FROM chat_message cm
        JOIN users u ON cm.sender_id = u.id
        JOIN rooms r ON cm.room_id = r.id
        WHERE r.code = $1
        ORDER BY cm.created_at ASC
        LIMIT 50
      `,
        [roomCode]
      );
      return result.rows;
    } catch (error) {
      console.error("Error getting chat history:", error);
      return [];
    }
  },

  // Get players in a room by room code with their assigned symbols
  async getRoomPlayersByCode(roomCode: string) {
    const result = await query(
      `
        SELECT u.id, u.username, rd.symbol
        FROM room_details rd
        JOIN rooms r ON rd.room_id = r.id
        JOIN users u ON rd.player_id = u.id
        WHERE r.code = $1
        ORDER BY rd.joined_at ASC
      `,
      [roomCode]
    );
    return result.rows as Array<{
      id: number;
      username: string;
      symbol: "X" | "O";
    }>;
  },

  // Get players in a room by room id with their assigned symbols
  async getRoomPlayersByRoomId(roomId: number) {
    const result = await query(
      `
        SELECT u.id, u.username, rd.symbol
        FROM room_details rd
        JOIN users u ON rd.player_id = u.id
        WHERE rd.room_id = $1
        ORDER BY rd.joined_at ASC
      `,
      [roomId]
    );
    return result.rows as Array<{
      id: number;
      username: string;
      symbol: "X" | "O";
    }>;
  },

  // Add a player to a room with a symbol
  async addPlayerToRoom(
    roomId: number,
    playerId: number,
    symbol: "X" | "O",
    opponentId?: number
  ) {
    const existing = await query(
      `SELECT id FROM room_details WHERE room_id = $1 AND player_id = $2`,
      [roomId, playerId]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }
    const result = await query(
      `INSERT INTO room_details (room_id, player_id, symbol, opponent_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [roomId, playerId, symbol, opponentId ?? null]
    );
    return result.rows[0];
  },

  // Remove a player from a room
  async removePlayerFromRoom(roomId: number) {
    // Do not delete historical room_details. Instead, mark the room as CLOSED.
    // Keep playerId for signature compatibility and potential auditing.
    await this.setRoomStatus(roomId, "CLOSED");
  },

  // Update room status and optionally closed_at
  async setRoomStatus(roomId: number, status: string) {
    if (status === "CANCELLED" || status === "CLOSED") {
      await query(
        `UPDATE rooms SET status = $1, closed_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [status, roomId]
      );
    } else {
      await query(`UPDATE rooms SET status = $1 WHERE id = $2`, [
        status,
        roomId,
      ]);
    }
  },

  // -------------------- Game persistence helpers --------------------
  async createGame(roomId: number) {
    const result = await query(
      `INSERT INTO games (room_id, result) VALUES ($1, $2) RETURNING *`,
      [roomId, "IN PROGRESS"]
    );
    return result.rows[0] as {
      id: number;
      room_id: number;
      result: string;
      started_at: string;
    };
  },

  async appendMove(gameId: number, playerId: number, position: number) {
    const result = await query(
      `INSERT INTO game_moves (game_id, player_id, position) VALUES ($1, $2, $3) RETURNING *`,
      [gameId, playerId, position]
    );
    return result.rows[0];
  },

  async finalizeGame(
    gameId: number,
    result: "DRAW" | "COMPLETED" | "CANCELLED",
    winnerId?: number | null
  ) {
    const resultRow = await query(
      `UPDATE games SET result = $1, winner = $2, ended_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
      [result, winnerId ?? null, gameId]
    );
    return resultRow.rows[0];
  },

  async getLatestGameByRoomId(roomId: number) {
    const res = await query(
      `SELECT * FROM games WHERE room_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [roomId]
    );
    return res.rows[0] as
      | {
          id: number;
          room_id: number;
          result: string;
          started_at: string;
          ended_at: string | null;
          winner: number | null;
        }
      | undefined;
  },
};

// Export using both CommonJS and ES modules for compatibility
export { query, userService, gameService };
const db = { query, userService, gameService, pool };
export default db;