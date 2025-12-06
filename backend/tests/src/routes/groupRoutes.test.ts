import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import http from 'http';
import express from 'express';
import cors from 'cors';
import groupRoutes from '../../../src/routes/groupRoutes.js';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { db } from '../../../src/services/firebase.js';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

dotenv.config();

const TEST_EMAIL_PREFIX = 'test-group-';
const TEST_PASSWORD = 'testpassword123';

const createdTestUsers: string[] = [];
const createdTestBoards: string[] = [];
const createdTestGroups: string[] = [];

const isFirebaseConfigured = () => {
  return process.env.FIREBASE_ADMIN_KEY && admin.apps.length > 0 && db !== undefined;
};

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/boards', groupRoutes);
  return app;
};

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

const createTestUserAndGetToken = async (): Promise<{ uid: string; idToken: string; email: string }> => {
  const timestamp = Date.now();
  const email = `${TEST_EMAIL_PREFIX}${timestamp}@example.com`;
  
  const userRecord = await admin.auth().createUser({
    email,
    password: TEST_PASSWORD,
    emailVerified: true
  });
  
  createdTestUsers.push(userRecord.uid);
  
  const auth = getAuth();
  const userCredential = await signInWithEmailAndPassword(auth, email, TEST_PASSWORD);
  const idToken = await userCredential.user.getIdToken();
  
  return { uid: userRecord.uid, idToken, email };
};

