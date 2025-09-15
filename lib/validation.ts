// Validation types
interface ValidationResult {
    success: boolean;
    error?: string;
  }
  
  // Input sanitization
  export function sanitizeInput(input: string): string {
    if (typeof input !== "string") return "";
    return input.trim().replace(/[<>]/g, "");
  }
  
  // Username validation
  export function validateUsername(username: string): ValidationResult {
    if (!username || username.length < 3) {
      return {
        success: false,
        error: "Username must be at least 3 characters long",
      };
    }
  
    if (username.length > 20) {
      return {
        success: false,
        error: "Username must be less than 20 characters",
      };
    }
  
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return {
        success: false,
        error: "Username can only contain letters, numbers, and underscores",
      };
    }
  
    return { success: true };
  }
  
  // Email validation
  export function validateEmail(email: string): ValidationResult {
    if (!email) {
      return { success: false, error: "Email is required" };
    }
  
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: "Please enter a valid email address" };
    }
  
    if (email.length > 100) {
      return { success: false, error: "Email must be less than 100 characters" };
    }
  
    return { success: true };
  }
  
  // Password validation
  export function validatePassword(password: string): ValidationResult {
    if (!password) {
      return { success: false, error: "Password is required" };
    }
  
    if (password.length < 6) {
      return {
        success: false,
        error: "Password must be at least 6 characters long",
      };
    }
  
    if (password.length > 128) {
      return {
        success: false,
        error: "Password must be less than 128 characters",
      };
    }
  
    return { success: true };
  }
  
  // Room code validation
  export function validateRoomCode(roomCode: string): ValidationResult {
    if (!roomCode) {
      return { success: false, error: "Room code is required" };
    }
  
    if (roomCode.length < 1 || roomCode.length > 20) {
      return {
        success: false,
        error: "Room code must be between 1 and 20 characters",
      };
    }
  
    if (!/^[a-zA-Z0-9]+$/.test(roomCode)) {
      return {
        success: false,
        error: "Room code can only contain letters and numbers",
      };
    }
  
    return { success: true };
  }
  
  // Message validation
  export function validateMessage(message: string): ValidationResult {
    if (!message || !message.trim()) {
      return { success: false, error: "Message cannot be empty" };
    }
  
    if (message.length > 500) {
      return {
        success: false,
        error: "Message must be less than 500 characters",
      };
    }
  
    return { success: true };
  }