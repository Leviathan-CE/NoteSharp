/**
 * Mock Authentication Service
 * Temporary authentication system for development/testing without Firebase
 */

import { type SessionToken } from "../datContainers/sessionToken.js";

// In-memory user store (resets on server restart)
const users = new Map<string, { email: string; password: string; uid: string }>();

// In-memory session tokens
const sessions = new Map<string, SessionToken>();

/**
 * Generate a simple mock UID
 */
function generateUID(): string {
  return `mock-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a mock session token
 */
function generateToken(uid: string): string {
  return `mock-token-${uid}-${Date.now()}`;
}

/**
 * Create a new user account
 */
export async function createMockAccount(email: string, password: string): Promise<SessionToken & { token: string }> {
  // Check if user already exists
  if (users.has(email)) {
    throw new Error("User already exists");
  }

  // Validate email format
  if (!email.includes("@")) {
    throw new Error("Invalid email format");
  }

  // Validate password length
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  // Create user
  const uid = generateUID();
  users.set(email, { email, password, uid });

  // Create session
  const token = generateToken(uid);
  const sessionToken: SessionToken = {
    email,
    displayName: email.split("@")[0] || email,
    UID: uid,
  };

  sessions.set(token, sessionToken);

  console.log(`✅ Mock user created: ${email} (${uid})`);

  return { ...sessionToken, token };
}

/**
 * Login user
 */
export async function loginMockUser(email: string, password: string): Promise<SessionToken & { token: string }> {
  const user = users.get(email);

  if (!user) {
    throw new Error("User not found");
  }

  if (user.password !== password) {
    throw new Error("Invalid password");
  }

  // Create session
  const token = generateToken(user.uid);
  const sessionToken: SessionToken = {
    email: user.email,
    displayName: user.email.split("@")[0] || user.email,
    UID: user.uid,
  };

  sessions.set(token, sessionToken);

  console.log(`✅ Mock user logged in: ${email} with token: ${token}`);

  return { ...sessionToken, token };
}

/**
 * Verify token
 */
export async function verifyMockToken(token: string): Promise<SessionToken> {
  const session = sessions.get(token);

  if (!session) {
    throw new Error("Invalid or expired token");
  }

  return session;
}

/**
 * Logout user
 */
export async function logoutMockUser(token?: string): Promise<void> {
  if (token) {
    sessions.delete(token);
  }
  console.log("✅ Mock user logged out");
}

/**
 * Get all users (for debugging)
 */
export function getMockUsers() {
  return Array.from(users.values()).map(u => ({ email: u.email, uid: u.uid }));
}
