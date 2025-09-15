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
  console.log(":white_check_mark: Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error(":x: Unexpected error on idle client", err);
});

// Helper function to execute queries
const query = async (text: string, params?: any[]) => {
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

      console.log(`:white_check_mark: New user registered: ${username}`);
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
      const result = await query(
        "SELECT * FROM users WHERE username = $1",
        [username]
      );

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

      console.log(`:white_check_mark: User logged in: ${username}`);

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          coins: user.coins
        }
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
  }
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
      console.log(`:white_check_mark: Created new room: ${roomCode}`);
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

      console.log(`:speech_balloon: Message saved: User ${userId} in room ${roomCode}`);
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
};

// Export using both CommonJS and ES modules for compatibility
export { query, userService, gameService };
export default { query, userService, gameService, pool };