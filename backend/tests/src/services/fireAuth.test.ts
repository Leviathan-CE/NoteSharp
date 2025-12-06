import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createAccount, loginUser, logoutUser, verifyUserToken } from '../../../src/services/fireAuth.js';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

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

describe('FireAuth Integration Tests', () => {
  beforeEach(() => {
    // Skip tests if Firebase is not configured
    if (!isFirebaseConfigured()) {
      console.warn('Firebase not configured - skipping integration tests');
    }
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

  describe('createAccount Function', () => {
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

      const result = await createAccount(userData);

      expect(result).toEqual({
        email: userData.email,
        displayName: 'no name user',
        UID: expect.any(String)
      });

      // Track for cleanup
      createdTestUsers.push(result.UID);
    });

    it('should throw error when email is missing', async () => {
      const userData = {
        password: TEST_PASSWORD
      };

      await expect(createAccount(userData as any)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when password is missing', async () => {
      const userData = {
        email: 'test@example.com'
      };

      await expect(createAccount(userData as any)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when email already exists', async () => {
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
      const result = await createAccount(userData);
      createdTestUsers.push(result.UID);

      // Try to create same user again
      await expect(createAccount(userData)).rejects.toThrow('Email already exists');
    });
  });

  describe('loginUser Function', () => {
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
      const createResult = await createAccount(userData);
      createdTestUsers.push(createResult.UID);

      // Test login
      const loginResult = await loginUser(userData.email, userData.password);

      expect(loginResult).toEqual({
        email: userData.email,
        displayName: 'no name user',
        UID: createResult.UID,
        token: expect.any(String) // Token is now part of SessionToken interface
      });
    });

    it('should throw error for non-existent user', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      await expect(loginUser('nonexistent@example.com', TEST_PASSWORD))
        .rejects.toThrow('User not found');
    });

    it('should throw error for wrong password', async () => {
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
      const createResult = await createAccount(userData);
      createdTestUsers.push(createResult.UID);

      // Test wrong password
      await expect(loginUser(userData.email, 'wrongpassword'))
        .rejects.toThrow('Incorrect password');
    });
  });

  describe('logoutUser Function', () => {
    it('should logout a user successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const timestamp = Date.now();
      const userData = {
        email: `${TEST_EMAIL_PREFIX}${timestamp}@example.com`,
        password: TEST_PASSWORD
      };

      // Create and login user first
      const createResult = await createAccount(userData);
      createdTestUsers.push(createResult.UID);

      const loginResult = await loginUser(userData.email, userData.password);
      expect(loginResult.UID).toBe(createResult.UID);

      // Test logout - should not throw
      await expect(logoutUser()).resolves.not.toThrow();
    });

    it('should handle logout when no user is logged in', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      // Test logout when no user is logged in - should not throw
      await expect(logoutUser()).resolves.not.toThrow();
    });
  });

  describe('verifyUserToken Function', () => {
    it('should verify a valid token', async () => {
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
      const createResult = await createAccount(userData);
      createdTestUsers.push(createResult.UID);

      // Login to get a valid ID token
      const loginResult = await loginUser(userData.email, userData.password);
      
      // Verify the ID token from login
      const verifyResult = await verifyUserToken(loginResult.token!);

      expect(verifyResult).toEqual({
        email: userData.email,
        displayName: 'no name user',
        UID: createResult.UID
      });
    });

    it('should throw error for invalid token', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      await expect(verifyUserToken('invalid-token'))
        .rejects.toThrow('Invalid ID token');
    });
  });
});
