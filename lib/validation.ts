import * as yup from "yup";

// Validation types
interface ValidationResult {
  success: boolean;
  error?: string;
}

// Input sanitization
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") return "";
  // Remove angle brackets < and > to prevent XSS (Cross-Site Scripting) attacks
  return input.trim().replace(/[<>]/g, "");
}

// Yup validation schemas
const usernameSchema = yup
  .string()
  .required("Username is required")
  .min(3, "Username must be at least 3 characters long")
  .max(20, "Username must be less than 20 characters")
  .matches(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores"
  );

// Username validation
export function validateUsername(username: string): ValidationResult {
  try {
    usernameSchema.validateSync(username);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof yup.ValidationError
          ? error.message
          : "Invalid username",
    };
  }
}

const emailSchema = yup
  .string()
  .required("Email is required")
  .email("Please enter a valid email address")
  .max(100, "Email must be less than 100 characters");

// Email validation
export function validateEmail(email: string): ValidationResult {
  try {
    emailSchema.validateSync(email);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof yup.ValidationError ? error.message : "Invalid email",
    };
  }
}

const passwordSchema = yup
  .string()
  .required("Password is required")
  .min(6, "Password must be at least 6 characters long")
  .max(128, "Password must be less than 128 characters");

// Password validation
export function validatePassword(password: string): ValidationResult {
  try {
    passwordSchema.validateSync(password);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof yup.ValidationError
          ? error.message
          : "Invalid password",
    };
  }
}

const roomCodeSchema = yup
  .string()
  .required("Room code is required")
  .min(1, "Room code must be between 1 and 20 characters")
  .max(20, "Room code must be between 1 and 20 characters")
  .matches(/^[a-zA-Z0-9]+$/, "Room code can only contain letters and numbers");

// Room code validation
export function validateRoomCode(roomCode: string): ValidationResult {
  try {
    roomCodeSchema.validateSync(roomCode);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof yup.ValidationError
          ? error.message
          : "Invalid room code",
    };
  }
}

const messageSchema = yup
  .string()
  .required("Message cannot be empty")
  .test(
    "not-empty",
    "Message cannot be empty",
    (value) => value?.trim().length > 0
  )
  .max(500, "Message must be less than 500 characters");

// Message validation
export function validateMessage(message: string): ValidationResult {
  try {
    messageSchema.validateSync(message);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof yup.ValidationError
          ? error.message
          : "Invalid message",
    };
  }
}