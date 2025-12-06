import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import http from 'http';
import express from 'express';
import cors from 'cors';
import boardRoutes from '../../../src/routes/boardRoutes.js';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { db } from '../../../src/services/firebase.js';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Load environment variables
dotenv.config();

// Test configuration
const TEST_EMAIL_PREFIX = 'test-board-';
const TEST_PASSWORD = 'testpassword123';

// Track created test users and boards for cleanup
const createdTestUsers: string[] = [];
const createdTestBoards: string[] = [];

// Check if Firebase is properly configured
const isFirebaseConfigured = () => {
  return process.env.FIREBASE_ADMIN_KEY && admin.apps.length > 0 && db !== undefined;
};

// Create Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/boards', boardRoutes);
  return app;
};

// Helper function to make HTTP requests
const makeRequest = (
  app: express.Application,
  method: string,
  path: string,
  data?: any,
  headers?: { [key: string]: string }
) => {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const server = http.createServer(app);
    
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not get server address'));
        return;
      }

      const port = typeof address === 'object' ? address.port : 0;
      
      const options = {
        hostname: 'localhost',
        port: port,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          server.close();
          try {
            const parsedBody = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode || 200, body: parsedBody });
          } catch (error) {
            resolve({ status: res.statusCode || 200, body: body });
          }
        });
      });

      req.on('error', (error) => {
        server.close();
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });

    server.on('error', (error) => {
      reject(error);
    });
  });
};

// Helper function to create a test user and get their ID token
const createTestUserAndGetToken = async (): Promise<{ uid: string; idToken: string; email: string }> => {
  const timestamp = Date.now();
  const email = `${TEST_EMAIL_PREFIX}${timestamp}@example.com`;
  
  // Create user with Admin SDK
  const userRecord = await admin.auth().createUser({
    email,
    password: TEST_PASSWORD,
    emailVerified: true
  });
  
  createdTestUsers.push(userRecord.uid);
  
  // Sign in with client SDK to get ID token
  const auth = getAuth();
  const userCredential = await signInWithEmailAndPassword(auth, email, TEST_PASSWORD);
  const idToken = await userCredential.user.getIdToken();
  
  return { uid: userRecord.uid, idToken, email };
};

describe('Board Routes Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  afterEach(async () => {
    // Clean up created test boards
    if (isFirebaseConfigured() && db) {
      for (const boardId of createdTestBoards) {
        try {
          await db.collection('boards').doc(boardId).delete();
        } catch (error) {
          console.warn(`Failed to delete test board ${boardId}:`, error);
        }
      }
      createdTestBoards.length = 0;
    }

    // Clean up created test users
    if (isFirebaseConfigured()) {
      for (const uid of createdTestUsers) {
        try {
          await admin.auth().deleteUser(uid);
        } catch (error) {
          console.warn(`Failed to delete test user ${uid}:`, error);
        }
      }
      createdTestUsers.length = 0;
    }
  });

  afterAll(async () => {
    // Final cleanup
    if (isFirebaseConfigured() && db) {
      for (const boardId of createdTestBoards) {
        try {
          await db.collection('boards').doc(boardId).delete();
        } catch (error) {
          console.warn(`Failed to delete test board ${boardId}:`, error);
        }
      }
    }

    if (isFirebaseConfigured()) {
      for (const uid of createdTestUsers) {
        try {
          await admin.auth().deleteUser(uid);
        } catch (error) {
          console.warn(`Failed to delete test user ${uid}:`, error);
        }
      }
    }
  });

  describe('POST /api/boards', () => {
    it('should create a board successfully with valid token and title', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      // Create test user and get token
      const { uid, idToken } = await createTestUserAndGetToken();

      // Create board
      const boardData = {
        title: 'My Test Board'
      };

      const response = await makeRequest(
        app,
        'POST',
        '/api/boards',
        boardData,
        { Authorization: `Bearer ${idToken}` }
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        boardId: expect.any(String),
        message: 'Board created successfully'
      });

      // Track for cleanup
      createdTestBoards.push(response.body.boardId);

      // Verify the board was created in Firestore
      if (db) {
        const boardDoc = await db.collection('boards').doc(response.body.boardId).get();
        expect(boardDoc.exists).toBe(true);
        const boardDataFromDb = boardDoc.data();
        expect(boardDataFromDb).toMatchObject({
          title: 'My Test Board',
          ownerId: uid
        });
        expect(boardDataFromDb?.createdAt).toBeDefined();
      }
    });

    it('should return 400 when title is missing', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      // Create test user and get token
      const { idToken } = await createTestUserAndGetToken();

      // Try to create board without title
      const response = await makeRequest(
        app,
        'POST',
        '/api/boards',
        {},
        { Authorization: `Bearer ${idToken}` }
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Title is required and must be a non-empty string'
      });
    });

    it('should return 400 when title is empty string', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      // Create test user and get token
      const { idToken } = await createTestUserAndGetToken();

      // Try to create board with empty title
      const response = await makeRequest(
        app,
        'POST',
        '/api/boards',
        { title: '   ' },
        { Authorization: `Bearer ${idToken}` }
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Title is required and must be a non-empty string'
      });
    });

    it('should return 401 when authorization header is missing', async () => {
      // Try to create board without auth header
      const boardData = {
        title: 'My Test Board'
      };

      const response = await makeRequest(
        app,
        'POST',
        '/api/boards',
        boardData
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Missing or invalid authorization header'
      });
    });

    it('should return 401 when authorization header is malformed', async () => {
      // Try to create board with malformed auth header
      const boardData = {
        title: 'My Test Board'
      };

      const response = await makeRequest(
        app,
        'POST',
        '/api/boards',
        boardData,
        { Authorization: 'InvalidFormat token123' }
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Missing or invalid authorization header'
      });
    });

    it('should return 401 when token is invalid', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      // Try to create board with invalid token
      const boardData = {
        title: 'My Test Board'
      };

      const response = await makeRequest(
        app,
        'POST',
        '/api/boards',
        boardData,
        { Authorization: 'Bearer invalid-token-123' }
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Invalid ID token'
      });
    });

    it('should trim whitespace from board title', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      // Create test user and get token
      const { idToken } = await createTestUserAndGetToken();

      // Create board with whitespace in title
      const boardData = {
        title: '  My Test Board  '
      };

      const response = await makeRequest(
        app,
        'POST',
        '/api/boards',
        boardData,
        { Authorization: `Bearer ${idToken}` }
      );

      expect(response.status).toBe(201);
      createdTestBoards.push(response.body.boardId);

      // Verify the title was trimmed
      if (db) {
        const boardDoc = await db.collection('boards').doc(response.body.boardId).get();
        const boardDataFromDb = boardDoc.data();
        expect(boardDataFromDb?.title).toBe('My Test Board');
      }
    });
  });
});
