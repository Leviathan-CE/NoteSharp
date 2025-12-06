import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import http from 'http';
import express from 'express';
import cors from 'cors';
import fireAuthRoutes from '../../../src/routes/fireAuthRoutes.js';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
// Import firebase service to ensure Firebase is initialized
import '../../../src/services/firebase.js';

// Load environment variables
dotenv.config();

// Test configuration
const TEST_EMAIL_PREFIX = 'test-';
const TEST_PASSWORD = 'testpassword123';

// Track created test users for cleanup
const createdTestUsers: string[] = [];

// Check if Firebase is properly configured
const isFirebaseConfigured = () => {
  return process.env.FIREBASE_ADMIN_KEY && admin.apps.length > 0;
};

// Create Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', fireAuthRoutes);
  return app;
};

// Helper function to make HTTP requests
const makeRequest = (app: express.Application, method: string, path: string, data?: any) => {
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

describe('FireAuth Routes Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  afterEach(async () => {
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

  describe('POST /api/auth/create-account', () => {
    it('should create a user successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const timestamp = Date.now();
      const userData = {
        email: `${TEST_EMAIL_PREFIX}${timestamp}@example.com`,
        password: TEST_PASSWORD
      };

      const response = await makeRequest(app, 'POST', '/api/auth/create-account', userData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'Account created successfully',
        user: {
          email: userData.email,
          displayName: 'no name user',
          UID: expect.any(String)
        }
      });

      // Track for cleanup
      createdTestUsers.push(response.body.user.UID);
    });

    it('should return 400 when email is missing', async () => {
      const userData = {
        password: TEST_PASSWORD
      };

      const response = await makeRequest(app, 'POST', '/api/auth/create-account', userData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Email and password are required'
      });
    });

    it('should return 400 when password is missing', async () => {
      const userData = {
        email: 'test@example.com'
      };

      const response = await makeRequest(app, 'POST', '/api/auth/create-account', userData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Email and password are required'
      });
    });

    it('should return 400 when email already exists', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const timestamp = Date.now();
      const userData = {
        email: `${TEST_EMAIL_PREFIX}${timestamp}@example.com`,
        password: TEST_PASSWORD
      };

      // Create user first time
      const createResponse = await makeRequest(app, 'POST', '/api/auth/create-account', userData);
      expect(createResponse.status).toBe(201);
      createdTestUsers.push(createResponse.body.user.UID);

      // Try to create same user again
      const duplicateResponse = await makeRequest(app, 'POST', '/api/auth/create-account', userData);

      expect(duplicateResponse.status).toBe(400);
      expect(duplicateResponse.body).toEqual({
        error: 'Email already exists'
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login a user successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const timestamp = Date.now();
      const userData = {
        email: `${TEST_EMAIL_PREFIX}${timestamp}@example.com`,
        password: TEST_PASSWORD
      };

      // Create user first
      const createResponse = await makeRequest(app, 'POST', '/api/auth/create-account', userData);
      expect(createResponse.status).toBe(201);
      createdTestUsers.push(createResponse.body.user.UID);

      // Test login
      const loginResponse = await makeRequest(app, 'POST', '/api/auth/login', userData);

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body).toEqual({
        message: 'Login successful',
        user: {
          email: userData.email,
          displayName: 'no name user',
          UID: createResponse.body.user.UID,
          token: expect.any(String) // Token is now part of SessionToken interface
        }
      });
    });

    it('should return 400 when email is missing', async () => {
      const userData = {
        password: TEST_PASSWORD
      };

      const response = await makeRequest(app, 'POST', '/api/auth/login', userData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Email and password are required'
      });
    });

    it('should return 400 when password is missing', async () => {
      const userData = {
        email: 'test@example.com'
      };

      const response = await makeRequest(app, 'POST', '/api/auth/login', userData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Email and password are required'
      });
    });

    it('should return 401 for non-existent user', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const userData = {
        email: 'nonexistent@example.com',
        password: TEST_PASSWORD
      };

      const response = await makeRequest(app, 'POST', '/api/auth/login', userData);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'User not found'
      });
    });

    it('should return 401 for wrong password', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const timestamp = Date.now();
      const userData = {
        email: `${TEST_EMAIL_PREFIX}${timestamp}@example.com`,
        password: TEST_PASSWORD
      };

      // Create user first
      const createResponse = await makeRequest(app, 'POST', '/api/auth/create-account', userData);
      expect(createResponse.status).toBe(201);
      createdTestUsers.push(createResponse.body.user.UID);

      // Test wrong password
      const wrongPasswordData = {
        email: userData.email,
        password: 'wrongpassword'
      };

      const response = await makeRequest(app, 'POST', '/api/auth/login', wrongPasswordData);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Incorrect password'
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await makeRequest(app, 'POST', '/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Logout successful'
      });
    });
  });

  describe('POST /api/auth/verify-token', () => {
    it('should verify a valid token successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      // Note: To test ID token verification properly, we would need to:
      // 1. Use Firebase Client SDK to login a user
      // 2. Get the ID token from the signed-in user
      // This is complex to set up in a backend route test, so we skip this test
      // The verify-token endpoint is tested in the service-level tests instead
      console.log('Skipping ID token verification test - requires client SDK setup');
      return;
    });

    it('should return 400 when idToken is missing', async () => {
      const response = await makeRequest(app, 'POST', '/api/auth/verify-token', {});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'ID token is required'
      });
    });

    it('should return 401 for invalid token', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const response = await makeRequest(app, 'POST', '/api/auth/verify-token', { idToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Invalid ID token'
      });
    });
  });
});
