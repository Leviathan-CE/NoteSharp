import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import http from 'http';
import express from 'express';
import cors from 'cors';
import permissionRoutes from '../../../src/routes/PermissionRoutes.js';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { addedUser, createDefaultRootBoard, DataBaseidentifiers } from '../../../src/services/dbUserItems.js';
import { AdduserPermission } from '../../../src/services/dbPermissions.js';
import { Permision } from '../../../src/datContainers/dataTypes.js';
import type { SessionToken } from '../../../src/datContainers/sessionToken.js';
import type { User } from 'firebase/auth';

// Import firebase service to ensure Firebase is initialized
import '../../../src/services/firebase.js';

// Load environment variables
dotenv.config();

// Test configuration
const TEST_EMAIL_PREFIX = 'test-perm-';
const TEST_PASSWORD = 'testpassword123';

// Track created test data for cleanup
const createdTestUsers: string[] = [];
const createdBoardIds: string[] = [];
const createdPermissionIds: string[] = [];

// Check if Firebase is properly configured
const isFirebaseConfigured = () => {
  return process.env.FIREBASE_ADMIN_KEY && admin.apps.length > 0;
};

// Create Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(cors());
  
  // Custom body parser that works for all HTTP methods including GET and DELETE
  app.use((req, res, next) => {
    // Initialize req.body
    req.body = req.body || {};
    
    // Only parse if Content-Type is application/json and there's content-length
    const contentType = req.headers['content-type'];
    const contentLength = req.headers['content-length'];
    
    if (contentType === 'application/json' && contentLength && parseInt(contentLength) > 0) {
      let body = '';
      let hasData = false;
      
      // Collect data chunks
      req.on('data', (chunk) => {
        hasData = true;
        body += chunk.toString('utf8');
      });
      
      req.on('end', () => {
        if (hasData && body) {
          try {
            req.body = JSON.parse(body);
          } catch (e) {
            req.body = {};
          }
        }
        next();
      });
      
      req.on('error', (err) => {
        req.body = {};
        next();
      });
    } else {
      // No body to parse, continue immediately
      next();
    }
  });
  
  // Also use standard Express JSON parser for POST, PUT, PATCH
  app.use(express.json());
  
  app.use('/api/permissions', permissionRoutes);
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
      
      // Prepare request data
      const requestBody = data ? JSON.stringify(data) : '';
      const contentLength = Buffer.byteLength(requestBody, 'utf8');
      
      const options = {
        hostname: 'localhost',
        port: port,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': contentLength,
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

      if (data && requestBody) {
        req.write(requestBody);
      }
      req.end();
    });

    server.on('error', (error) => {
      reject(error);
    });
  });
};

// Helper function to create a test user
async function createTestUser(email: string): Promise<{ userRecord: admin.auth.UserRecord; sessionToken: SessionToken }> {
  const userRecord = await admin.auth().createUser({
    email: email,
    password: TEST_PASSWORD,
    emailVerified: false
  });

  // Convert to SessionToken format (UID uppercase) for addedUser
  const sessionToken: SessionToken = {
    email: userRecord.email || email,
    displayName: 'Test User',
    UID: userRecord.uid
  };

  await addedUser(sessionToken, false, false);

  createdTestUsers.push(userRecord.uid);
  return { userRecord, sessionToken };
}

