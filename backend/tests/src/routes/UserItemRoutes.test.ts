import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import http from 'http';
import express from 'express';
import cors from 'cors';
import userItemRoutes from '../../../src/routes/UserItemRoutes.js';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { 
  addItem,
    createDefaultRootBoard,
    DataBaseidentifiers 
} from '../../../src/services/dbUserItems.js';
import { AdduserPermission } from '../../../src/services/dbPermissions.js';
import type { User } from 'firebase/auth';
import type { SessionToken } from '../../../src/datContainers/sessionToken.js';
import type { Item, Board } from '../../../src/datContainers/dataTypes.js';
import { ContentType, Permision } from '../../../src/datContainers/dataTypes.js';

// Import Firebase initialization to ensure db is set up
import '../../../src/services/firebase.js';

dotenv.config();

// Test configuration
const TEST_EMAIL_PREFIX = 'test-useritem-';

// Track created test data for cleanup
let createdUserIds: string[] = [];
let createdBoardIds: string[] = [];
let createdPermissionIds: string[] = [];

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
  
  app.use('/api/items', userItemRoutes);
  return app;
};

// Helper function to make HTTP requests
const makeRequest = (app: express.Application, method: string, path: string, data?: any, headers?: Record<string, string>) => {
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
      
      // Build headers - only include Content-Length if there's a body
      const requestHeaders: Record<string, string> = {
        ...(headers || {})
      };
      
      // Only add Content-Type and Content-Length if there's a request body
      if (requestBody && contentLength > 0) {
        requestHeaders['Content-Type'] = 'application/json';
        requestHeaders['Content-Length'] = contentLength.toString();
      }
      
      const options = {
        hostname: 'localhost',
        port: port,
        path: path,
        method: method,
        headers: requestHeaders
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
    password: 'testpassword123',
    emailVerified: false
  });

  const sessionToken: SessionToken = {
    email: email,
    displayName: 'Test User',
    UID: userRecord.uid
  };

  const user: User = {
    uid: userRecord.uid,
    email: email,
    displayName: 'Test User',
    emailVerified: false
  } as User;

  // Add user to Firestore
  const db = admin.firestore();
  await db.collection(DataBaseidentifiers.USER).doc(userRecord.uid).set({
    isAdmin: false,
    uid: userRecord.uid
  });

  return { userRecord, sessionToken };
}

