// Mock Firebase for development without Firebase config
// Using backend API instead of Firebase directly
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

export const auth: Auth | null = null;
export const db: Firestore | null = null;

// Note: Using API-based hooks instead of Firebase realtime
