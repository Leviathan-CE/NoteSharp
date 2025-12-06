import type { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import type { DocumentData } from 'firebase-admin/firestore';
import { db } from '../services/firebase.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        role: string;
        email?: string | undefined;
      };
    }
  }
}

/**
 * Middleware to verify if user is an admin
 * Checks Firebase ID token and verifies role from Firestore
 */
export async function verifyAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1]?.trim();
    if (!idToken) {
      return res.status(401).json({ error: 'Missing ID token' });
    }

    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const firestore = db ?? admin.firestore();
    const collectionsToCheck = ['Users', 'users'];

    let userData: DocumentData | undefined;
    for (const collectionName of collectionsToCheck) {
      const snapshot = await firestore.collection(collectionName).doc(uid).get();
      if (snapshot.exists) {
        userData = snapshot.data() ?? {};
        break;
      }
    }
    
    if (!userData) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    const rawRole = typeof userData?.role === 'string'
      ? userData.role
      : typeof userData?.Role === 'string'
        ? userData.Role
        : undefined;
    const normalizedRole = rawRole ? rawRole.toLowerCase() : undefined;
    const adminFlag = userData?.isAdmin ?? userData?.IsAdmin;
    const isAdmin = typeof adminFlag === 'boolean' ? adminFlag : normalizedRole === 'admin';

    // Check if user has admin role
    if (!isAdmin) {
      return res.status(403).json({ error: 'Access denied: Admin privileges required' });
    }

    // Attach user info to request for use in routes
    req.user = {
      uid,
      role: 'admin',
      email: decodedToken.email
    };

    next();
  } catch (error: any) {
    console.error('Admin verification error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    if (error.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware to verify any authenticated user
 * Does not check for admin role
 */
export async function verifyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1]?.trim();
    if (!idToken) {
      return res.status(401).json({ error: 'Missing ID token' });
    }

    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      role: 'user', // Default, will be updated if we fetch from DB
      email: decodedToken.email
    };

    next();
  } catch (error: any) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