const createTestBoard = async (ownerId: string): Promise<string> => {
  if (!db) throw new Error('DB not initialized');
  
  const { DataBaseidentifiers } = await import('../../../src/services/dbUserItems.js');
  const boardRef = await db.collection(DataBaseidentifiers.BOARD).add({
    title: 'Test Board',
    owner: ownerId, // Use 'owner' to match database schema
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  createdTestBoards.push(boardRef.id);
  return boardRef.id;
};

describe('Group Routes Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  afterEach(async () => {
    if (isFirebaseConfigured() && db) {
      const { DataBaseidentifiers } = await import('../../../src/services/dbUserItems.js');
      for (const groupId of createdTestGroups) {
        for (const boardId of createdTestBoards) {
          try {
            await db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection('groups').doc(groupId).delete();
          } catch (error) {
            console.warn(`Failed to delete test group ${groupId}:`, error);
          }
        }
      }
      createdTestGroups.length = 0;

      for (const boardId of createdTestBoards) {
        try {
          await db.collection(DataBaseidentifiers.BOARD).doc(boardId).delete();
        } catch (error) {
          console.warn(`Failed to delete test board ${boardId}:`, error);
        }
      }
      createdTestBoards.length = 0;
    }

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
    if (isFirebaseConfigured() && db) {
      const { DataBaseidentifiers } = await import('../../../src/services/dbUserItems.js');
      for (const groupId of createdTestGroups) {
        for (const boardId of createdTestBoards) {
          try {
            await db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection('groups').doc(groupId).delete();
          } catch (error) {}
        }
      }
      for (const boardId of createdTestBoards) {
        try {
          await db.collection(DataBaseidentifiers.BOARD).doc(boardId).delete();
        } catch (error) {}
      }
    }
    if (isFirebaseConfigured()) {
      for (const uid of createdTestUsers) {
        try {
          await admin.auth().deleteUser(uid);
        } catch (error) {}
      }
    }
  });

  describe('POST /api/boards/:boardId/groups', () => {
    it('should create a group successfully', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const { uid, idToken } = await createTestUserAndGetToken();
      const boardId = await createTestBoard(uid);
      
      // Add a small delay to ensure board is fully created
      await new Promise(resolve => setTimeout(resolve, 100));

      const groupData = { title: 'My Test Group' };

      const response = await makeRequest(
        app,
        'POST',
        `/api/boards/${boardId}/groups`,
        groupData,
        { Authorization: `Bearer ${idToken}` }
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        groupId: expect.any(String),
        message: 'Group created successfully'
      });

      createdTestGroups.push(response.body.groupId);

      if (db) {
        const { DataBaseidentifiers } = await import('../../../src/services/dbUserItems.js');
        const groupDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection('groups').doc(response.body.groupId).get();
        expect(groupDoc.exists).toBe(true);
        const data = groupDoc.data();
        expect(data?.title).toBe('My Test Group');
        expect(data?.ownerId).toBe(uid);
        expect(data?.expanded).toBe(true);
      }
    }, 10000); // Increase timeout to 10 seconds

    it('should return 400 when title is missing', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const { uid, idToken } = await createTestUserAndGetToken();
      const boardId = await createTestBoard(uid);

      const response = await makeRequest(
        app,
        'POST',
        `/api/boards/${boardId}/groups`,
        {},
        { Authorization: `Bearer ${idToken}` }
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Title is required and must be a non-empty string'
      });
    });

    it('should return 401 when authorization header is missing', async () => {
      const response = await makeRequest(
        app,
        'POST',
        '/api/boards/test-board/groups',
        { title: 'Test' }
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Missing or invalid authorization header'
      });
    });

    it('should return 403 when user is not board owner', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const user1 = await createTestUserAndGetToken();
      const user2 = await createTestUserAndGetToken();
      const boardId = await createTestBoard(user1.uid);

      const response = await makeRequest(
        app,
        'POST',
        `/api/boards/${boardId}/groups`,
        { title: 'Test Group' },
        { Authorization: `Bearer ${user2.idToken}` }
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'Access denied: not board owner'
      });
    });
  });

  describe('GET /api/boards/:boardId/groups', () => {
    it('should get all groups for a board', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const { uid, idToken } = await createTestUserAndGetToken();
      const boardId = await createTestBoard(uid);

      const group1 = await makeRequest(
        app,
        'POST',
        `/api/boards/${boardId}/groups`,
        { title: 'Group 1' },
        { Authorization: `Bearer ${idToken}` }
      );
      createdTestGroups.push(group1.body.groupId);

      const group2 = await makeRequest(
        app,
        'POST',
        `/api/boards/${boardId}/groups`,
        { title: 'Group 2' },
        { Authorization: `Bearer ${idToken}` }
      );
      createdTestGroups.push(group2.body.groupId);

      const response = await makeRequest(
        app,
        'GET',
        `/api/boards/${boardId}/groups`,
        null,
        { Authorization: `Bearer ${idToken}` }
      );

      expect(response.status).toBe(200);
      expect(response.body.groups).toHaveLength(2);
      expect(response.body.groups[0].title).toBe('Group 1');
      expect(response.body.groups[1].title).toBe('Group 2');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await makeRequest(
        app,
        'GET',
        '/api/boards/test-board/groups'
      );

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/boards/:boardId/groups/:groupId', () => {
    it('should update group title', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const { uid, idToken } = await createTestUserAndGetToken();
      const boardId = await createTestBoard(uid);

      const createResponse = await makeRequest(
        app,
        'POST',
        `/api/boards/${boardId}/groups`,
        { title: 'Original Title' },
        { Authorization: `Bearer ${idToken}` }
      );
      const groupId = createResponse.body.groupId;
      createdTestGroups.push(groupId);

      const response = await makeRequest(
        app,
        'PATCH',
        `/api/boards/${boardId}/groups/${groupId}`,
        { title: 'Updated Title' },
        { Authorization: `Bearer ${idToken}` }
      );

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Group updated successfully');

      if (db) {
        const { DataBaseidentifiers } = await import('../../../src/services/dbUserItems.js');
        const groupDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection('groups').doc(groupId).get();
        expect(groupDoc.data()?.title).toBe('Updated Title');
      }
    });

    it('should update group expanded state', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const { uid, idToken } = await createTestUserAndGetToken();
      const boardId = await createTestBoard(uid);

      const createResponse = await makeRequest(
        app,
        'POST',
        `/api/boards/${boardId}/groups`,
        { title: 'Test Group' },
        { Authorization: `Bearer ${idToken}` }
      );
      const groupId = createResponse.body.groupId;
      createdTestGroups.push(groupId);

      const response = await makeRequest(
        app,
        'PATCH',
        `/api/boards/${boardId}/groups/${groupId}`,
        { expanded: false },
        { Authorization: `Bearer ${idToken}` }
      );

      expect(response.status).toBe(200);

      if (db) {
        const { DataBaseidentifiers } = await import('../../../src/services/dbUserItems.js');
        const groupDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection('groups').doc(groupId).get();
        expect(groupDoc.data()?.expanded).toBe(false);
      }
    });

    it('should return 404 when group does not exist', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const { uid, idToken } = await createTestUserAndGetToken();
      const boardId = await createTestBoard(uid);

      const response = await makeRequest(
        app,
        'PATCH',
        `/api/boards/${boardId}/groups/nonexistent`,
        { title: 'New Title' },
        { Authorization: `Bearer ${idToken}` }
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Group not found');
    });
  });

  describe('DELETE /api/boards/:boardId/groups/:groupId', () => {
    it('should delete a group', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const { uid, idToken } = await createTestUserAndGetToken();
      const boardId = await createTestBoard(uid);

      const createResponse = await makeRequest(
        app,
        'POST',
        `/api/boards/${boardId}/groups`,
        { title: 'Group to Delete' },
        { Authorization: `Bearer ${idToken}` }
      );
      const groupId = createResponse.body.groupId;

      const response = await makeRequest(
        app,
        'DELETE',
        `/api/boards/${boardId}/groups/${groupId}`,
        null,
        { Authorization: `Bearer ${idToken}` }
      );

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Group deleted successfully');

      if (db) {
        const { DataBaseidentifiers } = await import('../../../src/services/dbUserItems.js');
        const groupDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection('groups').doc(groupId).get();
        expect(groupDoc.exists).toBe(false);
      }
    });

    it('should return 404 when group does not exist', async () => {
      if (!isFirebaseConfigured()) {
        console.log('Skipping test - Firebase not configured');
        return;
      }

      const { uid, idToken } = await createTestUserAndGetToken();
      const boardId = await createTestBoard(uid);

      const response = await makeRequest(
        app,
        'DELETE',
        `/api/boards/${boardId}/groups/nonexistent`,
        null,
        { Authorization: `Bearer ${idToken}` }
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Group not found');
    });
  });
});