describe('UserItem Routes Integration Tests', () => {
  let app: express.Application;
  let ownerSessionToken: SessionToken;
  let userSessionToken: SessionToken;
  let testBoardId: string;

  beforeAll(async () => {
    if (!isFirebaseConfigured()) {
      console.log('Firebase not configured, skipping UserItem Routes tests');
      return;
    }

    app = createTestApp();

    // Create owner user
    const ownerEmail = `${TEST_EMAIL_PREFIX}owner${Date.now()}@example.com`;
    const ownerData = await createTestUser(ownerEmail);
    ownerSessionToken = ownerData.sessionToken;
    createdUserIds.push(ownerData.userRecord.uid);

    // Create a test board for the owner
    testBoardId = await createDefaultRootBoard(ownerSessionToken);
    createdBoardIds.push(testBoardId);

    // Create another user for testing
    const userEmail = `${TEST_EMAIL_PREFIX}user${Date.now()}@example.com`;
    const userData = await createTestUser(userEmail);
    userSessionToken = userData.sessionToken;
    createdUserIds.push(userData.userRecord.uid);
  }, 30000); // Increase timeout to 30 seconds

  afterEach(async () => {
    // Clean up created test data after each test
    if (!isFirebaseConfigured()) return;

    const db = admin.firestore();

    // Delete permission documents
    for (const permissionId of createdPermissionIds) {
      try {
        await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permissionId).delete();
      } catch (error) {
        // Document might not exist, ignore
      }
    }
    createdPermissionIds = [];

    // Clean up boards (except testBoardId which is used across tests)
    for (const boardId of createdBoardIds) {
      if (boardId !== testBoardId) {
        try {
          const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId);
          const itemsRef = boardRef.collection(DataBaseidentifiers.ITEMS);
          const itemsSnapshot = await itemsRef.get();
          
          // Delete all items in the board
          const deletePromises = itemsSnapshot.docs.map(doc => doc.ref.delete());
          await Promise.all(deletePromises);
          
          await boardRef.delete();
        } catch (error) {
          // Board might not exist, ignore
        }
      }
    }

    // Clean up items in testBoardId (but keep the board itself)
    try {
      const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(testBoardId);
      const itemsRef = boardRef.collection(DataBaseidentifiers.ITEMS);
      const itemsSnapshot = await itemsRef.get();
      
      const deletePromises = itemsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
    } catch (error) {
      // Ignore errors
    }
  });

  afterAll(async () => {
    // Comprehensive cleanup of all test data
    if (!isFirebaseConfigured()) return;

    const db = admin.firestore();
    
    // Batch cleanup operations to reduce time

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
    for (const userId of createdUserIds) {
      try {
        const boardsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
          .where('owner', '==', userId)
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
    for (const userId of createdUserIds) {
      try {
        // Delete user document from Firestore
        await db.collection(DataBaseidentifiers.USER).doc(userId).delete();
        
        // Delete user from Firebase Auth
        await admin.auth().deleteUser(userId);
      } catch (error) {
        // User might not exist, ignore
      }
    }

    // Safety cleanup: Remove any remaining permissions for test users
    for (const userId of createdUserIds) {
      try {
        const permissionsSnapshot = await db.collection(DataBaseidentifiers.USER_PERMISSION)
          .where('userId', '==', userId)
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
    createdUserIds = [];
    createdBoardIds = [];
    createdPermissionIds = [];
  });

  describe('POST /api/items/create-root-board', () => {
    it('should create a root board successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const requestData = {
        sessionToken: userSessionToken,
        cursorPosition: [10, 20]
      };

      const response = await makeRequest(app, 'POST', '/api/items/create-root-board', requestData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Root board created successfully');
      expect(response.body.boardId).toBeDefined();

      // Track the board for cleanup
      if (response.body.boardId) {
        createdBoardIds.push(response.body.boardId);
      }
    });

    it('should return 400 when sessionToken is missing', async () => {
      const requestData = {
        cursorPosition: [10, 20]
      };

      const response = await makeRequest(app, 'POST', '/api/items/create-root-board', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Session token with UID is required');
    });

    it('should return 400 when sessionToken.UID is missing', async () => {
      const requestData = {
        sessionToken: { email: 'test@example.com' },
        cursorPosition: [10, 20]
      };

      const response = await makeRequest(app, 'POST', '/api/items/create-root-board', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Session token with UID is required');
    });
  });

  describe('POST /api/items/add-user', () => {
    it('should add a user successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const testEmail = `${TEST_EMAIL_PREFIX}newuser${Date.now()}@example.com`;
      const userRecord = await admin.auth().createUser({
        email: testEmail,
        password: 'testpassword123',
        emailVerified: false
      });
      createdUserIds.push(userRecord.uid);

      const requestData = {
        user: {
          uid: userRecord.uid,
          email: testEmail,
          displayName: 'New User'
        },
        isAdmin: false,
        createDefaultBoard: false
      };

      const response = await makeRequest(app, 'POST', '/api/items/add-user', requestData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User added successfully');
    });

    it('should return 400 when user is missing', async () => {
      const requestData = {
        isAdmin: false,
        createDefaultBoard: false
      };

      const response = await makeRequest(app, 'POST', '/api/items/add-user', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User object with uid is required');
    });

    it('should return 400 when user.uid is missing', async () => {
      const requestData = {
        user: {
          email: 'test@example.com',
          displayName: 'Test User'
        },
        isAdmin: false
      };

      const response = await makeRequest(app, 'POST', '/api/items/add-user', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User object with uid is required');
    });
  });

  describe('POST /api/items/add-item', () => {
    it('should add a TEXT item successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const db = admin.firestore();
      const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(testBoardId).get();
      const boardData = boardDoc.data();

      const parentBoard: Board = {
        id: testBoardId,
        content: boardData?.content || '',
        contentType: ContentType.BOARD,
        position: boardData?.position || [0, 0],
        size: boardData?.size || [800, 600],
        owner: ownerSessionToken.UID,
        parentId: undefined,
        isRoot: true,
        permissions: [],
        items: []
      };

      const requestData = {
        item: {
          id: '',
          content: 'Test text item',
          contentType: ContentType.TEXT,
          position: [10, 10],
          size: [100, 50]
        } as Item,
        sessionToken: ownerSessionToken,
        parent: parentBoard,
        cursorPosition: [10, 10]
      };

      const response = await makeRequest(app, 'POST', '/api/items/add-item', requestData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Item added successfully');
    });

    it('should add a BOARD item successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const db = admin.firestore();
      const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(testBoardId).get();
      const boardData = boardDoc.data();

      const parentBoard: Board = {
        id: testBoardId,
        content: boardData?.content || '',
        contentType: ContentType.BOARD,
        position: boardData?.position || [0, 0],
        size: boardData?.size || [800, 600],
        owner: ownerSessionToken.UID,
        parentId: undefined,
        isRoot: true,
        permissions: [],
        items: []
      };

      const requestData = {
        item: {
          id: '',
          content: 'Nested Board',
          contentType: ContentType.BOARD,
          position: [20, 20],
          size: [400, 300]
        } as Item,
        sessionToken: ownerSessionToken,
        parent: parentBoard,
        cursorPosition: [20, 20]
      };

      const response = await makeRequest(app, 'POST', '/api/items/add-item', requestData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Item added successfully');
    });

    it('should return 400 when item is missing', async () => {
      const requestData = {
        sessionToken: ownerSessionToken,
        parent: { id: testBoardId }
      };

      const response = await makeRequest(app, 'POST', '/api/items/add-item', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Item is required');
    });

    it('should return 400 when sessionToken is missing', async () => {
      const requestData = {
        item: {
          content: 'Test item',
          contentType: ContentType.TEXT
        },
        parent: { id: testBoardId }
      };

      const response = await makeRequest(app, 'POST', '/api/items/add-item', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Session token with UID is required');
    });

    it('should return 400 when parent is missing', async () => {
      const requestData = {
        item: {
          content: 'Test item',
          contentType: ContentType.TEXT
        },
        sessionToken: ownerSessionToken
      };

      const response = await makeRequest(app, 'POST', '/api/items/add-item', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Parent board with id is required');
    });
  });

  describe('DELETE /api/items/remove-item', () => {
    let testItemId: string;

    beforeAll(async () => {
      if (!isFirebaseConfigured() || !testBoardId) return;

      // Create a test item to remove
      const db = admin.firestore();
      const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(testBoardId).get();
      const boardData = boardDoc.data();

      const parentBoard: Board = {
        id: testBoardId,
        content: boardData?.content || '',
        contentType: ContentType.BOARD,
        position: boardData?.position || [0, 0],
        size: boardData?.size || [800, 600],
        owner: ownerSessionToken.UID,
        parentId: undefined,
        isRoot: true,
        permissions: [],
        items: []
      };

      const textItem: Item = {
        id: '',
        content: 'Item to remove',
        contentType: ContentType.TEXT,
        position: [10, 10],
        size: [100, 50]
      };

      // Add item using the service directly
      const { addItem } = await import('../../../src/services/dbUserItems.js');
      await addItem(textItem, ownerSessionToken, parentBoard, [10, 10]);

      // Find the created item
      const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
        .doc(testBoardId)
        .collection(DataBaseidentifiers.ITEMS)
        .get();

      if (itemsSnapshot.size > 0) {
        testItemId = itemsSnapshot.docs[0].id;
      }
    });

    it('should remove a TEXT item successfully', async () => {
      if (!isFirebaseConfigured() || !testItemId) {
        console.log('Skipping test - Firebase not configured or item not found');
        return;
      }

      const db = admin.firestore();
      const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(testBoardId).get();
      const boardData = boardDoc.data();

      const parentBoard: Board = {
        id: testBoardId,
        content: boardData?.content || '',
        contentType: ContentType.BOARD,
        position: boardData?.position || [0, 0],
        size: boardData?.size || [800, 600],
        owner: ownerSessionToken.UID,
        parentId: undefined,
        isRoot: true,
        permissions: [],
        items: []
      };

      const requestData = {
        item: {
          id: testItemId,
          content: 'Item to remove',
          contentType: ContentType.TEXT,
          position: [10, 10],
          size: [100, 50]
        } as Item,
        sessionToken: ownerSessionToken,
        parent: parentBoard
      };

      const response = await makeRequest(app, 'DELETE', '/api/items/remove-item', requestData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Item removed successfully');

      // Verify deletion
      const itemDoc = await db.collection(DataBaseidentifiers.BOARD)
        .doc(testBoardId)
        .collection(DataBaseidentifiers.ITEMS)
        .doc(testItemId)
        .get();

      expect(itemDoc.exists).toBe(false);
    });

    it('should return 400 when item is missing', async () => {
      const requestData = {
        sessionToken: ownerSessionToken,
        parent: { id: testBoardId }
      };

      const response = await makeRequest(app, 'DELETE', '/api/items/remove-item', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Item with id is required');
    });

    it('should return 400 when item.id is missing', async () => {
      const requestData = {
        item: {
          content: 'Test item',
          contentType: ContentType.TEXT
        },
        sessionToken: ownerSessionToken,
        parent: { id: testBoardId }
      };

      const response = await makeRequest(app, 'DELETE', '/api/items/remove-item', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Item with id is required');
    });

    it('should return 400 when sessionToken is missing', async () => {
      const requestData = {
        item: {
          id: 'test-item-id',
          contentType: ContentType.TEXT
        },
        parent: { id: testBoardId }
      };

      const response = await makeRequest(app, 'DELETE', '/api/items/remove-item', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Session token with UID is required');
    });
  });

  describe('PUT /api/items/update-item', () => {
    let testItemId: string;

    beforeAll(async () => {
      if (!isFirebaseConfigured() || !testBoardId) return;

      // Create a test item to update
      const db = admin.firestore();
      const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(testBoardId).get();
      const boardData = boardDoc.data();

      const parentBoard: Board = {
        id: testBoardId,
        content: boardData?.content || '',
        contentType: ContentType.BOARD,
        position: boardData?.position || [0, 0],
        size: boardData?.size || [800, 600],
        owner: ownerSessionToken.UID,
        parentId: undefined,
        isRoot: true,
        permissions: [],
        items: []
      };

      const textItem: Item = {
        id: '',
        content: 'Original content',
        contentType: ContentType.TEXT,
        position: [10, 10],
        size: [100, 50]
      };

      // Add item using the service directly
      const { addItem } = await import('../../../src/services/dbUserItems.js');
      await addItem(textItem, ownerSessionToken, parentBoard, [10, 10]);

      // Find the created item
      const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
        .doc(testBoardId)
        .collection(DataBaseidentifiers.ITEMS)
        .get();

      if (itemsSnapshot.size > 0) {
        testItemId = itemsSnapshot.docs[0].id;
      }
    });

    it('should update an item successfully', async () => {
      if (!isFirebaseConfigured() || !testItemId) {
        console.log('Skipping test - Firebase not configured or item not found');
        return;
      }

      const requestData = {
        boardId: testBoardId,
        sessionToken: ownerSessionToken,
        itemId: testItemId,
        updates: {
          content: 'Updated content',
          position: [20, 20]
        }
      };

      const response = await makeRequest(app, 'PUT', '/api/items/update-item', requestData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Item updated successfully');

      // Verify update
      const db = admin.firestore();
      const itemDoc = await db.collection(DataBaseidentifiers.BOARD)
        .doc(testBoardId)
        .collection(DataBaseidentifiers.ITEMS)
        .doc(testItemId)
        .get();

      expect(itemDoc.exists).toBe(true);
      const itemData = itemDoc.data();
      expect(itemData?.content).toBe('Updated content');
      expect(itemData?.position).toEqual([20, 20]);
    });

    it('should return 400 when boardId is missing', async () => {
      const requestData = {
        sessionToken: ownerSessionToken,
        itemId: testItemId,
        updates: { content: 'Updated' }
      };

      const response = await makeRequest(app, 'PUT', '/api/items/update-item', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Board ID is required');
    });

    it('should return 400 when sessionToken is missing', async () => {
      const requestData = {
        boardId: testBoardId,
        itemId: testItemId,
        updates: { content: 'Updated' }
      };

      const response = await makeRequest(app, 'PUT', '/api/items/update-item', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Session token with UID is required');
    });

    it('should return 400 when itemId is missing', async () => {
      const requestData = {
        boardId: testBoardId,
        sessionToken: ownerSessionToken,
        updates: { content: 'Updated' }
      };

      const response = await makeRequest(app, 'PUT', '/api/items/update-item', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Item ID is required');
    });

    it('should return 400 when updates is missing', async () => {
      const requestData = {
        boardId: testBoardId,
        sessionToken: ownerSessionToken,
        itemId: testItemId
      };

      const response = await makeRequest(app, 'PUT', '/api/items/update-item', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Updates object is required');
    });

    it('should return 400 when updates is empty', async () => {
      const requestData = {
        boardId: testBoardId,
        sessionToken: ownerSessionToken,
        itemId: testItemId,
        updates: {}
      };

      const response = await makeRequest(app, 'PUT', '/api/items/update-item', requestData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Updates object is required');
    });
  });

  describe('GET /api/items/get-item', () => {
    let testItemId: string;

    beforeEach(async () => {
      if (!isFirebaseConfigured() || !testBoardId) return;

      // Create a test item to retrieve before each test
      // This ensures the item exists even after afterEach cleanup
      const db = admin.firestore();
      const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(testBoardId).get();
      const boardData = boardDoc.data();

      const parentBoard: Board = {
        id: testBoardId,
        content: boardData?.content || '',
        contentType: ContentType.BOARD,
        position: boardData?.position || [0, 0],
        size: boardData?.size || [800, 600],
        owner: ownerSessionToken.UID,
        parentId: undefined,
        isRoot: true,
        permissions: [],
        items: []
      };

      const textItem: Item = {
        id: '',
        content: 'Item to retrieve',
        contentType: ContentType.TEXT,
        position: [10, 10],
        size: [100, 50]
      };

      // Add item using the service directly
      const { addItem } = await import('../../../src/services/dbUserItems.js');
      await addItem(textItem, ownerSessionToken, parentBoard, [10, 10]);

      // Find the created item
      const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
        .doc(testBoardId)
        .collection(DataBaseidentifiers.ITEMS)
        .get();

      if (itemsSnapshot.size > 0) {
        testItemId = itemsSnapshot.docs[itemsSnapshot.size - 1].id; // Get the last item (most recently created)
      }
    });

    it('should get a BOARD successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-item?itemId=${testBoardId}&contentType=${ContentType.BOARD}`,
        undefined,
        {
          'Authorization': `Bearer ${JSON.stringify(ownerSessionToken)}`
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Item retrieved successfully');
      expect(response.body.item).toBeDefined();
      expect(response.body.item.id).toBe(testBoardId);
      expect(response.body.item.contentType).toBe(ContentType.BOARD);
    });

    it('should get a TEXT item successfully', async () => {
      if (!isFirebaseConfigured() || !testItemId) {
        console.log('Skipping test - Firebase not configured or item not found');
        return;
      }

      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-item?itemId=${testItemId}&contentType=${ContentType.TEXT}&itemParentId=${testBoardId}`,
        undefined,
        {
          'Authorization': `Bearer ${JSON.stringify(ownerSessionToken)}`
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Item retrieved successfully');
      expect(response.body.item).toBeDefined();
      expect(response.body.item.id).toBe(testItemId);
      expect(response.body.item.contentType).toBe(ContentType.TEXT);
      expect(response.body.item.content).toBe('Item to retrieve');
    });

    it('should return 400 when itemId is missing', async () => {
      const requestData = {
        sessionToken: ownerSessionToken
      };

      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-item?contentType=${ContentType.TEXT}`,
        requestData
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Item ID is required as query parameter');
    });

    it('should return 400 when contentType is missing', async () => {
      const requestData = {
        sessionToken: ownerSessionToken
      };

      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-item?itemId=${testItemId}`,
        requestData
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Content type is required as query parameter');
    });

    it('should return 400 when sessionToken is missing', async () => {
      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-item?itemId=${testBoardId}&contentType=${ContentType.BOARD}`
      );

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization header with Bearer token is required');
    });

    it('should return 400 when itemParentId is missing for non-BOARD items', async () => {
      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-item?itemId=${testItemId}&contentType=${ContentType.TEXT}`,
        undefined,
        {
          'Authorization': `Bearer ${JSON.stringify(ownerSessionToken)}`
        }
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Parent board ID is required for non-BOARD items');
    });

    it('should allow user with VIEW permission to get item', async () => {
      if (!isFirebaseConfigured() || !testItemId) {
        console.log('Skipping test - Firebase not configured or item not found');
        return;
      }

      // Add VIEW permission for userSessionToken
      const permission = await AdduserPermission(userSessionToken, Permision.VIEW, testBoardId);
      createdPermissionIds.push(permission.permissionId);

      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-item?itemId=${testItemId}&contentType=${ContentType.TEXT}&itemParentId=${testBoardId}`,
        undefined,
        {
          'Authorization': `Bearer ${JSON.stringify(userSessionToken)}`
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.item).toBeDefined();
    });
  });

  describe('GET /api/items/get-all-items', () => {
    let testItemIds: string[] = [];

    beforeEach(async () => {
      if (!isFirebaseConfigured() || !testBoardId) return;

      // Create test items in the board before each test
      const db = admin.firestore();
      const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(testBoardId).get();
      const boardData = boardDoc.data();

      const parentBoard: Board = {
        id: testBoardId,
        content: boardData?.content || '',
        contentType: ContentType.BOARD,
        position: boardData?.position || [0, 0],
        size: boardData?.size || [800, 600],
        owner: ownerSessionToken.UID,
        parentId: undefined,
        isRoot: true,
        permissions: [],
        items: []
      };

      // Add multiple test items
      const { addItem } = await import('../../../src/services/dbUserItems.js');
      
      const item1: Item = {
        id: '',
        content: 'Test Item 1',
        contentType: ContentType.TEXT,
        position: [100, 100],
        size: [256, 200]
      };

      const item2: Item = {
        id: '',
        content: 'Test Item 2',
        contentType: ContentType.TEXT,
        position: [300, 300],
        size: [256, 200]
      };

      const item3: Item = {
        id: '',
        content: '<div>HTML Item</div>',
        contentType: ContentType.HTML,
        position: [500, 500],
        size: [400, 300]
      };

      const id1 = await addItem(item1, ownerSessionToken, parentBoard, [100, 100]);
      const id2 = await addItem(item2, ownerSessionToken, parentBoard, [300, 300]);
      const id3 = await addItem(item3, ownerSessionToken, parentBoard, [500, 500]);

      testItemIds = [id1, id2, id3];
    });

    afterEach(async () => {
      // Clean up test items
      if (!isFirebaseConfigured()) return;

      const db = admin.firestore();
      for (const itemId of testItemIds) {
        try {
          await db.collection(DataBaseidentifiers.BOARD)
            .doc(testBoardId)
            .collection(DataBaseidentifiers.ITEMS)
            .doc(itemId)
            .delete();
        } catch (error) {
          // Item might not exist, ignore
        }
      }
      testItemIds = [];
    });

    it('should get all items from a board successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-all-items?boardId=${testBoardId}`,
        undefined,
        {
          'Authorization': `Bearer ${JSON.stringify(ownerSessionToken)}`
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Items retrieved successfully');
      expect(response.body.items).toBeDefined();
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThanOrEqual(3);

      // Verify item structure
      response.body.items.forEach((item: any) => {
        expect(item.id).toBeDefined();
        expect(item.content).toBeDefined();
        expect(item.contentType).toBeDefined();
        expect(Array.isArray(item.position)).toBe(true);
        expect(Array.isArray(item.size)).toBe(true);
      });
    });

    it('should return 400 when boardId is missing', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const response = await makeRequest(
        app,
        'GET',
        '/api/items/get-all-items',
        undefined,
        {
          'Authorization': `Bearer ${JSON.stringify(ownerSessionToken)}`
        }
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Board ID is required as query parameter');
    });

    it('should return 401 when Authorization header is missing', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-all-items?boardId=${testBoardId}`
      );

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization header with Bearer token is required');
    });

    it('should return 400 when Authorization header format is invalid', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-all-items?boardId=${testBoardId}`,
        undefined,
        {
          'Authorization': 'InvalidFormat token'
        }
      );

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization header with Bearer token is required');
    });

    it('should return 400 when session token is invalid JSON', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-all-items?boardId=${testBoardId}`,
        undefined,
        {
          'Authorization': 'Bearer invalid-json-token'
        }
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid session token format');
    });

    it('should return 400 when session token missing UID', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const invalidToken = {
        email: 'test@example.com',
        displayName: 'Test User'
        // Missing UID
      };

      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-all-items?boardId=${testBoardId}`,
        undefined,
        {
          'Authorization': `Bearer ${JSON.stringify(invalidToken)}`
        }
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Session token with UID is required');
    });

    it('should return 404 when board does not exist', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const nonExistentBoardId = 'non-existent-board-id-12345';

      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-all-items?boardId=${nonExistentBoardId}`,
        undefined,
        {
          'Authorization': `Bearer ${JSON.stringify(ownerSessionToken)}`
        }
      );

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Board not found');
    });

    it('should return 403 when user is unauthorized', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      // Use userSessionToken who doesn't own the board
      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-all-items?boardId=${testBoardId}`,
        undefined,
        {
          'Authorization': `Bearer ${JSON.stringify(userSessionToken)}`
        }
      );

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should return empty array when board has no items', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      // Create a new empty nested board (not using testBoardId which has items from beforeEach)
      // We need to get the parent board first
      const db = admin.firestore();
      const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(testBoardId).get();
      const boardData = boardDoc.data();

      const parentBoard: Board = {
        id: testBoardId,
        content: boardData?.content || '',
        contentType: ContentType.BOARD,
        position: boardData?.position || [0, 0],
        size: boardData?.size || [800, 600],
        owner: ownerSessionToken.UID,
        parentId: undefined,
        isRoot: true,
        permissions: [],
        items: []
      };

      const boardItem: Item = {
        id: '',
        content: '',
        contentType: ContentType.BOARD,
        position: [0, 0],
        size: [800, 600]
      };

      const emptyBoardId = await addItem(boardItem, ownerSessionToken, parentBoard, [0, 0]);
      createdBoardIds.push(emptyBoardId);

      // Wait a moment to ensure board is created
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-all-items?boardId=${emptyBoardId}`,
        undefined,
        {
          'Authorization': `Bearer ${JSON.stringify(ownerSessionToken)}`
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Items retrieved successfully');
      expect(response.body.items).toBeDefined();
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBe(0);
    });

    it('should handle items with different content types', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const response = await makeRequest(
        app,
        'GET',
        `/api/items/get-all-items?boardId=${testBoardId}`,
        undefined,
        {
          'Authorization': `Bearer ${JSON.stringify(ownerSessionToken)}`
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThanOrEqual(3);

      const textItems = response.body.items.filter((item: any) => item.contentType === ContentType.TEXT);
      const htmlItems = response.body.items.filter((item: any) => item.contentType === ContentType.HTML);

      expect(textItems.length).toBeGreaterThanOrEqual(2);
      expect(htmlItems.length).toBeGreaterThanOrEqual(1);
    });
  });
});

