import admin from "firebase-admin";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import dotenv from "dotenv";
dotenv.config();

// Safely parse and initialize Firebase Admin (server) and Firebase (client) SDKs
let adminInitialized = false;
let firebaseApp: any = undefined;

if (process.env.FIREBASE_ADMIN_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY as string);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    adminInitialized = true;
  } catch (err) {
    // Don't throw — log and continue so local dev without creds still runs
    console.warn("Invalid FIREBASE_ADMIN_KEY, skipping admin initialization:", (err as Error).message);
  }
} else {
  console.warn("FIREBASE_ADMIN_KEY not set — Firebase Admin not initialized");
}

const clientConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
};

const hasClientConfig = Boolean(clientConfig.apiKey && clientConfig.projectId);
if (hasClientConfig) {
  try {
    firebaseApp = initializeApp(clientConfig as any);
  } catch (err) {
    console.warn("Failed to initialize Firebase client app:", (err as Error).message);
  }
} else {
  console.warn("Firebase client env vars not set — skipping client SDK initialization");
}

// Export db and auth safely. They may be undefined in local/dev without envs.
export let db: Firestore | undefined = undefined;
export let auth: any = undefined;

try {
  if (adminInitialized) {
    db = getFirestore();
  }
} catch (err) {
  console.warn("getFirestore() failed:", (err as Error).message);
}

try {
  if (firebaseApp) {
    auth = getAuth(firebaseApp);
  }
} catch (err) {
  console.warn("getAuth() failed:", (err as Error).message);
}
