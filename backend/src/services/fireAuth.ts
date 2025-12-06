import admin from 'firebase-admin';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, getAuth } from 'firebase/auth';
import type { DocumentData } from 'firebase-admin/firestore';
import { type SessionCreateAccountToken, type SessionToken } from '../datContainers/sessionToken.js';
import { db } from './firebase.js';
import { addedUser } from './dbUserItems.js';
import { DataBaseCollection } from '../datContainers/DataBaseIdentifiers.js';

type UserMetadata = {
  role?: string;
  isAdmin?: boolean;
};

const normalizeRole = (role?: string): string | undefined => {
  if (!role) return undefined;
  return role.toLowerCase();
};

async function fetchUserMetadata(uid: string): Promise<UserMetadata> {
  if (!db) {
    return {};
  }

  try {
    const firestore = db;
    const userDoc = await firestore.collection(DataBaseCollection.USER).doc(uid).get();
    
    if (!userDoc.exists) {
      return {};
    }

    const userData = userDoc.data() ?? {};

    const metadata: UserMetadata = {};
    const rawRole = typeof userData.role === 'string'
      ? userData.role
      : typeof userData.Role === 'string'
        ? userData.Role
        : undefined;

    if (rawRole) {
      metadata.role = rawRole;
    }

    const adminFlag = userData.isAdmin ?? userData.IsAdmin;
    if (typeof adminFlag === 'boolean') {
      metadata.isAdmin = adminFlag;
    }

    return metadata;
  } catch (err) {
    console.warn('Failed to fetch user metadata from Firestore:', err);
    return {};
  }
}

async function upsertUserMetadata(params: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  role?: string;
  isAdmin?: boolean;
}): Promise<void> {
  if (!db) {
    console.warn('Firestore not initialized, skipping user metadata sync');
    return;
  }

  try {
    const firestore = db;
    const { uid, email, displayName, role, isAdmin } = params;
    const updatePayload: Record<string, unknown> = {
      UID: uid,
      uid,
      email,
      Email: email,
      displayName,
      DisplayName: displayName
    };

    if (role) {
      updatePayload.role = role;
      updatePayload.Role = role;
    }

    if (typeof isAdmin === 'boolean') {
      updatePayload.isAdmin = isAdmin;
      updatePayload.IsAdmin = isAdmin;
    }

    // Only write to the capitalized 'Users' collection
    await firestore.collection(DataBaseCollection.USER).doc(uid).set(updatePayload, { merge: true });
  } catch (err) {
    console.warn('Failed to upsert user metadata in Firestore:', err);
  }
}



/**
 * Create a new user account and return session token
 * @param token - User credentials for account creation
 * @returns Promise<SessionToken> - User session information
 * @throws Error with specific Firebase error codes
 */
export async function createAccount(token: SessionCreateAccountToken): Promise<SessionToken> {
  // Validate required fields
  if (!token.email || !token.password) {
    throw new Error('Missing required fields: email and password are required');
  }

  // Check if Firebase Admin is initialized
  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized');
  }

  try {
    // Create user with Firebase Admin SDK
    const userRecord = await admin.auth().createUser({
      email: token.email,
      password: token.password,
      emailVerified: false
    });

    const requestedRole = normalizeRole(token.role) || 'user';
    const isAdmin = requestedRole === 'admin';

    // Upsert user metadata in Firestore
    await upsertUserMetadata({
      uid: userRecord.uid,
      email: userRecord.email || token.email,
      displayName: userRecord.displayName || 'no name user',
      role: requestedRole,
      isAdmin
    });

    // Convert UserRecord to SessionToken format for addedUser
    const sessionToken: SessionToken = {
      email: userRecord.email || token.email,
      displayName: userRecord.displayName || 'no name user',
      UID: userRecord.uid,
      role: requestedRole,
      isAdmin
    };
    
    // Add user to Firestore database (pass the correct isAdmin value)
    await addedUser(sessionToken, isAdmin, true);
    
    // Return session token
    return sessionToken;

  } catch (error: any) {
    console.error('Error creating user:', error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      throw new Error('Email already exists');
    }
    
    if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address');
    }
    
    if (error.code === 'auth/weak-password') {
      throw new Error('Password should be at least 6 characters');
    }

    // Generic error
    throw new Error('Failed to create user account');
  }
}



/**
 * Login a user with email and password using Firebase client SDK
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise<SessionToken> - User session information
 * @throws Error if login fails
 */