describe('Permission Routes Integration Tests', () => {
  let app: express.Application;
  let ownerSessionToken: SessionToken;
  let userSessionToken: SessionToken;
  let testBoardId: string;

  beforeAll(async () => {
    app = createTestApp();

    if (!isFirebaseConfigured()) {
      console.log('Skipping tests - Firebase not configured');
      return;
    }

    // Create owner user
    const ownerEmail = `${TEST_EMAIL_PREFIX}owner${Date.now()}@example.com`;
    const ownerData = await createTestUser(ownerEmail);
    ownerSessionToken = ownerData.sessionToken;

    // Create a test board for the owner
    testBoardId = await createDefaultRootBoard(ownerSessionToken);
    createdBoardIds.push(testBoardId);

    // Create another user for permission tests
    const userEmail = `${TEST_EMAIL_PREFIX}user${Date.now()}@example.com`;
    const userData = await createTestUser(userEmail);
    userSessionToken = userData.sessionToken;
  });

  afterEach(async () => {
    // Clean up created test data after each test
    if (isFirebaseConfigured()) {
      const db = admin.firestore();
      
      // Delete permission documents
      for (const permissionId of createdPermissionIds) {
        try {
          await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permissionId).delete();
        } catch (error) {
          // Permission might not exist, ignore
        }
      }
      createdPermissionIds.length = 0;

      // Clean up items in test boards (but keep the boards themselves)
      for (const boardId of createdBoardIds) {
        try {
          const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId);
          const itemsRef = boardRef.collection(DataBaseidentifiers.ITEMS);
          const itemsSnapshot = await itemsRef.get();
          
          const deletePromises = itemsSnapshot.docs.map(doc => doc.ref.delete());
          await Promise.all(deletePromises);
        } catch (error) {
          // Ignore errors
        }
      }
    }
  });

  afterAll(async () => {
    // Comprehensive cleanup of all test data
    if (isFirebaseConfigured()) {
      const db = admin.firestore();

      // 1. Clean up all permissions (including any that might have been missed)
      for (const permissionId of createdPermissionIds) {
        try {
          await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permissionId).delete();
        } catch (error) {
          // Permission might not exist, ignore
        }
      }

      // Safety cleanup: Remove any permissions associated with test boards
      for (const boardId of createdBoardIds) {
        try {
          const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
          if (boardDoc.exists) {
            const boardData = boardDoc.data();
            const permissions = boardData?.permissions || [];
            for (const permissionId of permissions) {
              try {
                await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permissionId).delete();
              } catch (error) {
                // Permission might not exist, ignore
              }
            }
          }
        } catch (error) {
          // Ignore errors
        }
      }

      // 2. Clean up all boards and their items
      for (const boardId of createdBoardIds) {
        try {
          const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId);
          
          // Delete all items in the board's ITEMS subcollection
          const itemsRef = boardRef.collection(DataBaseidentifiers.ITEMS);
          const itemsSnapshot = await itemsRef.get();
          const deleteItemPromises = itemsSnapshot.docs.map(doc => doc.ref.delete());
          await Promise.all(deleteItemPromises);
          
          // Delete the board document itself
          await boardRef.delete();
        } catch (error) {
          // Board might not exist, ignore
        }
      }

      // Safety cleanup: Remove any remaining boards owned by test users
      for (const uid of createdTestUsers) {
        try {
          const boardsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
            .where('owner', '==', uid)
            .get();
          
          for (const boardDoc of boardsSnapshot.docs) {
            try {
              const boardRef = boardDoc.ref;
              // Delete all items in the board
              const itemsRef = boardRef.collection(DataBaseidentifiers.ITEMS);
              const itemsSnapshot = await itemsRef.get();
              const deleteItemPromises = itemsSnapshot.docs.map(doc => doc.ref.delete());
              await Promise.all(deleteItemPromises);
              
              // Delete the board
              await boardRef.delete();
            } catch (error) {
              // Ignore errors
            }
          }
        } catch (error) {
          // Ignore errors
        }
      }

      // 3. Clean up all test users (Firestore documents and Auth users)
      for (const uid of createdTestUsers) {
        try {
          // Delete user document from Firestore
          await db.collection(DataBaseidentifiers.USER).doc(uid).delete();
          
          // Delete user from Firebase Auth
          await admin.auth().deleteUser(uid);
        } catch (error) {
          // User might not exist, ignore
        }
      }

      // Safety cleanup: Remove any remaining permissions for test users
      for (const uid of createdTestUsers) {
        try {
          const permissionsSnapshot = await db.collection(DataBaseidentifiers.USER_PERMISSION)
            .where('userId', '==', uid)
            .get();
          
          for (const permissionDoc of permissionsSnapshot.docs) {
            try {
              await permissionDoc.ref.delete();
            } catch (error) {
              // Ignore errors
            }
          }
        } catch (error) {
          // Ignore errors
        }
      }

      // Clear tracking arrays
      createdTestUsers.length = 0;
      createdBoardIds.length = 0;
      createdPermissionIds.length = 0;
    }
  });

  describe('POST /api/permissions/add-permission', () => {
    it('should add a VIEW permission successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const requestData = {
        user: userSessionToken,
        permission: Permision.VIEW,
        boardId: testBoardId
      };

      const response = await makeRequest(app, 'POST', '/api/permissions/add-permission', requestData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Permission added successfully');
      expect(response.body.permission).toBeDefined();
      expect(response.body.permission.permission).toBe(Permision.VIEW);
      expect(response.body.permission.boardId).toBe(testBoardId);
      expect(response.body.permission.userId).toBe(userSessionToken.UID);

      // Track for cleanup
      if (response.body.permission.permissionId) {
        createdPermissionIds.push(response.body.permission.permissionId);
      }
    });

    it('should add an EDIT permission successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const requestData = {
        user: userSessionToken,
        permission: Permision.EDIT,
        boardId: testBoardId
      };

      const response = await makeRequest(app, 'POST', '/api/permissions/add-permission', requestData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Permission added successfully');
      expect(response.body.permission.permission).toBe(Permision.EDIT);

      // Track for cleanup
      if (response.body.permission.permissionId) {
        createdPermissionIds.push(response.body.permission.permissionId);
      }
    });

    it('should return 400 when user is missing', async () => {
      const requestData = {
        permission: Permision.VIEW,
        boardId: testBoardId
      };

      const response = await makeRequest(app, 'POST', '/api/permissions/add-permission', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User session token with UID is required');
    });

    it('should return 400 when permission is missing', async () => {
      const requestData = {
        user: userSessionToken,
        boardId: testBoardId
      };

      const response = await makeRequest(app, 'POST', '/api/permissions/add-permission', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Permission type is required');
    });

    it('should return 400 when boardId is missing', async () => {
      const requestData = {
        user: userSessionToken,
        permission: Permision.VIEW
      };

      const response = await makeRequest(app, 'POST', '/api/permissions/add-permission', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Board ID is required');
    });

    it('should return 400 when trying to add OWNER permission', async () => {
      const requestData = {
        user: userSessionToken,
        permission: Permision.OWNER,
        boardId: testBoardId
      };

      const response = await makeRequest(app, 'POST', '/api/permissions/add-permission', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('OWNER permission cannot be added');
    });

    it('should return 400 for invalid permission type', async () => {
      const requestData = {
        user: userSessionToken,
        permission: 'invalid',
        boardId: testBoardId
      };

      const response = await makeRequest(app, 'POST', '/api/permissions/add-permission', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Permission must be either');
    });
  });

  describe('PUT /api/permissions/change-permission', () => {
    let testPermissionId: string;

    beforeAll(async () => {
      if (!isFirebaseConfigured()) return;

      // Create a permission to change
      const permission = await AdduserPermission(userSessionToken, Permision.VIEW, testBoardId);
      testPermissionId = permission.permissionId;
      createdPermissionIds.push(testPermissionId);
    });

    it('should change permission from VIEW to EDIT successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const requestData = {
        permissionId: testPermissionId,
        newPermission: Permision.EDIT
      };

      const response = await makeRequest(app, 'PUT', '/api/permissions/change-permission', requestData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Permission changed successfully');

      // Verify the change in database
      const db = admin.firestore();
      const permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(testPermissionId).get();
      expect(permissionDoc.data()?.permission).toBe(Permision.EDIT);
    });

    it('should change permission from EDIT to VIEW successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      // First change to EDIT
      await AdduserPermission(userSessionToken, Permision.EDIT, testBoardId);
      const permission = await AdduserPermission(userSessionToken, Permision.VIEW, testBoardId);
      const editPermissionId = permission.permissionId;
      createdPermissionIds.push(editPermissionId);

      const requestData = {
        permissionId: editPermissionId,
        newPermission: Permision.VIEW
      };

      const response = await makeRequest(app, 'PUT', '/api/permissions/change-permission', requestData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Permission changed successfully');
    });

    it('should return 400 when permissionId is missing', async () => {
      const requestData = {
        newPermission: Permision.EDIT
      };

      const response = await makeRequest(app, 'PUT', '/api/permissions/change-permission', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Permission ID is required');
    });

    it('should return 400 when newPermission is missing', async () => {
      const requestData = {
        permissionId: 'test-permission-id'
      };

      const response = await makeRequest(app, 'PUT', '/api/permissions/change-permission', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('New permission type is required');
    });

    it('should return 400 for invalid permission type', async () => {
      const requestData = {
        permissionId: testPermissionId,
        newPermission: 'invalid'
      };

      const response = await makeRequest(app, 'PUT', '/api/permissions/change-permission', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Permission must be');
    });

    it('should return 500 when permission not found', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const requestData = {
        permissionId: 'non-existent-permission-id',
        newPermission: Permision.EDIT
      };

      const response = await makeRequest(app, 'PUT', '/api/permissions/change-permission', requestData);

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Permission not found');
    });
  });

  describe('DELETE /api/permissions/remove-permission', () => {
    let testPermissionId: string;

    beforeAll(async () => {
      if (!isFirebaseConfigured()) return;

      // Create a permission to remove
      const permission = await AdduserPermission(userSessionToken, Permision.VIEW, testBoardId);
      testPermissionId = permission.permissionId;
      createdPermissionIds.push(testPermissionId);
    });

    it('should remove permission successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const requestData = {
        permissionId: testPermissionId
      };

      const response = await makeRequest(app, 'DELETE', '/api/permissions/remove-permission', requestData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Permission removed successfully');

      // Verify deletion in database
      const db = admin.firestore();
      const permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(testPermissionId).get();
      expect(permissionDoc.exists).toBe(false);

      // Remove from tracking since it's already deleted
      const index = createdPermissionIds.indexOf(testPermissionId);
      if (index > -1) {
        createdPermissionIds.splice(index, 1);
      }
    });

    it('should return 400 when permissionId is missing', async () => {
      const requestData = {};

      const response = await makeRequest(app, 'DELETE', '/api/permissions/remove-permission', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Permission ID is required');
    });

    it('should return 500 when permission not found', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const requestData = {
        permissionId: 'non-existent-permission-id'
      };

      const response = await makeRequest(app, 'DELETE', '/api/permissions/remove-permission', requestData);

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Permission not found');
    });
  });

  describe('GET /api/permissions/get-permissions', () => {
    beforeAll(async () => {
      if (!isFirebaseConfigured()) return;

      // Create some test permissions
      const permission1 = await AdduserPermission(userSessionToken, Permision.VIEW, testBoardId);
      const permission2 = await AdduserPermission(userSessionToken, Permision.EDIT, testBoardId);
      createdPermissionIds.push(permission1.permissionId, permission2.permissionId);
    });

    it('should get all permissions for a user successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const requestData = {
        sessionToken: userSessionToken
      };

      const response = await makeRequest(app, 'GET', '/api/permissions/get-permissions', requestData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Permissions retrieved successfully');
      expect(response.body.permissions).toBeDefined();
      expect(Array.isArray(response.body.permissions)).toBe(true);
      expect(response.body.count).toBeGreaterThanOrEqual(2); // At least the 2 we created
    });

    it('should filter permissions by boardId', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      // Create another board and permission
      const anotherBoardId = await createDefaultRootBoard(ownerSessionToken);
      createdBoardIds.push(anotherBoardId);
      const permission = await AdduserPermission(userSessionToken, Permision.VIEW, anotherBoardId);
      createdPermissionIds.push(permission.permissionId);

      const requestData = {
        sessionToken: userSessionToken
      };

      const response = await makeRequest(
        app,
        'GET',
        `/api/permissions/get-permissions?boardId=${testBoardId}`,
        requestData
      );

      expect(response.status).toBe(200);
      expect(response.body.permissions).toBeDefined();
      // Should only return permissions for testBoardId
      response.body.permissions.forEach((perm: any) => {
        expect(perm.boardId).toBe(testBoardId);
      });
    });

    it('should filter permissions by permission type', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const requestData = {
        sessionToken: userSessionToken
      };

      const response = await makeRequest(
        app,
        'GET',
        `/api/permissions/get-permissions?permission=${Permision.VIEW}`,
        requestData
      );

      expect(response.status).toBe(200);
      expect(response.body.permissions).toBeDefined();
      // Should only return VIEW permissions
      response.body.permissions.forEach((perm: any) => {
        expect(perm.permission).toBe(Permision.VIEW);
      });
    });

    it('should get a specific permission by permissionId', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const permission = await AdduserPermission(userSessionToken, Permision.VIEW, testBoardId);
      createdPermissionIds.push(permission.permissionId);

      const requestData = {
        sessionToken: userSessionToken
      };

      const response = await makeRequest(
        app,
        'GET',
        `/api/permissions/get-permissions?permissionId=${permission.permissionId}`,
        requestData
      );

      expect(response.status).toBe(200);
      expect(response.body.permissions).toBeDefined();
      expect(response.body.permissions.length).toBe(1);
      expect(response.body.permissions[0].permissionId).toBe(permission.permissionId);
    });

    it('should return 400 when sessionToken is missing', async () => {
      const response = await makeRequest(app, 'GET', '/api/permissions/get-permissions', {});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Session token with UID is required in request body');
    });

    it('should return 400 when trying to filter by OWNER permission', async () => {
      const requestData = {
        sessionToken: userSessionToken
      };

      const response = await makeRequest(
        app,
        'GET',
        `/api/permissions/get-permissions?permission=${Permision.OWNER}`,
        requestData
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('OWNER permissions do not exist');
    });

    it('should return 400 for invalid permission type', async () => {
      const requestData = {
        sessionToken: userSessionToken
      };

      const response = await makeRequest(
        app,
        'GET',
        '/api/permissions/get-permissions?permission=invalid',
        requestData
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Permission must be');
    });
  });
});

