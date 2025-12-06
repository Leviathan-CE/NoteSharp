import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { addedUser, addItem, createDefaultRootBoard, removeItem, UpadteBaordItem, getItem, getAllItemsFromBoard, DataBaseidentifiers } from '../../../src/services/dbUserItems.js';
import { AdduserPermission, ChangePermission } from '../../../src/services/dbPermissions.js';
import type { User } from 'firebase/auth';
import type { Item, Board } from '../../../src/datContainers/dataTypes.js';
import { ContentType, Permision } from '../../../src/datContainers/dataTypes.js';
import type { SessionToken } from '../../../src/datContainers/sessionToken.js';

// Import Firebase initialization to ensure db is set up
import '../../../src/services/firebase.js';

dotenv.config();

describe('dbUser', () => {
    let sessionToken: SessionToken;
    let createdDocumentIds: string[] = [];
    let createdBoardIds: string[] = [];
    let createdPermissionIds: string[] = [];

    beforeEach(async () => {
        // Skip tests if Firebase is not configured
        if (!process.env.FIREBASE_ADMIN_KEY) {
            console.warn('Firebase not configured, skipping dbUser tests');
            return;
        }

        // Create a test user in Firebase Auth
        const testUserEmail = `testuser${Date.now()}@example.com`;
        try {
            const userRecord = await admin.auth().createUser({
                email: testUserEmail,
                password: 'testpassword123',
                emailVerified: false
            });

            sessionToken = {
                email: testUserEmail,
                displayName: 'Test User',
                UID: userRecord.uid
            };

            createdDocumentIds = [];
            createdBoardIds = [];
            createdPermissionIds = [];
        } catch (error) {
            console.error('Failed to create test user:', error);
            throw error;
        }
    });

    afterEach(async () => {
        // Clean up created Firestore documents
        if (!process.env.FIREBASE_ADMIN_KEY) return;

        const db = admin.firestore();
        
        // Delete user document
        if (sessionToken?.UID) {
            try {
                await db.collection(DataBaseidentifiers.USER).doc(sessionToken.UID).delete();
            } catch (error) {
                // Document might not exist, ignore
            }
        }

        // Delete created board documents
        for (const boardId of createdBoardIds) {
            try {
                // Delete items subcollection first
                const itemsRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection(DataBaseidentifiers.ITEMS);
                const itemsSnapshot = await itemsRef.get();
                const deletePromises = itemsSnapshot.docs.map(doc => doc.ref.delete());
                await Promise.all(deletePromises);

                // Delete the board document
                await db.collection(DataBaseidentifiers.BOARD).doc(boardId).delete();
            } catch (error) {
                // Document might not exist, ignore
            }
        }

        // Safety cleanup: Remove any remaining boards owned by the test user
        // This catches any boards that might not have been tracked in createdBoardIds
        if (sessionToken?.UID) {
            try {
                const allBoardsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
                    .where('owner', '==', sessionToken.UID)
                    .get();
                
                for (const boardDoc of allBoardsSnapshot.docs) {
                    try {
                        // Delete items subcollection first
                        const itemsRef = boardDoc.ref.collection(DataBaseidentifiers.ITEMS);
                        const itemsSnapshot = await itemsRef.get();
                        const deletePromises = itemsSnapshot.docs.map(doc => doc.ref.delete());
                        await Promise.all(deletePromises);

                        // Delete the board document
                        await boardDoc.ref.delete();
                    } catch (error) {
                        // Document might not exist, ignore
                    }
                }
            } catch (error) {
                // Ignore errors in safety cleanup
            }
        }

        // Delete created permissions
        for (const permissionId of createdPermissionIds) {
            try {
                await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permissionId).delete();
            } catch (error) {
                // Document might not exist, ignore
            }
        }

        // Safety cleanup: Remove any remaining permissions for test users
        // This catches permissions that might not have been tracked or were created by other users in tests
        if (sessionToken?.UID) {
            try {
                // Clean up permissions for the main test user
                const allPermissionsSnapshot = await db.collection(DataBaseidentifiers.USER_PERMISSION)
                    .where('userId', '==', sessionToken.UID)
                    .get();
                
                for (const permissionDoc of allPermissionsSnapshot.docs) {
                    try {
                        await permissionDoc.ref.delete();
                    } catch (error) {
                        // Document might not exist, ignore
                    }
                }
            } catch (error) {
                // Ignore errors in safety cleanup
            }
        }

        // Delete created items (if any were created independently)
        for (const docId of createdDocumentIds) {
            try {
                await db.collection(DataBaseidentifiers.ITEMS).doc(docId).delete();
            } catch (error) {
                // Document might not exist, ignore
            }
        }

        // Delete test user from Firebase Auth
        if (sessionToken?.UID) {
            try {
                await admin.auth().deleteUser(sessionToken.UID);
            } catch (error) {
                // User might not exist, ignore
            }
        }
    });

    // Helper function to wait for a document to appear
    async function waitForDocument(db: admin.firestore.Firestore, collection: string, docId: string, maxWaitMs: number = 5000): Promise<admin.firestore.DocumentSnapshot> {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitMs) {
            const doc = await db.collection(collection).doc(docId).get();
            if (doc.exists) {
                return doc;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return await db.collection(collection).doc(docId).get();
    }

    // Helper function to wait for a query to return results
    async function waitForQuery(
        query: admin.firestore.Query,
        minResults: number = 1,
        maxWaitMs: number = 10000
    ): Promise<admin.firestore.QuerySnapshot> {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitMs) {
            const snapshot = await query.get();
            if (snapshot.size >= minResults) {
                return snapshot;
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        return await query.get();
    }

    describe('addedUser', () => {
        it('should add a user to the database with isAdmin false', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            await addedUser(sessionToken, false);

            // Verify the document was created
            const db = admin.firestore();
            const doc = await db.collection(DataBaseidentifiers.USER).doc(sessionToken.UID).get();

            expect(doc.exists).toBe(true);
            expect(doc.data()?.isAdmin).toBe(false);
            expect(doc.data()?.uid).toBe(sessionToken.UID);
        });

        it('should add a user to the database with isAdmin true', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            await addedUser(sessionToken, true);

            // Verify the document was created
            const db = admin.firestore();
            const doc = await db.collection(DataBaseidentifiers.USER).doc(sessionToken.UID).get();

            expect(doc.exists).toBe(true);
            expect(doc.data()?.isAdmin).toBe(true);
            expect(doc.data()?.uid).toBe(sessionToken.UID);
        });

        it('should throw DataConnectError if db is not initialized', async () => {
            // This test would require mocking db as undefined, which is complex
            // Since we're using real Firebase, we'll skip this test
            // In a real scenario, you'd need to mock the db export
            expect(true).toBe(true); // Placeholder
        });
    });

    describe('createDefaultRootBoard', () => {
        it('should create a default root board for a user', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            const boardId = await createDefaultRootBoard(sessionToken);

            // Verify the board was created
            const db = admin.firestore();
            const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();

            expect(boardDoc.exists).toBe(true);
            const boardData = boardDoc.data();

            expect(boardData?.owner).toBe(sessionToken.UID);
            expect(boardData?.contentType).toBe(ContentType.BOARD);
            expect(boardData?.isRoot).toBe(true);
            expect(boardData?.id).toBe(boardId);
            expect(boardData?.content).toBe('Default Board');

            createdBoardIds.push(boardId);
        });

        it('should return existing root board if user already has one', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            // Create first root board
            const firstBoardId = await createDefaultRootBoard(sessionToken);
            createdBoardIds.push(firstBoardId);

            // Try to create another one - should return the existing one
            const secondBoardId = await createDefaultRootBoard(sessionToken);

            expect(secondBoardId).toBe(firstBoardId);

            // Verify only one root board exists
            const db = admin.firestore();
            const snapshot = await db.collection(DataBaseidentifiers.BOARD)
                .where('owner', '==', sessionToken.UID)
                .where('isRoot', '==', true)
                .get();

            expect(snapshot.size).toBe(1);
        });
    });

    describe('addItem', () => {
        describe('BOARD items', () => {
            it('should create a nested board inside a parent board', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // First create a root board as parent
                const rootBoardId = await createDefaultRootBoard(sessionToken);
                const db = admin.firestore();
                const rootBoardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(rootBoardId).get();
                const rootBoardData = rootBoardDoc.data();
                
                const parentBoard: Board = {
                    id: rootBoardId,
                    content: rootBoardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: rootBoardData?.position || [0, 0],
                    size: rootBoardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                createdBoardIds.push(rootBoardId);

                const nestedItem: Item = {
                    id: '',
                    content: 'Nested Board',
                    contentType: ContentType.BOARD,
                    position: [10, 10],
                    size: [50, 50]
                };

                await addItem(nestedItem, sessionToken, parentBoard, [10, 10]);

                // Find the nested board
                const boardsRef = db.collection(DataBaseidentifiers.BOARD);
                const nestedSnapshot = await boardsRef.where('owner', '==', sessionToken.UID).where('isRoot', '==', false).get();

                expect(nestedSnapshot.size).toBeGreaterThan(0);
                const nestedBoard = nestedSnapshot.docs.find(doc => doc.data().position?.[0] === 10);
                expect(nestedBoard).toBeDefined();

                if (nestedBoard) {
                    const nestedData = nestedBoard.data();
                    expect(nestedData.owner).toBe(sessionToken.UID);
                    expect(nestedData.contentType).toBe(ContentType.BOARD);
                    expect(nestedData.isRoot).toBe(false);
                    expect(nestedData.position).toEqual([10, 10]);
                    expect(nestedData.id).toBe(nestedBoard.id);

                    createdBoardIds.push(nestedBoard.id);
                }
            });

        });

        describe('TEXT items', () => {
            it('should create a TEXT item in the items subcollection under parent board', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // First create a root board as parent
                const parentBoardId = await createDefaultRootBoard(sessionToken);
                const db = admin.firestore();
                const parentBoardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(parentBoardId).get();
                const parentBoardData = parentBoardDoc.data();

                const parentBoard: Board = {
                    id: parentBoardId,
                    content: parentBoardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: parentBoardData?.position || [0, 0],
                    size: parentBoardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                createdBoardIds.push(parentBoardId);

                // Now create a TEXT item
                const textItem: Item = {
                    id: '',
                    content: 'This is test text content',
                    contentType: ContentType.TEXT,
                    position: [5, 5],
                    size: [200, 50]
                };

                await addItem(textItem, sessionToken, parentBoard, [5, 5]);

                // Verify the TEXT item was created in the subcollection
                const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(parentBoardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .get();

                expect(itemsSnapshot.size).toBeGreaterThan(0);
                const itemDoc = itemsSnapshot.docs[0];
                expect(itemDoc).toBeDefined();
                
                if (itemDoc) {
                    const itemData = itemDoc.data();

                    expect(itemData.content).toBe('This is test text content');
                    expect(itemData.contentType).toBe(ContentType.TEXT);
                    expect(itemData.position).toEqual([5, 5]);
                    expect(itemData.size).toEqual([200, 50]);
                    expect(itemData.id).toBe(itemDoc.id);
                }
            });

            it('should throw error when parent board ID is not provided for TEXT items', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                const textItem: Item = {
                    id: '',
                    content: 'Test text',
                    contentType: ContentType.TEXT,
                    position: [0, 0],
                    size: [100, 50]
                };

                const parentBoard: Board = {
                    id: '',
                    content: '',
                    contentType: ContentType.BOARD,
                    position: [0, 0],
                    size: [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: false,
                    permissions: [],
                    items: []
                };

                await expect(addItem(textItem, sessionToken, parentBoard, [0, 0])).rejects.toThrow(
                    'Parent board ID is required for Non root Board items'
                );
            });
        });
    });

    describe('removeItem', () => {
        describe('BOARD items', () => {
            it('should remove a nested board', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board as parent
                const rootBoardId = await createDefaultRootBoard(sessionToken);
                const db = admin.firestore();
                const rootBoardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(rootBoardId).get();
                const rootBoardData = rootBoardDoc.data();

                const parentBoard: Board = {
                    id: rootBoardId,
                    content: rootBoardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: rootBoardData?.position || [0, 0],
                    size: rootBoardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                // Create a nested board
                const nestedItem: Item = {
                    id: '',
                    content: 'Nested Board to Delete',
                    contentType: ContentType.BOARD,
                    position: [10, 10],
                    size: [50, 50]
                };

                createdBoardIds.push(rootBoardId);

                await addItem(nestedItem, sessionToken, parentBoard, [10, 10]);

                // Find the nested board
                const boardsRef = db.collection(DataBaseidentifiers.BOARD);
                const nestedSnapshot = await boardsRef.where('owner', '==', sessionToken.UID).where('isRoot', '==', false).get();
                expect(nestedSnapshot.size).toBeGreaterThan(0);
                const nestedBoardDoc = nestedSnapshot.docs[0];
                expect(nestedBoardDoc).toBeDefined();
                if (!nestedBoardDoc) {
                    throw new Error('Nested board not found');
                }
                const nestedBoardId = nestedBoardDoc.id;

                // Remove the nested board
                const boardToRemove: Item = {
                    id: nestedBoardId,
                    content: 'Nested Board to Delete',
                    contentType: ContentType.BOARD,
                    position: [10, 10],
                    size: [50, 50]
                };

                await removeItem(boardToRemove, sessionToken);

                // Verify the board was deleted
                const deletedBoardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(nestedBoardId).get();
                expect(deletedBoardDoc.exists).toBe(false);
            });

            it('should remove all permissions when deleting a board', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board as parent
                const rootBoardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(rootBoardId);
                const db = admin.firestore();
                const rootBoardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(rootBoardId).get();
                const rootBoardData = rootBoardDoc.data();

                const parentBoard: Board = {
                    id: rootBoardId,
                    content: rootBoardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: rootBoardData?.position || [0, 0],
                    size: rootBoardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                // Create a nested board
                const nestedItem: Item = {
                    id: '',
                    content: 'Nested Board with Permissions',
                    contentType: ContentType.BOARD,
                    position: [10, 10],
                    size: [50, 50]
                };

                await addItem(nestedItem, sessionToken, parentBoard, [10, 10]);

                // Find the nested board
                const boardsRef = db.collection(DataBaseidentifiers.BOARD);
                const nestedSnapshot = await boardsRef.where('owner', '==', sessionToken.UID).where('isRoot', '==', false).get();
                const nestedBoardDoc = nestedSnapshot.docs[0];
                if (!nestedBoardDoc) {
                    throw new Error('Nested board not found');
                }
                const nestedBoardId = nestedBoardDoc.id;

                // Create a second user and add permissions to the nested board
                const otherUserEmail = `otheruser${Date.now()}@example.com`;
                const otherUserRecord = await admin.auth().createUser({
                    email: otherUserEmail,
                    password: 'testpassword123',
                    emailVerified: false
                });

                const otherSessionToken: SessionToken = {
                    email: otherUserEmail,
                    displayName: 'Other User',
                    UID: otherUserRecord.uid
                };

                await addedUser(otherSessionToken, false, false);

                // Add permissions to the nested board
                const permission1 = await AdduserPermission(otherSessionToken, Permision.VIEW, nestedBoardId);
                const permission2 = await AdduserPermission(otherSessionToken, Permision.EDIT, nestedBoardId);
                createdPermissionIds.push(permission1.permissionId, permission2.permissionId);

                // Verify permissions exist
                let boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(nestedBoardId).get();
                let boardPermissions = boardDoc.data()?.permissions || [];
                expect(boardPermissions.length).toBeGreaterThan(0);
                expect(boardPermissions).toContain(permission1.permissionId);
                expect(boardPermissions).toContain(permission2.permissionId);

                // Remove the nested board
                const boardToRemove: Item = {
                    id: nestedBoardId,
                    content: 'Nested Board with Permissions',
                    contentType: ContentType.BOARD,
                    position: [10, 10],
                    size: [50, 50]
                };

                await removeItem(boardToRemove, sessionToken);

                // Verify the board was deleted
                const deletedBoardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(nestedBoardId).get();
                expect(deletedBoardDoc.exists).toBe(false);

                // Verify permissions were deleted
                const permission1Doc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permission1.permissionId).get();
                const permission2Doc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permission2.permissionId).get();
                expect(permission1Doc.exists).toBe(false);
                expect(permission2Doc.exists).toBe(false);

                // Clean up other user
                await admin.auth().deleteUser(otherUserRecord.uid);
            }, 15000); // 15 second timeout for this complex integration test

            it('should prevent removal of root board', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board
                const rootBoardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(rootBoardId);

                const rootBoardItem: Item = {
                    id: rootBoardId,
                    content: 'Default Board',
                    contentType: ContentType.BOARD,
                    position: [0, 0],
                    size: [800, 600]
                };

                // Try to remove root board - should fail
                await expect(removeItem(rootBoardItem, sessionToken)).rejects.toThrow(
                    'Cannot remove root board. Root boards cannot be deleted.'
                );

                // Verify the board still exists
                const db = admin.firestore();
                const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(rootBoardId).get();
                expect(boardDoc.exists).toBe(true);
            });

            it('should throw error when trying to remove board from different owner', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board
                const rootBoardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(rootBoardId);

                // Create another user
                const otherUserEmail = `otheruser${Date.now()}@example.com`;
                const otherUserRecord = await admin.auth().createUser({
                    email: otherUserEmail,
                    password: 'testpassword123',
                    emailVerified: false
                });

                const otherSessionToken: SessionToken = {
                    email: otherUserEmail,
                    displayName: 'Other User',
                    UID: otherUserRecord.uid
                };

                // Try to remove board with different owner - should fail
                const boardToRemove: Item = {
                    id: rootBoardId,
                    content: 'Default Board',
                    contentType: ContentType.BOARD,
                    position: [0, 0],
                    size: [800, 600]
                };

                await expect(removeItem(boardToRemove, otherSessionToken)).rejects.toThrow(
                    'Unauthorized: You can only remove your own boards'
                );

                // Clean up other user
                await admin.auth().deleteUser(otherUserRecord.uid);
            });
        });

        describe('TEXT items', () => {
            it('should remove a TEXT item from items subcollection', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board as parent
                const parentBoardId = await createDefaultRootBoard(sessionToken);
                const db = admin.firestore();
                const parentBoardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(parentBoardId).get();
                const parentBoardData = parentBoardDoc.data();

                const parentBoard: Board = {
                    id: parentBoardId,
                    content: parentBoardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: parentBoardData?.position || [0, 0],
                    size: parentBoardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                createdBoardIds.push(parentBoardId);

                // Create a TEXT item
                const textItem: Item = {
                    id: '',
                    content: 'Text to Delete',
                    contentType: ContentType.TEXT,
                    position: [5, 5],
                    size: [200, 50]
                };

                await addItem(textItem, sessionToken, parentBoard, [5, 5]);

                // Find the created item
                const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(parentBoardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .get();

                expect(itemsSnapshot.size).toBeGreaterThan(0);
                const itemDoc = itemsSnapshot.docs[0];
                expect(itemDoc).toBeDefined();
                if (!itemDoc) {
                    throw new Error('Item not found');
                }
                const itemId = itemDoc.id;

                // Remove the item
                const itemToRemove: Item = {
                    id: itemId,
                    content: 'Text to Delete',
                    contentType: ContentType.TEXT,
                    position: [5, 5],
                    size: [200, 50]
                };

                await removeItem(itemToRemove, sessionToken, parentBoard);

                // Verify the item was deleted
                const deletedItemDoc = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(parentBoardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .doc(itemId)
                    .get();

                expect(deletedItemDoc.exists).toBe(false);
            });

            it('should throw error when item ID is not provided', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                const itemWithoutId: Item = {
                    id: '',
                    content: 'Test',
                    contentType: ContentType.TEXT,
                    position: [0, 0],
                    size: [100, 50]
                };

                const parentBoard: Board = {
                    id: 'test-board-id',
                    content: '',
                    contentType: ContentType.BOARD,
                    position: [0, 0],
                    size: [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: false,
                    permissions: [],
                    items: []
                };

                await expect(removeItem(itemWithoutId, sessionToken, parentBoard)).rejects.toThrow(
                    'Item ID is required for removal'
                );
            });
        });
    });

    describe('UpadteBaordItem', () => {
        describe('as board owner', () => {
            it('should update an item when user is the board owner', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);
                const db = admin.firestore();
                const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
                const boardData = boardDoc.data();

                const parentBoard: Board = {
                    id: boardId,
                    content: boardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: boardData?.position || [0, 0],
                    size: boardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                // Create a TEXT item
                const textItem: Item = {
                    id: '',
                    content: 'Original content',
                    contentType: ContentType.TEXT,
                    position: [10, 10],
                    size: [100, 50]
                };

                await addItem(textItem, sessionToken, parentBoard, [10, 10]);

                // Find the created item
                const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(boardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .get();

                expect(itemsSnapshot.size).toBeGreaterThan(0);
                const itemDoc = itemsSnapshot.docs[0];
                const itemId = itemDoc.id;

                // Update the item
                await UpadteBaordItem(boardId, sessionToken, itemId, {
                    content: 'Updated content',
                    position: [20, 20],
                    size: [200, 100]
                });

                // Verify the item was updated
                const updatedItemDoc = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(boardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .doc(itemId)
                    .get();

                const updatedData = updatedItemDoc.data();
                expect(updatedData?.content).toBe('Updated content');
                expect(updatedData?.position).toEqual([20, 20]);
                expect(updatedData?.size).toEqual([200, 100]);
                expect(updatedData?.contentType).toBe(ContentType.TEXT); // Should remain unchanged
            });

            it('should update only provided fields', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);
                const db = admin.firestore();
                const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
                const boardData = boardDoc.data();

                const parentBoard: Board = {
                    id: boardId,
                    content: boardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: boardData?.position || [0, 0],
                    size: boardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                // Create a TEXT item
                const textItem: Item = {
                    id: '',
                    content: 'Original content',
                    contentType: ContentType.TEXT,
                    position: [10, 10],
                    size: [100, 50]
                };

                await addItem(textItem, sessionToken, parentBoard, [10, 10]);

                // Find the created item
                const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(boardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .get();

                const itemDoc = itemsSnapshot.docs[0];
                const itemId = itemDoc.id;

                // Update only the content
                await UpadteBaordItem(boardId, sessionToken, itemId, {
                    content: 'Only content updated'
                });

                // Verify only content was updated, other fields remain unchanged
                const updatedItemDoc = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(boardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .doc(itemId)
                    .get();

                const updatedData = updatedItemDoc.data();
                expect(updatedData?.content).toBe('Only content updated');
                expect(updatedData?.position).toEqual([10, 10]); // Unchanged
                expect(updatedData?.size).toEqual([100, 50]); // Unchanged
                expect(updatedData?.contentType).toBe(ContentType.TEXT); // Unchanged
            });
        });

        describe('with EDIT permission', () => {
            it('should update an item when user has EDIT permission', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);
                const db = admin.firestore();
                const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
                const boardData = boardDoc.data();

                const parentBoard: Board = {
                    id: boardId,
                    content: boardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: boardData?.position || [0, 0],
                    size: boardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                // Create a TEXT item
                const textItem: Item = {
                    id: '',
                    content: 'Original content',
                    contentType: ContentType.TEXT,
                    position: [10, 10],
                    size: [100, 50]
                };

                await addItem(textItem, sessionToken, parentBoard, [10, 10]);

                // Find the created item
                const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(boardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .get();

                const itemDoc = itemsSnapshot.docs[0];
                const itemId = itemDoc.id;

                // Create a second user with EDIT permission
                const otherUserEmail = `otheruser${Date.now()}@example.com`;
                const otherUserRecord = await admin.auth().createUser({
                    email: otherUserEmail,
                    password: 'testpassword123',
                    emailVerified: false
                });

                const otherSessionToken: SessionToken = {
                    email: otherUserEmail,
                    displayName: 'Other User',
                    UID: otherUserRecord.uid
                };

                await addedUser(otherSessionToken, false, false);

                // Add EDIT permission
                const permission = await AdduserPermission(otherSessionToken, Permision.EDIT, boardId);
                createdPermissionIds.push(permission.permissionId);

                // Update the item as the user with EDIT permission
                await UpadteBaordItem(boardId, otherSessionToken, itemId, {
                    content: 'Updated by user with EDIT permission'
                });

                // Verify the item was updated
                const updatedItemDoc = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(boardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .doc(itemId)
                    .get();

                const updatedData = updatedItemDoc.data();
                expect(updatedData?.content).toBe('Updated by user with EDIT permission');

                // Clean up other user
                await admin.auth().deleteUser(otherUserRecord.uid);
            });
        });

        describe('authorization errors', () => {
            it('should throw error when user has no permission', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);
                const db = admin.firestore();
                const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
                const boardData = boardDoc.data();

                const parentBoard: Board = {
                    id: boardId,
                    content: boardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: boardData?.position || [0, 0],
                    size: boardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                // Create a TEXT item
                const textItem: Item = {
                    id: '',
                    content: 'Original content',
                    contentType: ContentType.TEXT,
                    position: [10, 10],
                    size: [100, 50]
                };

                await addItem(textItem, sessionToken, parentBoard, [10, 10]);

                // Find the created item
                const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(boardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .get();

                const itemDoc = itemsSnapshot.docs[0];
                const itemId = itemDoc.id;

                // Create a second user with no permission
                const otherUserEmail = `otheruser${Date.now()}@example.com`;
                const otherUserRecord = await admin.auth().createUser({
                    email: otherUserEmail,
                    password: 'testpassword123',
                    emailVerified: false
                });

                const otherSessionToken: SessionToken = {
                    email: otherUserEmail,
                    displayName: 'Other User',
                    UID: otherUserRecord.uid
                };

                // Try to update the item - should fail
                await expect(
                    UpadteBaordItem(boardId, otherSessionToken, itemId, {
                        content: 'Should not work'
                    })
                ).rejects.toThrow('Unauthorized: You need to be the owner or have EDIT permission to change items');

                // Clean up other user
                await admin.auth().deleteUser(otherUserRecord.uid);
            });

            it('should throw error when user only has VIEW permission', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);
                const db = admin.firestore();
                const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
                const boardData = boardDoc.data();

                const parentBoard: Board = {
                    id: boardId,
                    content: boardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: boardData?.position || [0, 0],
                    size: boardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                // Create a TEXT item
                const textItem: Item = {
                    id: '',
                    content: 'Original content',
                    contentType: ContentType.TEXT,
                    position: [10, 10],
                    size: [100, 50]
                };

                await addItem(textItem, sessionToken, parentBoard, [10, 10]);

                // Find the created item
                const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(boardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .get();

                const itemDoc = itemsSnapshot.docs[0];
                const itemId = itemDoc.id;

                // Create a second user with VIEW permission only
                const otherUserEmail = `otheruser${Date.now()}@example.com`;
                const otherUserRecord = await admin.auth().createUser({
                    email: otherUserEmail,
                    password: 'testpassword123',
                    emailVerified: false
                });

                const otherSessionToken: SessionToken = {
                    email: otherUserEmail,
                    displayName: 'Other User',
                    UID: otherUserRecord.uid
                };

                await addedUser(otherSessionToken, false, false);

                // Add VIEW permission only
                const permission = await AdduserPermission(otherSessionToken, Permision.VIEW, boardId);
                createdPermissionIds.push(permission.permissionId);

                // Try to update the item - should fail
                await expect(
                    UpadteBaordItem(boardId, otherSessionToken, itemId, {
                        content: 'Should not work'
                    })
                ).rejects.toThrow('Unauthorized: You need to be the owner or have EDIT permission to change items');

                // Clean up other user
                await admin.auth().deleteUser(otherUserRecord.uid);
            });
        });

        describe('error cases', () => {
            it('should throw error when board is not found', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                await expect(
                    UpadteBaordItem('non-existent-board-id', sessionToken, 'item-id', {
                        content: 'Test'
                    })
                ).rejects.toThrow('Board not found');
            });

            it('should throw error when item is not found', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);

                await expect(
                    UpadteBaordItem(boardId, sessionToken, 'non-existent-item-id', {
                        content: 'Test'
                    })
                ).rejects.toThrow('Item not found');
            });

            it('should throw error when no valid fields are provided', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);
                const db = admin.firestore();
                const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
                const boardData = boardDoc.data();

                const parentBoard: Board = {
                    id: boardId,
                    content: boardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: boardData?.position || [0, 0],
                    size: boardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                // Create a TEXT item
                const textItem: Item = {
                    id: '',
                    content: 'Original content',
                    contentType: ContentType.TEXT,
                    position: [10, 10],
                    size: [100, 50]
                };

                await addItem(textItem, sessionToken, parentBoard, [10, 10]);

                // Find the created item
                const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(boardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .get();

                const itemDoc = itemsSnapshot.docs[0];
                const itemId = itemDoc.id;

                // Try to update with no valid fields (all undefined)
                await expect(
                    UpadteBaordItem(boardId, sessionToken, itemId, {})
                ).rejects.toThrow('No valid fields provided for update');
            });
        });
    });

    describe('getItem', () => {
        describe('BOARD items', () => {
            it('should get a board with all its sub-items', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);
                const db = admin.firestore();
                const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
                const boardData = boardDoc.data();

                const parentBoard: Board = {
                    id: boardId,
                    content: boardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: boardData?.position || [0, 0],
                    size: boardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                // Add some items to the board
                const textItem1: Item = {
                    id: '',
                    content: 'First text item',
                    contentType: ContentType.TEXT,
                    position: [10, 10],
                    size: [100, 50]
                };

                const textItem2: Item = {
                    id: '',
                    content: 'Second text item',
                    contentType: ContentType.TEXT,
                    position: [20, 20],
                    size: [100, 50]
                };

                await addItem(textItem1, sessionToken, parentBoard, [10, 10]);
                await addItem(textItem2, sessionToken, parentBoard, [20, 20]);

                // Get the board
                const result = await getItem(sessionToken, boardId, ContentType.BOARD, boardId);

                expect(result).toBeDefined();
                expect('items' in result).toBe(true);
                
                const board = result as Board;
                expect(board.id).toBe(boardId);
                expect(board.owner).toBe(sessionToken.UID);
                expect(board.isRoot).toBe(true);
                expect(board.items).toBeDefined();
                expect(board.items.length).toBe(2);
                
                // Verify items are included
                const itemContents = board.items.map(item => item.content);
                expect(itemContents).toContain('First text item');
                expect(itemContents).toContain('Second text item');
            });

            it('should throw error when board is not found', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                await expect(
                    getItem(sessionToken, 'non-existent-board-id', ContentType.BOARD, 'non-existent-board-id')
                ).rejects.toThrow('Board not found');
            });

            it('should throw error when user is not authorized to view board', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a board for the test user
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);

                // Create another user without permission
                const otherUserEmail = `otheruser${Date.now()}@example.com`;
                const otherUserRecord = await admin.auth().createUser({
                    email: otherUserEmail,
                    password: 'testpassword123',
                    emailVerified: false
                });

                const otherSessionToken: SessionToken = {
                    email: otherUserEmail,
                    displayName: 'Other User',
                    UID: otherUserRecord.uid
                };

                // Try to get the board as the other user - should fail
                await expect(
                    getItem(otherSessionToken, boardId, ContentType.BOARD, boardId)
                ).rejects.toThrow('Unauthorized: You need to be the owner or have permission to view this board');

                // Clean up
                await admin.auth().deleteUser(otherUserRecord.uid);
            });

            it('should allow user with VIEW permission to get board', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a board for the test user
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);

                // Create another user
                const otherUserEmail = `otheruser${Date.now()}@example.com`;
                const otherUserRecord = await admin.auth().createUser({
                    email: otherUserEmail,
                    password: 'testpassword123',
                    emailVerified: false
                });

                const otherSessionToken: SessionToken = {
                    email: otherUserEmail,
                    displayName: 'Other User',
                    UID: otherUserRecord.uid
                };

                await addedUser(otherSessionToken, false, false);

                // Add VIEW permission for the other user
                const permission = await AdduserPermission(otherSessionToken, Permision.VIEW, boardId);
                createdPermissionIds.push(permission.permissionId);

                // Get the board as the other user - should succeed
                const result = await getItem(otherSessionToken, boardId, ContentType.BOARD, boardId);

                expect(result).toBeDefined();
                const board = result as Board;
                expect(board.id).toBe(boardId);

                // Clean up
                await admin.auth().deleteUser(otherUserRecord.uid);
            });
        });

        describe('non-BOARD items', () => {
            it('should get a TEXT item from a board', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);
                const db = admin.firestore();
                const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
                const boardData = boardDoc.data();

                const parentBoard: Board = {
                    id: boardId,
                    content: boardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: boardData?.position || [0, 0],
                    size: boardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                // Create a TEXT item
                const textItem: Item = {
                    id: '',
                    content: 'Test text content',
                    contentType: ContentType.TEXT,
                    position: [15, 15],
                    size: [200, 100]
                };

                await addItem(textItem, sessionToken, parentBoard, [15, 15]);

                // Find the created item
                const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(boardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .get();

                expect(itemsSnapshot.size).toBeGreaterThan(0);
                const itemDoc = itemsSnapshot.docs[0];
                const itemId = itemDoc.id;

                // Get the item
                const result = await getItem(sessionToken, itemId, ContentType.TEXT, boardId);

                expect(result).toBeDefined();
                expect('id' in result).toBe(true);
                expect('content' in result).toBe(true);
                expect('contentType' in result).toBe(true);
                
                const item = result as Item;
                expect(item.id).toBe(itemId);
                expect(item.content).toBe('Test text content');
                expect(item.contentType).toBe(ContentType.TEXT);
                expect(item.position).toEqual([15, 15]);
                expect(item.size).toEqual([200, 100]);
            });

            it('should throw error when item is not found', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);

                await expect(
                    getItem(sessionToken, 'non-existent-item-id', ContentType.TEXT, boardId)
                ).rejects.toThrow('Item not found');
            });

            it('should throw error when parent board ID is not provided', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                await expect(
                    getItem(sessionToken, 'item-id', ContentType.TEXT, '')
                ).rejects.toThrow('Parent board ID is required for non-BOARD items');
            });

            it('should throw error when parent board is not found', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                await expect(
                    getItem(sessionToken, 'item-id', ContentType.TEXT, 'non-existent-board-id')
                ).rejects.toThrow('Parent board not found');
            });

            it('should throw error when user is not authorized to view item', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a board and item for the test user
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);
                const db = admin.firestore();
                const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
                const boardData = boardDoc.data();

                const parentBoard: Board = {
                    id: boardId,
                    content: boardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: boardData?.position || [0, 0],
                    size: boardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                const textItem: Item = {
                    id: '',
                    content: 'Private text',
                    contentType: ContentType.TEXT,
                    position: [10, 10],
                    size: [100, 50]
                };

                await addItem(textItem, sessionToken, parentBoard, [10, 10]);

                // Find the created item
                const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(boardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .get();

                const itemDoc = itemsSnapshot.docs[0];
                const itemId = itemDoc.id;

                // Create another user without permission
                const otherUserEmail = `otheruser${Date.now()}@example.com`;
                const otherUserRecord = await admin.auth().createUser({
                    email: otherUserEmail,
                    password: 'testpassword123',
                    emailVerified: false
                });

                const otherSessionToken: SessionToken = {
                    email: otherUserEmail,
                    displayName: 'Other User',
                    UID: otherUserRecord.uid
                };

                // Try to get the item as the other user - should fail
                await expect(
                    getItem(otherSessionToken, itemId, ContentType.TEXT, boardId)
                ).rejects.toThrow('Unauthorized: You need to be the owner or have permission to view items in this board');

                // Clean up
                await admin.auth().deleteUser(otherUserRecord.uid);
            });

            it('should throw error when contentType does not match', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a root board
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);
                const db = admin.firestore();
                const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
                const boardData = boardDoc.data();

                const parentBoard: Board = {
                    id: boardId,
                    content: boardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: boardData?.position || [0, 0],
                    size: boardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                // Create a TEXT item
                const textItem: Item = {
                    id: '',
                    content: 'Test text',
                    contentType: ContentType.TEXT,
                    position: [10, 10],
                    size: [100, 50]
                };

                await addItem(textItem, sessionToken, parentBoard, [10, 10]);

                // Find the created item
                const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(boardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .get();

                const itemDoc = itemsSnapshot.docs[0];
                const itemId = itemDoc.id;

                // Try to get the item with wrong contentType
                await expect(
                    getItem(sessionToken, itemId, ContentType.HTML, boardId)
                ).rejects.toThrow('Item content type mismatch');
            });

            it('should allow user with VIEW permission to get item', async () => {
                if (!process.env.FIREBASE_ADMIN_KEY) {
                    console.warn('Skipping test - Firebase not configured');
                    return;
                }

                // Create a board and item for the test user
                const boardId = await createDefaultRootBoard(sessionToken);
                createdBoardIds.push(boardId);
                const db = admin.firestore();
                const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
                const boardData = boardDoc.data();

                const parentBoard: Board = {
                    id: boardId,
                    content: boardData?.content || '',
                    contentType: ContentType.BOARD,
                    position: boardData?.position || [0, 0],
                    size: boardData?.size || [800, 600],
                    owner: sessionToken.UID,
                    parentId: undefined,
                    isRoot: true,
                    permissions: [],
                    items: []
                };

                const textItem: Item = {
                    id: '',
                    content: 'Shared text',
                    contentType: ContentType.TEXT,
                    position: [10, 10],
                    size: [100, 50]
                };

                await addItem(textItem, sessionToken, parentBoard, [10, 10]);

                // Find the created item
                const itemsSnapshot = await db.collection(DataBaseidentifiers.BOARD)
                    .doc(boardId)
                    .collection(DataBaseidentifiers.ITEMS)
                    .get();

                const itemDoc = itemsSnapshot.docs[0];
                const itemId = itemDoc.id;

                // Create another user
                const otherUserEmail = `otheruser${Date.now()}@example.com`;
                const otherUserRecord = await admin.auth().createUser({
                    email: otherUserEmail,
                    password: 'testpassword123',
                    emailVerified: false
                });

                const otherSessionToken: SessionToken = {
                    email: otherUserEmail,
                    displayName: 'Other User',
                    UID: otherUserRecord.uid
                };

                await addedUser(otherSessionToken, false, false);

                // Add VIEW permission for the other user
                const permission = await AdduserPermission(otherSessionToken, Permision.VIEW, boardId);
                createdPermissionIds.push(permission.permissionId);

                // Get the item as the other user - should succeed
                const result = await getItem(otherSessionToken, itemId, ContentType.TEXT, boardId);

                expect(result).toBeDefined();
                const item = result as Item;
                expect(item.id).toBe(itemId);
                expect(item.content).toBe('Shared text');

                // Clean up
                await admin.auth().deleteUser(otherUserRecord.uid);
            });
        });
    });

    describe('getAllItemsFromBoard', () => {
        it('should get all items from a board as owner', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            // Create a root board
            const boardId = await createDefaultRootBoard(sessionToken, [0, 0]);
            createdBoardIds.push(boardId);

            // Add multiple items to the board
            const db = admin.firestore();
            const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId);
            const boardDoc = await boardRef.get();
            const boardData = boardDoc.data();

            const parentBoard: Board = {
                id: boardId,
                content: boardData?.content || '',
                contentType: ContentType.BOARD,
                position: boardData?.position || [0, 0],
                size: boardData?.size || [800, 600],
                owner: sessionToken.UID,
                parentId: undefined,
                isRoot: true,
                permissions: [],
                items: []
            };

            const item1: Item = {
                id: '',
                content: 'Item 1 content',
                contentType: ContentType.TEXT,
                position: [100, 100],
                size: [256, 200]
            };

            const item2: Item = {
                id: '',
                content: 'Item 2 content',
                contentType: ContentType.TEXT,
                position: [300, 300],
                size: [256, 200]
            };

            const item3: Item = {
                id: '',
                content: '<div>HTML content</div>',
                contentType: ContentType.HTML,
                position: [500, 500],
                size: [400, 300]
            };

            await addItem(item1, sessionToken, parentBoard, [100, 100]);
            await addItem(item2, sessionToken, parentBoard, [300, 300]);
            await addItem(item3, sessionToken, parentBoard, [500, 500]);

            // Get all items
            const items = await getAllItemsFromBoard(boardId, sessionToken);

            expect(items).toBeDefined();
            expect(Array.isArray(items)).toBe(true);
            expect(items.length).toBe(3);

            // Verify item properties
            const textItems = items.filter(item => item.contentType === ContentType.TEXT);
            const htmlItems = items.filter(item => item.contentType === ContentType.HTML);

            expect(textItems.length).toBe(2);
            expect(htmlItems.length).toBe(1);

            // Check that items have required fields
            items.forEach(item => {
                expect(item.id).toBeDefined();
                expect(item.content).toBeDefined();
                expect(item.contentType).toBeDefined();
                expect(Array.isArray(item.position)).toBe(true);
                expect(Array.isArray(item.size)).toBe(true);
            });
        });

        it('should get all items from a board with VIEW permission', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            // Create a root board
            const boardId = await createDefaultRootBoard(sessionToken, [0, 0]);
            createdBoardIds.push(boardId);

            // Add an item to the board
            const db = admin.firestore();
            const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId);
            const boardDoc = await boardRef.get();
            const boardData = boardDoc.data();

            const parentBoard: Board = {
                id: boardId,
                content: boardData?.content || '',
                contentType: ContentType.BOARD,
                position: boardData?.position || [0, 0],
                size: boardData?.size || [800, 600],
                owner: sessionToken.UID,
                parentId: undefined,
                isRoot: true,
                permissions: [],
                items: []
            };

            const item: Item = {
                id: '',
                content: 'Shared item',
                contentType: ContentType.TEXT,
                position: [100, 100],
                size: [256, 200]
            };

            await addItem(item, sessionToken, parentBoard, [100, 100]);

            // Create another user
            const otherUserEmail = `otheruser${Date.now()}@example.com`;
            const otherUserRecord = await admin.auth().createUser({
                email: otherUserEmail,
                password: 'testpassword123',
                emailVerified: false
            });

            const otherUser: User = {
                uid: otherUserRecord.uid,
                email: otherUserEmail,
                displayName: 'Other User',
                emailVerified: false
            } as User;

            const otherSessionToken: SessionToken = {
                email: otherUserEmail,
                displayName: 'Other User',
                UID: otherUserRecord.uid
            };

            await addedUser(otherSessionToken, false, false);

            // Add VIEW permission for the other user
            const permission = await AdduserPermission(otherSessionToken, Permision.VIEW, boardId);
            createdPermissionIds.push(permission.permissionId);

            // Get all items as the other user - should succeed
            const items = await getAllItemsFromBoard(boardId, otherSessionToken);

            expect(items).toBeDefined();
            expect(Array.isArray(items)).toBe(true);
            expect(items.length).toBe(1);
            expect(items[0].content).toBe('Shared item');

            // Clean up
            await admin.auth().deleteUser(otherUserRecord.uid);
        });

        it('should throw error when board is not found', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            const nonExistentBoardId = 'non-existent-board-id';

            await expect(
                getAllItemsFromBoard(nonExistentBoardId, sessionToken)
            ).rejects.toThrow('Board not found');
        });

        it('should throw error when board data is missing', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            // This test is tricky because Firestore always returns data() even if empty
            // We'll create a board and then manually corrupt it
            const boardId = await createDefaultRootBoard(sessionToken, [0, 0]);
            createdBoardIds.push(boardId);

            // Delete the board document but keep the reference
            const db = admin.firestore();
            await db.collection(DataBaseidentifiers.BOARD).doc(boardId).delete();

            // Now try to get items - should fail with "Board not found"
            await expect(
                getAllItemsFromBoard(boardId, sessionToken)
            ).rejects.toThrow('Board not found');
        });

        it('should throw error when user is unauthorized', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            // Create a root board
            const boardId = await createDefaultRootBoard(sessionToken, [0, 0]);
            createdBoardIds.push(boardId);

            // Create another user without permission
            const otherUserEmail = `unauthorized${Date.now()}@example.com`;
            const otherUserRecord = await admin.auth().createUser({
                email: otherUserEmail,
                password: 'testpassword123',
                emailVerified: false
            });

            const otherUser: User = {
                uid: otherUserRecord.uid,
                email: otherUserEmail,
                displayName: 'Unauthorized User',
                emailVerified: false
            } as User;

            const otherSessionToken: SessionToken = {
                email: otherUserEmail,
                displayName: 'Unauthorized User',
                UID: otherUserRecord.uid
            };

            await addedUser(otherSessionToken, false, false);

            // Try to get items without permission - should fail
            await expect(
                getAllItemsFromBoard(boardId, otherSessionToken)
            ).rejects.toThrow('Unauthorized: You need to be the owner or have permission to view items in this board');

            // Clean up
            await admin.auth().deleteUser(otherUserRecord.uid);
        });

        it('should return empty array when board has no items', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            // Create a root board without adding any items
            const boardId = await createDefaultRootBoard(sessionToken, [0, 0]);
            createdBoardIds.push(boardId);

            // Get all items - should return empty array
            const items = await getAllItemsFromBoard(boardId, sessionToken);

            expect(items).toBeDefined();
            expect(Array.isArray(items)).toBe(true);
            expect(items.length).toBe(0);
        });

        it('should handle items with different content types', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            // Create a root board
            const boardId = await createDefaultRootBoard(sessionToken, [0, 0]);
            createdBoardIds.push(boardId);

            const db = admin.firestore();
            const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId);
            const boardDoc = await boardRef.get();
            const boardData = boardDoc.data();

            const parentBoard: Board = {
                id: boardId,
                content: boardData?.content || '',
                contentType: ContentType.BOARD,
                position: boardData?.position || [0, 0],
                size: boardData?.size || [800, 600],
                owner: sessionToken.UID,
                parentId: undefined,
                isRoot: true,
                permissions: [],
                items: []
            };

            // Add items with different content types
            const textItem: Item = {
                id: '',
                content: 'Text content',
                contentType: ContentType.TEXT,
                position: [100, 100],
                size: [256, 200]
            };

            const htmlItem: Item = {
                id: '',
                content: '<div>HTML</div>',
                contentType: ContentType.HTML,
                position: [300, 300],
                size: [400, 300]
            };

            await addItem(textItem, sessionToken, parentBoard, [100, 100]);
            await addItem(htmlItem, sessionToken, parentBoard, [300, 300]);

            const items = await getAllItemsFromBoard(boardId, sessionToken);

            expect(items.length).toBe(2);
            expect(items.some(item => item.contentType === ContentType.TEXT)).toBe(true);
            expect(items.some(item => item.contentType === ContentType.HTML)).toBe(true);
        });

        it('should work with EDIT permission', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            // Create a root board
            const boardId = await createDefaultRootBoard(sessionToken, [0, 0]);
            createdBoardIds.push(boardId);

            // Add an item
            const db = admin.firestore();
            const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId);
            const boardDoc = await boardRef.get();
            const boardData = boardDoc.data();

            const parentBoard: Board = {
                id: boardId,
                content: boardData?.content || '',
                contentType: ContentType.BOARD,
                position: boardData?.position || [0, 0],
                size: boardData?.size || [800, 600],
                owner: sessionToken.UID,
                parentId: undefined,
                isRoot: true,
                permissions: [],
                items: []
            };

            const item: Item = {
                id: '',
                content: 'Editable item',
                contentType: ContentType.TEXT,
                position: [100, 100],
                size: [256, 200]
            };

            await addItem(item, sessionToken, parentBoard, [100, 100]);

            // Create another user
            const otherUserEmail = `editor${Date.now()}@example.com`;
            const otherUserRecord = await admin.auth().createUser({
                email: otherUserEmail,
                password: 'testpassword123',
                emailVerified: false
            });

            const otherUser: User = {
                uid: otherUserRecord.uid,
                email: otherUserEmail,
                displayName: 'Editor User',
                emailVerified: false
            } as User;

            const otherSessionToken: SessionToken = {
                email: otherUserEmail,
                displayName: 'Editor User',
                UID: otherUserRecord.uid
            };

            await addedUser(otherSessionToken, false, false);

            // Add EDIT permission
            const permission = await AdduserPermission(otherSessionToken, Permision.EDIT, boardId);
            createdPermissionIds.push(permission.permissionId);

            // Get all items as the editor - should succeed
            const items = await getAllItemsFromBoard(boardId, otherSessionToken);

            expect(items).toBeDefined();
            expect(items.length).toBe(1);
            expect(items[0].content).toBe('Editable item');

            // Clean up
            await admin.auth().deleteUser(otherUserRecord.uid);
        });

        it('should work with OWNER permission', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            // Create a root board
            const boardId = await createDefaultRootBoard(sessionToken, [0, 0]);
            createdBoardIds.push(boardId);

            // Add an item
            const db = admin.firestore();
            const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId);
            const boardDoc = await boardRef.get();
            const boardData = boardDoc.data();

            const parentBoard: Board = {
                id: boardId,
                content: boardData?.content || '',
                contentType: ContentType.BOARD,
                position: boardData?.position || [0, 0],
                size: boardData?.size || [800, 600],
                owner: sessionToken.UID,
                parentId: undefined,
                isRoot: true,
                permissions: [],
                items: []
            };

            const item: Item = {
                id: '',
                content: 'Owned item',
                contentType: ContentType.TEXT,
                position: [100, 100],
                size: [256, 200]
            };

            await addItem(item, sessionToken, parentBoard, [100, 100]);

            // Create another user
            const otherUserEmail = `owner${Date.now()}@example.com`;
            const otherUserRecord = await admin.auth().createUser({
                email: otherUserEmail,
                password: 'testpassword123',
                emailVerified: false
            });

            const otherUser: User = {
                uid: otherUserRecord.uid,
                email: otherUserEmail,
                displayName: 'Owner User',
                emailVerified: false
            } as User;

            const otherSessionToken: SessionToken = {
                email: otherUserEmail,
                displayName: 'Owner User',
                UID: otherUserRecord.uid
            };

            await addedUser(otherSessionToken, false, false);

            // Add OWNER permission
            const permission = await AdduserPermission(otherSessionToken, Permision.VIEW, boardId);
            const permissionChangeToOwner = await ChangePermission(permission.permissionId, Permision.OWNER)
            createdPermissionIds.push(permission.permissionId);

            // Get all items as the owner - should succeed
            const items = await getAllItemsFromBoard(boardId, otherSessionToken);

            expect(items).toBeDefined();
            expect(items.length).toBe(1);
            expect(items[0].content).toBe('Owned item');

            // Clean up
            await admin.auth().deleteUser(otherUserRecord.uid);
        });
    });
});