export async function loginUser(email: string, password: string): Promise<SessionToken> {
  const auth = getAuth()
  // Validate required fields
  if (!email || !password) {
    throw new Error('Missing required fields: email and password are required');
  }

  if (!auth) {
    throw new Error('Firebase Auth instance is required');
  }

  try {
    // Sign in with email and password using Firebase client SDK
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Fetch Firebase ID token that the frontend can store for API calls
    const token = await user.getIdToken();

    const metadata = await fetchUserMetadata(user.uid);
    const normalizedRole = normalizeRole(metadata.role);
    const resolvedRole = normalizedRole || (metadata.isAdmin ? 'admin' : 'user');
    const isAdmin = metadata.isAdmin ?? resolvedRole === 'admin';

    // Return session token with ID token (token is not stored in DB, only used for API auth)
    return {
      email: user.email || email,
      displayName: user.displayName || 'no name user',
      UID: user.uid,
      token,
      role: resolvedRole,
      isAdmin
    };

  } catch (error: any) {
    console.error('Error logging in user:', error);
    
    // Handle specific Firebase Auth errors
    // Firebase client SDK uses auth/invalid-credential for both user-not-found and wrong-password
    // To distinguish, check if user exists using Admin SDK
    if (error.code === 'auth/invalid-credential') {
      // Check if user exists using Admin SDK to distinguish between user-not-found and wrong-password
      if (admin.apps.length > 0) {
        try {
          await admin.auth().getUserByEmail(email);
          // User exists, so the credential (password) is wrong
          throw new Error('Incorrect password');
        } catch (adminError: any) {
          // If Admin SDK fails with user-not-found, the user doesn't exist
          if (adminError.code === 'auth/user-not-found') {
            throw new Error('User not found');
          }
          // Re-throw if it's our own "Incorrect password" error
          if (adminError.message === 'Incorrect password') {
            throw adminError;
          }
        }
      }
      // Fallback: if Admin SDK not available, assume wrong password
      throw new Error('SDK not Avaible');
    }
    
    if (error.code === 'auth/user-not-found') {
      throw new Error('User not found');
    }
    
    if (error.code === 'auth/wrong-password') {
      throw new Error('Incorrect password');
    }
    
    if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address');
    }
    
    if (error.code === 'auth/user-disabled') {
      throw new Error('User account is disabled');
    }

    // Generic error
    throw new Error('Failed to login user');
  }
}



/**
 * Logout a user using Firebase client SDK
 * @returns Promise<void>
 * @throws Error if logout fails
 */
export async function logoutUser(): Promise<void> {
  const auth = getAuth()
  if (!auth) {
    throw new Error('Firebase Auth instance is required');
  }

  try {
    // Sign out the current user using Firebase client SDK
    await signOut(auth);
    console.log('User logged out successfully');

  } catch (error: any) {
    console.error('Error logging out user:', error);
    throw new Error('Failed to logout user');
  }
}

/**
 * Verify a user's ID token and get user information
 * @param idToken - Firebase ID token
 * @returns Promise<SessionToken> - User session information
 * @throws Error if token verification fails
 */
export async function verifyUserToken(idToken: string): Promise<SessionToken> {
  // Validate required fields
  if (!idToken) {
    throw new Error('Missing required field: idToken is required');
  }

  // Check if Firebase Admin is initialized
  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized');
  }

  try {
    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Get user record
    const userRecord = await admin.auth().getUser(decodedToken.uid);

    const metadata = await fetchUserMetadata(userRecord.uid);
    const normalizedRole = normalizeRole(metadata.role);
    const resolvedRole = normalizedRole || (metadata.isAdmin ? 'admin' : 'user');
    const isAdmin = metadata.isAdmin ?? resolvedRole === 'admin';

    // Return session token
    return {
      email: userRecord.email || '',
      displayName: userRecord.displayName || 'no name user',
      UID: userRecord.uid,
      role: resolvedRole,
      isAdmin
    };

  } catch (error: any) {
    console.error('Error verifying user token:', error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/invalid-id-token' || error.code === 'auth/argument-error') {
      throw new Error('Invalid ID token');
    }
    
    if (error.code === 'auth/id-token-expired') {
      throw new Error('ID token has expired');
    }

    // Generic error
    throw new Error('Failed to verify user token');
  }
}

type UpdateUserRoleParams = {
  uid?: string;
  email?: string;
  role: string;
};

/**
 * Update an existing user's role/admin flag using Firebase Admin SDK
 * @param params.uid - User UID (preferred). If not provided, email is required.
 * @param params.email - User email if UID is not known.
 * @param params.role - Desired role value (e.g., "admin", "user").
 */
export async function updateUserRole(params: UpdateUserRoleParams): Promise<SessionToken> {
  const { uid, email, role } = params;
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    throw new Error('Role is required');
  }

  if (!uid && !email) {
    throw new Error('Either uid or email must be provided');
  }

  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized');
  }

  const isAdmin = normalizedRole === 'admin';

  try {
    const userRecord = uid
      ? await admin.auth().getUser(uid)
      : await admin.auth().getUserByEmail(email as string);

    await upsertUserMetadata({
      uid: userRecord.uid,
      email: userRecord.email ?? email ?? null,
      displayName: userRecord.displayName || 'no name user',
      role: normalizedRole,
      isAdmin
    });

    return {
      email: userRecord.email || '',
      displayName: userRecord.displayName || 'no name user',
      UID: userRecord.uid,
      role: normalizedRole,
      isAdmin
    };
  } catch (err: any) {
    console.error('Failed to update user role:', err);

    if (err.code === 'auth/user-not-found') {
      throw new Error('User not found');
    }

    throw new Error('Failed to update user role');
  }
}
