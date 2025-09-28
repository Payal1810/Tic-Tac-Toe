import bcrypt from "bcryptjs";
import { query } from "../lib/db.mjs";
import {
  validateUsername,
  validateEmail,
  validatePassword,
  sanitizeInput,
} from "../lib/validation";

interface User {
  id: number;
  username: string;
  email: string;
  coins: number;
  created_at: string;
}

interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

interface RegisterResult {
  success: boolean;
  user?: User;
  error?: string;
}

export class AuthService {
  async register(
    username: string,
    email: string,
    password: string
  ): Promise<RegisterResult> {
    try {
      // Sanitize inputs
      const cleanUsername = sanitizeInput(username);
      const cleanEmail = sanitizeInput(email);

      // Validate inputs
      const usernameValidation = validateUsername(cleanUsername);
      if (!usernameValidation.success) {
        return { success: false, error: usernameValidation.error };
      }

      const emailValidation = validateEmail(cleanEmail);
      if (!emailValidation.success) {
        return { success: false, error: emailValidation.error };
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.success) {
        return { success: false, error: passwordValidation.error };
      }

      // Check if user already exists
      const existingUser = await query(
        "SELECT id FROM users WHERE username = $1 OR email = $2",
        [cleanUsername, cleanEmail]
      );

      if (existingUser.rows.length > 0) {
        return { success: false, error: "Username or email already exists" };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const result = await query(
        "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, coins, created_at",
        [cleanUsername, cleanEmail, hashedPassword]
      );

      const user = result.rows[0] as User;
      return { success: true, user };
    } catch (error) {
      console.error("Registration error:", error);
      return {
        success: false,
        error: "Registration failed. Please try again.",
      };
    }
  }

  async login(username: string, password: string): Promise<LoginResult> {
    try {
      // Sanitize input
      const cleanUsername = sanitizeInput(username);

      // Validate inputs
      const usernameValidation = validateUsername(cleanUsername);
      if (!usernameValidation.success) {
        return { success: false, error: "Invalid credentials" };
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.success) {
        return { success: false, error: "Invalid credentials" };
      }

      // Find user
      const result = await query("SELECT * FROM users WHERE username = $1", [
        cleanUsername,
      ]);

      if (result.rows.length === 0) {
        return { success: false, error: "Invalid credentials" };
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return { success: false, error: "Invalid credentials" };
      }

      // Update last login
      await query(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
        [user.id]
      );

      // Return user without password
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = user;
      return { success: true, user: userWithoutPassword as User };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Login failed. Please try again." };
    }
  }

  async getUserById(userId: number): Promise<User | null> {
    try {
      const result = await query(
        "SELECT id, username, email, coins, created_at FROM users WHERE id = $1",
        [userId]
      );
      return (result.rows[0] as User) || null;
    } catch (error) {
      console.error("Get user error:", error);
      return null;
    }
  }
}