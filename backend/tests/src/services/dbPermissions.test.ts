import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { 
    AdduserPermission, 
    ChangePermission, 
    RemovePermission,
    getPermision
} from '../../../src/services/dbPermissions.js';
import { addedUser, DataBaseidentifiers } from '../../../src/services/dbUserItems.js';
import type { User } from 'firebase/auth';
import type { SessionToken } from '../../../src/datContainers/sessionToken.js';
import { Permision } from '../../../src/datContainers/dataTypes.js';

// Import Firebase initialization to ensure db is set up
import '../../../src/services/firebase.js';

dotenv.config();

describe('dbPermissions', () => {
    let sessionToken: SessionToken;
    let createdPermissionIds: string[] = [];
    let createdBoardIds: string[] = [];
    let createdUserIds: string[] = [];

    beforeEach(async () => {
        // Skip tests if Firebase is not configured
        if (!process.env.FIREBASE_ADMIN_KEY) {
            console.warn('Firebase not configured, skipping dbPermissions tests');
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

            // Create user document in Firestore
            await addedUser(sessionToken, false, false);

            // Create a test board for permissions
            const db = admin.firestore();
            const boardRef = db.collection(DataBaseidentifiers.BOARD).doc();
            await boardRef.set({
                id: boardRef.id,
                owner: userRecord.uid,
                contentType: 'board',
                isRoot: true,
                content: 'Test Board',
                position: [0, 0]
            });
            createdBoardIds.push(boardRef.id);

            createdPermissionIds = [];
            createdUserIds = [userRecord.uid];
        } catch (error) {
            console.error('Failed to create test user:', error);
            throw error;
        }
    });

    afterEach(async () => {
        // Clean up created test data
        if (!process.env.FIREBASE_ADMIN_KEY) return;

        const db = admin.firestore();

        // Delete permission documents
        for (const permissionId of createdPermissionIds) {
            try {
                await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permissionId).delete();
            } catch (error) {
                // Document might not exist, ignore
            }
        }

        // Clean up user permissionIds arrays
        for (const userId of createdUserIds) {
            try {
                const userDoc = await db.collection(DataBaseidentifiers.USER).doc(userId).get();
                if (userDoc.exists) {
                    await db.collection(DataBaseidentifiers.USER).doc(userId).update({
                        permissionIds: admin.firestore.FieldValue.delete()
                    });
                }
            } catch (error) {
                // Ignore errors
            }
        }

        // Delete user documents
        for (const userId of createdUserIds) {
            try {
                await db.collection(DataBaseidentifiers.USER).doc(userId).delete();
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

        // Delete test users from Firebase Auth
        for (const userId of createdUserIds) {
            try {
                await admin.auth().deleteUser(userId);
            } catch (error) {
                // User might not exist, ignore
            }
        }

        // Reset arrays
        createdPermissionIds = [];
        createdBoardIds = [];
        createdUserIds = [];
    });

    describe('AdduserPermission', () => {
        it('should add a VIEW permission successfully', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            const boardId = createdBoardIds[0];
            const result = await AdduserPermission(sessionToken, Permision.VIEW, boardId);

            expect(result).toMatchObject({
                boardId: boardId,
                userId: sessionToken.UID,
                permission: Permision.VIEW
            });
            expect(result.permissionId).toBeDefined();
            expect(result.timestamp).toBeDefined();
            expect(typeof result.timestamp).toBe('string');

            createdPermissionIds.push(result.permissionId);

            // Verify permission document exists
            const db = admin.firestore();
            const permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(result.permissionId).get();
            expect(permissionDoc.exists).toBe(true);
            expect(permissionDoc.data()?.userId).toBe(sessionToken.UID);
            expect(permissionDoc.data()?.boardId).toBe(boardId);
            expect(permissionDoc.data()?.permission).toBe(Permision.VIEW);

            // Verify permission ID was added to user's permissionIds array
            const userDoc = await db.collection(DataBaseidentifiers.USER).doc(sessionToken.UID).get();
            const permissionIds = userDoc.data()?.permissionIds || [];
            expect(permissionIds).toContain(result.permissionId);

            // Verify permission ID was added to board's permissions array
            const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
            const boardPermissions = boardDoc.data()?.permissions || [];
            expect(boardPermissions).toContain(result.permissionId);
        });

        it('should add an EDIT permission successfully', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            const boardId = createdBoardIds[0];
            const result = await AdduserPermission(sessionToken, Permision.EDIT, boardId);

            expect(result).toMatchObject({
                boardId: boardId,
                userId: sessionToken.UID,
                permission: Permision.EDIT
            });
            expect(result.permissionId).toBeDefined();
            expect(result.timestamp).toBeDefined();

            createdPermissionIds.push(result.permissionId);

            // Verify permission document exists
            const db = admin.firestore();
            const permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(result.permissionId).get();
            expect(permissionDoc.exists).toBe(true);
            expect(permissionDoc.data()?.permission).toBe(Permision.EDIT);

            // Verify permission ID was added to board's permissions array
            const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
            const boardPermissions = boardDoc.data()?.permissions || [];
            expect(boardPermissions).toContain(result.permissionId);
        });

        it('should add multiple permissions to the same user', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            const boardId = createdBoardIds[0];
            const result1 = await AdduserPermission(sessionToken, Permision.VIEW, boardId);
            const result2 = await AdduserPermission(sessionToken, Permision.EDIT, boardId);

            createdPermissionIds.push(result1.permissionId, result2.permissionId);

            // Verify both permissions exist
            const db = admin.firestore();
            const permission1 = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(result1.permissionId).get();
            const permission2 = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(result2.permissionId).get();

            expect(permission1.exists).toBe(true);
            expect(permission2.exists).toBe(true);

            // Verify both permission IDs are in user's permissionIds array
            const userDoc = await db.collection(DataBaseidentifiers.USER).doc(sessionToken.UID).get();
            const permissionIds = userDoc.data()?.permissionIds || [];
            expect(permissionIds).toContain(result1.permissionId);
            expect(permissionIds).toContain(result2.permissionId);

            // Verify both permission IDs are in board's permissions array
            const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
            const boardPermissions = boardDoc.data()?.permissions || [];
            expect(boardPermissions).toContain(result1.permissionId);
            expect(boardPermissions).toContain(result2.permissionId);
        });

        it('should throw error when user document does not exist', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            const invalidUser: SessionToken = {
                email: 'nonexistent@example.com',
                displayName: 'Nonexistent User',
                UID: 'nonexistent-uid-12345'
            };

            const boardId = createdBoardIds[0];
            await expect(
                AdduserPermission(invalidUser, Permision.VIEW, boardId)
            ).rejects.toThrow('User not found');
        });

        it('should throw error when trying to add OWNER permission', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            const boardId = createdBoardIds[0];
            await expect(
                AdduserPermission(sessionToken, Permision.OWNER, boardId)
            ).rejects.toThrow('Owner can only be-changed using ChangePermssion()');
        });
    });

    describe('ChangePermission', () => {
        it('should change permission from VIEW to EDIT', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            const boardId = createdBoardIds[0];
            const permission = await AdduserPermission(sessionToken, Permision.VIEW, boardId);
            createdPermissionIds.push(permission.permissionId);

            // Verify initial permission is VIEW
            const db = admin.firestore();
            let permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permission.permissionId).get();
            expect(permissionDoc.data()?.permission).toBe(Permision.VIEW);

            // Change permission to EDIT
            await ChangePermission(permission.permissionId, Permision.EDIT);

            // Verify permission was updated from VIEW to EDIT
            permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permission.permissionId).get();
            expect(permissionDoc.data()?.permission).toBe(Permision.EDIT);
            expect(permissionDoc.data()?.timeStamp).toBeDefined();
        });

        it('should change permission from EDIT to VIEW', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            const boardId = createdBoardIds[0];
            const permission = await AdduserPermission(sessionToken, Permision.EDIT, boardId);
            createdPermissionIds.push(permission.permissionId);

            // Change permission to VIEW
            await ChangePermission(permission.permissionId, Permision.VIEW);

            // Verify permission was updated
            const db = admin.firestore();
            const permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permission.permissionId).get();
            expect(permissionDoc.data()?.permission).toBe(Permision.VIEW);
        });

        it('should throw error when permission document does not exist', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            const nonexistentPermissionId = 'nonexistent-permission-id-12345';
            await expect(
                ChangePermission(nonexistentPermissionId, Permision.EDIT)
            ).rejects.toThrow('Permission not found');
        });

        it('should change permission to OWNER and swap board ownership', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            // Create a second user to become the new owner
            const newOwnerEmail = `newowner${Date.now()}@example.com`;
            const newOwnerRecord = await admin.auth().createUser({
                email: newOwnerEmail,
                password: 'testpassword123',
                emailVerified: false
            });

            const newOwnerToken: SessionToken = {
                email: newOwnerEmail,
                displayName: 'New Owner',
                UID: newOwnerRecord.uid
            };

            await addedUser(newOwnerToken, false, false);
            createdUserIds.push(newOwnerRecord.uid);

            const boardId = createdBoardIds[0];
            const db = admin.firestore();

            // Get original owner
            const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
            const originalOwnerId = boardDoc.data()?.owner;

            // Create a permission for the new owner
            const permission = await AdduserPermission(newOwnerToken, Permision.EDIT, boardId);
            createdPermissionIds.push(permission.permissionId);

            // Change permission to OWNER
            await ChangePermission(permission.permissionId, Permision.OWNER);

            // Verify board owner was changed to the new owner
            const updatedBoardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
            expect(updatedBoardDoc.data()?.owner).toBe(newOwnerToken.UID);

            // Verify the permission document now represents the old owner's permission (EDIT by default)
            const permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permission.permissionId).get();
            expect(permissionDoc.data()?.userId).toBe(originalOwnerId);
            expect(permissionDoc.data()?.permission).toBe(Permision.EDIT);

            // Clean up
            await admin.auth().deleteUser(newOwnerRecord.uid);
        });
    });

    describe('RemovePermission', () => {
        it('should remove a permission successfully', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            const boardId = createdBoardIds[0];
            const permission = await AdduserPermission(sessionToken, Permision.VIEW, boardId);
            const permissionId = permission.permissionId;

            // Verify permission exists before removal
            const db = admin.firestore();
            let permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permissionId).get();
            expect(permissionDoc.exists).toBe(true);

            // Verify permission ID is in user's permissionIds array
            let userDoc = await db.collection(DataBaseidentifiers.USER).doc(sessionToken.UID).get();
            let permissionIds = userDoc.data()?.permissionIds || [];
            expect(permissionIds).toContain(permissionId);

            // Remove permission
            await RemovePermission(permissionId);

            // Verify permission document was deleted
            permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permissionId).get();
            expect(permissionDoc.exists).toBe(false);

            // Verify permission ID was removed from user's permissionIds array
            userDoc = await db.collection(DataBaseidentifiers.USER).doc(sessionToken.UID).get();
            permissionIds = userDoc.data()?.permissionIds || [];
            expect(permissionIds).not.toContain(permissionId);

            // Verify permission ID was removed from board's permissions array
            const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
            const boardPermissions = boardDoc.data()?.permissions || [];
            expect(boardPermissions).not.toContain(permissionId);
        });

        it('should remove permission from user array when multiple permissions exist', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            const boardId = createdBoardIds[0];
            const permission1 = await AdduserPermission(sessionToken, Permision.VIEW, boardId);
            const permission2 = await AdduserPermission(sessionToken, Permision.EDIT, boardId);

            const db = admin.firestore();

            // Verify both permissions are in user's array
            let userDoc = await db.collection(DataBaseidentifiers.USER).doc(sessionToken.UID).get();
            let permissionIds = userDoc.data()?.permissionIds || [];
            expect(permissionIds).toContain(permission1.permissionId);
            expect(permissionIds).toContain(permission2.permissionId);

            // Remove first permission
            await RemovePermission(permission1.permissionId);

            // Verify first permission was removed but second remains
            userDoc = await db.collection(DataBaseidentifiers.USER).doc(sessionToken.UID).get();
            permissionIds = userDoc.data()?.permissionIds || [];
            expect(permissionIds).not.toContain(permission1.permissionId);
            expect(permissionIds).toContain(permission2.permissionId);

            // Verify board permissions array
            const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
            const boardPermissions = boardDoc.data()?.permissions || [];
            expect(boardPermissions).not.toContain(permission1.permissionId);
            expect(boardPermissions).toContain(permission2.permissionId);

            // Clean up second permission manually since it's not in createdPermissionIds
            await RemovePermission(permission2.permissionId);
        });

        it('should throw error when permission document does not exist', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            const nonexistentPermissionId = 'nonexistent-permission-id-12345';
            await expect(
                RemovePermission(nonexistentPermissionId)
            ).rejects.toThrow('Permission not found');
        });

        it('should throw error when permission document is missing userId', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            // Create a permission document without userId (malformed data)
            const db = admin.firestore();
            const malformedPermissionRef = db.collection(DataBaseidentifiers.USER_PERMISSION).doc();
            await malformedPermissionRef.set({
                boardId: createdBoardIds[0],
                permission: Permision.VIEW,
                timeStamp: '2025-01-01 00:00:00'
                // Missing userId intentionally
            });

            const malformedPermissionId = malformedPermissionRef.id;
            createdPermissionIds.push(malformedPermissionId);

            await expect(
                RemovePermission(malformedPermissionId)
            ).rejects.toThrow('Permission document missing userId');

            // Clean up the malformed document
            await malformedPermissionRef.delete();
            createdPermissionIds.pop();
        });
    });

    describe('Integration tests', () => {
        it('should handle full permission lifecycle: add -> change -> remove', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.log('Skipping test - Firebase not configured');
                return;
            }

            const boardId = createdBoardIds[0];
            const db = admin.firestore();

            // 1. Add permission
            const permission = await AdduserPermission(sessionToken, Permision.VIEW, boardId);
            createdPermissionIds.push(permission.permissionId);

            // Verify added
            let permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permission.permissionId).get();
            expect(permissionDoc.data()?.permission).toBe(Permision.VIEW);

            let userDoc = await db.collection(DataBaseidentifiers.USER).doc(sessionToken.UID).get();
            let permissionIds = userDoc.data()?.permissionIds || [];
            expect(permissionIds).toContain(permission.permissionId);

            // 2. Change permission
            await ChangePermission(permission.permissionId, Permision.EDIT);

            // Verify changed
            permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permission.permissionId).get();
            expect(permissionDoc.data()?.permission).toBe(Permision.EDIT);

            // 3. Remove permission
            await RemovePermission(permission.permissionId);

            // Verify removed
            permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permission.permissionId).get();
            expect(permissionDoc.exists).toBe(false);

            userDoc = await db.collection(DataBaseidentifiers.USER).doc(sessionToken.UID).get();
            permissionIds = userDoc.data()?.permissionIds || [];
            expect(permissionIds).not.toContain(permission.permissionId);

            // Verify permission ID was removed from board's permissions array
            const boardDoc = await db.collection(DataBaseidentifiers.BOARD).doc(boardId).get();
            const boardPermissions = boardDoc.data()?.permissions || [];
            expect(boardPermissions).not.toContain(permission.permissionId);
        });
    });

    describe('getPermision', () => {
        it('should get all permissions for a user', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            const db = admin.firestore();
            const boardId = createdBoardIds[0];

            // Create multiple permissions for the user
            const permission1 = await AdduserPermission(sessionToken, Permision.VIEW, boardId);
            const permission2 = await AdduserPermission(sessionToken, Permision.EDIT, boardId);
            createdPermissionIds.push(permission1.permissionId, permission2.permissionId);

            const permissions = await getPermision(sessionToken);

            expect(permissions).toBeDefined();
            expect(Array.isArray(permissions)).toBe(true);
            expect(permissions.length).toBeGreaterThanOrEqual(2);
            
            // Verify the permissions are in the results
            const permissionIds = permissions.map(p => p.permissionId);
            expect(permissionIds).toContain(permission1.permissionId);
            expect(permissionIds).toContain(permission2.permissionId);
        });

        it('should get a specific permission by permissionId', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            const db = admin.firestore();
            const boardId = createdBoardIds[0];

            const permission = await AdduserPermission(sessionToken, Permision.VIEW, boardId);
            createdPermissionIds.push(permission.permissionId);

            const permissions = await getPermision(sessionToken, permission.permissionId);

            expect(permissions).toBeDefined();
            expect(permissions.length).toBe(1);
            expect(permissions[0].permissionId).toBe(permission.permissionId);
            expect(permissions[0].boardId).toBe(boardId);
            expect(permissions[0].userId).toBe(sessionToken.UID);
            expect(permissions[0].permission).toBe(Permision.VIEW);
        });

        it('should return empty array when permissionId does not exist', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            const permissions = await getPermision(sessionToken, 'non-existent-permission-id');

            expect(permissions).toBeDefined();
            expect(permissions.length).toBe(0);
        });

        it('should return empty array when permissionId belongs to different user', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            // Create another user and permission
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

            const db = admin.firestore();
            const boardId = createdBoardIds[0];

            const otherPermission = await AdduserPermission(otherSessionToken, Permision.VIEW, boardId);
            createdPermissionIds.push(otherPermission.permissionId);
            createdUserIds.push(otherUserRecord.uid);

            // Try to get the other user's permission with our sessionToken
            const permissions = await getPermision(sessionToken, otherPermission.permissionId);

            expect(permissions).toBeDefined();
            expect(permissions.length).toBe(0); // Should return empty because it's not our permission

            // Clean up
            await admin.auth().deleteUser(otherUserRecord.uid);
        });

        it('should filter permissions by boardId', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            const db = admin.firestore();
            
            // Create a second board
            const board2Ref = db.collection(DataBaseidentifiers.BOARD).doc();
            await board2Ref.set({
                id: board2Ref.id,
                owner: sessionToken.UID,
                contentType: 'board',
                isRoot: false,
                content: 'Test Board 2',
                position: [0, 0],
                permissions: []
            });
            createdBoardIds.push(board2Ref.id);

            const board1Id = createdBoardIds[0];
            const board2Id = board2Ref.id;

            // Create permissions on both boards
            const permission1 = await AdduserPermission(sessionToken, Permision.VIEW, board1Id);
            const permission2 = await AdduserPermission(sessionToken, Permision.EDIT, board2Id);
            createdPermissionIds.push(permission1.permissionId, permission2.permissionId);

            // Get permissions filtered by board1Id
            const permissions = await getPermision(sessionToken, '', board1Id);

            expect(permissions).toBeDefined();
            expect(permissions.length).toBe(1);
            expect(permissions[0].permissionId).toBe(permission1.permissionId);
            expect(permissions[0].boardId).toBe(board1Id);
        });

        it('should filter permissions by permission type', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            const db = admin.firestore();
            const boardId = createdBoardIds[0];

            // Create permissions with different types
            const viewPermission = await AdduserPermission(sessionToken, Permision.VIEW, boardId);
            const editPermission = await AdduserPermission(sessionToken, Permision.EDIT, boardId);
            createdPermissionIds.push(viewPermission.permissionId, editPermission.permissionId);

            // Get only VIEW permissions
            const viewPermissions = await getPermision(sessionToken, '', '', Permision.VIEW);

            expect(viewPermissions).toBeDefined();
            expect(viewPermissions.length).toBeGreaterThanOrEqual(1);
            viewPermissions.forEach(perm => {
                expect(perm.permission).toBe(Permision.VIEW);
            });

            // Get only EDIT permissions
            const editPermissions = await getPermision(sessionToken, '', '', Permision.EDIT);

            expect(editPermissions).toBeDefined();
            expect(editPermissions.length).toBeGreaterThanOrEqual(1);
            editPermissions.forEach(perm => {
                expect(perm.permission).toBe(Permision.EDIT);
            });
        });

        it('should combine filters (boardId and permission type)', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            const db = admin.firestore();
            
            // Create a second board
            const board2Ref = db.collection(DataBaseidentifiers.BOARD).doc();
            await board2Ref.set({
                id: board2Ref.id,
                owner: sessionToken.UID,
                contentType: 'board',
                isRoot: false,
                content: 'Test Board 2',
                position: [0, 0],
                permissions: []
            });
            createdBoardIds.push(board2Ref.id);

            const board1Id = createdBoardIds[0];
            const board2Id = board2Ref.id;

            // Create VIEW permission on board1 and EDIT permission on board2
            const viewPermission = await AdduserPermission(sessionToken, Permision.VIEW, board1Id);
            const editPermission = await AdduserPermission(sessionToken, Permision.EDIT, board2Id);
            createdPermissionIds.push(viewPermission.permissionId, editPermission.permissionId);

            // Get VIEW permissions on board1
            const permissions = await getPermision(sessionToken, '', board1Id, Permision.VIEW);

            expect(permissions).toBeDefined();
            expect(permissions.length).toBe(1);
            expect(permissions[0].permissionId).toBe(viewPermission.permissionId);
            expect(permissions[0].boardId).toBe(board1Id);
            expect(permissions[0].permission).toBe(Permision.VIEW);
        });

        it('should return empty array when permissionId filters by different boardId', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            const db = admin.firestore();
            
            // Create a second board
            const board2Ref = db.collection(DataBaseidentifiers.BOARD).doc();
            await board2Ref.set({
                id: board2Ref.id,
                owner: sessionToken.UID,
                contentType: 'board',
                isRoot: false,
                content: 'Test Board 2',
                position: [0, 0],
                permissions: []
            });
            createdBoardIds.push(board2Ref.id);

            const board1Id = createdBoardIds[0];
            const board2Id = board2Ref.id;

            // Create permission on board1
            const permission = await AdduserPermission(sessionToken, Permision.VIEW, board1Id);
            createdPermissionIds.push(permission.permissionId);

            // Try to get permission by ID but filter by board2Id
            const permissions = await getPermision(sessionToken, permission.permissionId, board2Id);

            expect(permissions).toBeDefined();
            expect(permissions.length).toBe(0); // Should return empty because boardId doesn't match
        });

        it('should return empty array when permissionId filters by different permission type', async () => {
            if (!process.env.FIREBASE_ADMIN_KEY) {
                console.warn('Skipping test - Firebase not configured');
                return;
            }

            const db = admin.firestore();
            const boardId = createdBoardIds[0];

            // Create VIEW permission
            const permission = await AdduserPermission(sessionToken, Permision.VIEW, boardId);
            createdPermissionIds.push(permission.permissionId);

            // Try to get permission by ID but filter by EDIT type
            const permissions = await getPermision(sessionToken, permission.permissionId, '', Permision.EDIT);

            expect(permissions).toBeDefined();
            expect(permissions.length).toBe(0); // Should return empty because permission type doesn't match
        });
    });
});

