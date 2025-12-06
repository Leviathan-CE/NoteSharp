import { db } from "./firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import { Code, DataConnectError } from "firebase/data-connect";
import { Permision, type Board, type UserPermission } from "../datContainers/dataTypes.js";
import type { SessionToken } from "../datContainers/sessionToken.js";
import { DataBaseidentifiers, formatTimestamp } from "./dbUserItems.js";

/**
 * Adds a user permission to the database by creating a permission document,
 * adding the permission ID to the user's permissionIds list, and adding
 * the permission ID to the board's permissions array.
 * 
 * Note: OWNER permission cannot be added using this function. Use ChangePermission()
 * to change a permission to OWNER, which will swap the board owner.
 * 
 * @param user - The session token containing user information
 * @param permisions - The permission type (VIEW or EDIT, not OWNER)
 * @param boardId - The ID of the board the permission is for
 * @returns The created userPermission object
 * @throws {DataConnectError} If db is not initialized
 * @throws {Error} If user document is not found
 * @throws {Error} If board document is not found
 * @throws {Error} If trying to add OWNER permission (use ChangePermission instead)
 */
export async function AdduserPermission(user: SessionToken, permisions: Permision, boardId: string): Promise<UserPermission> {

    if (db == undefined)
        throw new DataConnectError(Code.NOT_INITIALIZED, "db not initialized")

    if (permisions === Permision.OWNER)
        throw new Error("Owner can only be-changed using ChangePermssion()");

    const doc = db.collection(DataBaseidentifiers.USER_PERMISSION).doc()
    const timestampString = formatTimestamp(Date.now().toString());
    const permissionId = doc.id;

    // Create the permission document
    await doc.set({
        userId: user.UID,
        boardId: boardId,
        permission: permisions,
        timeStamp: timestampString
    })

    // Add the permission ID to the user's permissionIds array
    const userDoc = db.collection(DataBaseidentifiers.USER).doc(user.UID);
    const userDocSnapshot = await userDoc.get();

    if (!userDocSnapshot.exists) {
        throw new Error("User not found");
    }

    await userDoc.update({
        permissionIds: FieldValue.arrayUnion(permissionId)
    });

    //add permissionId to board permissions array
    const boardDoc = db.collection(DataBaseidentifiers.BOARD).doc(boardId);
    const boardSnapshot = await boardDoc.get();

    if (!boardSnapshot.exists) {
        throw new Error("board not found");
    }

    await boardDoc.update({
        permissions: FieldValue.arrayUnion(permissionId)
    })

    return {
        permissionId: permissionId,
        boardId: boardId,
        userId: user.UID,
        permission: permisions,
        timestamp: timestampString
    };
}

/**
 * Changes an existing user permission by updating the permission type and timestamp.
 * 
 * Special handling for OWNER permission: When changing a permission to OWNER,
 * this function will:
 * 1. Update the board's owner field to the user with the permission
 * 2. Create a permission (EDIT by default) for the previous owner
 * 3. Update the permission document with the new owner's userId
 * 
 * @param permissionId - The ID of the permission document to update
 * @param newPermission - The new permission type (VIEW, EDIT, or OWNER) to set
 * @throws {DataConnectError} If db is not initialized
 * @throws {Error} If permission document is not found
 * @throws {Error} If permission data is missing
 * @throws {Error} If board document is not found when changing to OWNER
 * @throws {Error} If board owner data is missing when changing to OWNER
 */
export async function ChangePermission(permissionId: string, newPermission: Permision): Promise<void> {
    if (db == undefined)
        throw new DataConnectError(Code.NOT_INITIALIZED, "db not initialized")


    const doc = db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permissionId)
    const timestampString = formatTimestamp(Date.now().toString());



    // Verify the permission document exists before attempting to update
    const permissionDoc = await doc.get();

    if (!permissionDoc.exists) {
        throw new Error("Permission not found");
    }
    //if permission type changes to owner spawn user ids the new
    //owners was the permissions and the old owner is now a permission
    if (newPermission === Permision.OWNER) {
        const permissionData = permissionDoc.data();
        if (!permissionData) {
            throw new Error("Permission data is missing");
        }
        const userPermission: UserPermission = {
            permissionId: permissionId,
            userId: permissionData.userId || '',
            boardId: permissionData.boardId || '',
            permission: permissionData.permission || Permision.VIEW,
            timestamp: permissionData.timeStamp || ''
        };

        const boardDoc = db.collection(DataBaseidentifiers.BOARD).doc(userPermission.boardId);
        const boardSnapshot = await boardDoc.get();

        const boardData = boardSnapshot.data();
        if (!boardData) {
            throw new Error("owner not found in board")
        }
        const oldOwnerId = boardData.owner;

        // Update board owner to the new owner
        await boardDoc.update({
            owner: userPermission.userId
        })

        // Update the permission document to represent the old owner's permission (EDIT by default)
        await doc.update({
            userId: oldOwnerId,
            permission: permissionData.permission || Permision.EDIT,
            timeStamp: timestampString
        })

    } else {

        await doc.update({
            permission: newPermission,
            timeStamp: timestampString
        })
    }
}

/**
 * Removes a user permission from the database by deleting the permission document,
 * removing the permission ID from the user's permissionIds list, and removing
 * the permission ID from the board's permissions array.
 * 
 * @param permissionId - The ID of the permission document to remove
 * @throws {DataConnectError} If db is not initialized
 * @throws {Error} If permission document is not found
 * @throws {Error} If permission document is missing userId
 * @throws {Error} If user document is not found
 * @throws {Error} If board document is not found
 */
export async function RemovePermission(permissionId: string): Promise<void> {
    if (db == undefined)
        throw new DataConnectError(Code.NOT_INITIALIZED, "db not initialized")

    const doc = db.collection(DataBaseidentifiers.USER_PERMISSION).doc(permissionId)

    // Verify the permission document exists and get the userId
    const permissionDoc = await doc.get();

    if (!permissionDoc.exists) {
        throw new Error("Permission not found");
    }

    const permissionData = permissionDoc.data();
    const userId = permissionData?.userId;
    const baordId = permissionData?.boardId;

    if (!userId) {
        throw new Error("Permission document missing userId");
    }

    // Remove the permission ID from the user's permissionIds array
    const userDoc = db.collection(DataBaseidentifiers.USER).doc(userId);
    const userDocSnapshot = await userDoc.get();

    if (!userDocSnapshot.exists) {
        throw new Error("User not found");
    }

    // Remove the permission ID from the user's permissionIds array
    await userDoc.update({
        permissionIds: FieldValue.arrayRemove(permissionId)
    });

    // remove the permission refernce form the baord permissions array
    const boardDoc = db.collection(DataBaseidentifiers.BOARD).doc(baordId);
    const boardSnapshot = await boardDoc.get()

    if (!boardSnapshot.exists) {
        throw new Error("board not found")
    }

    await boardDoc.update({
        permissions: FieldValue.arrayRemove(permissionId)
    })
    // Delete the permission document
    await doc.delete();
}

/**
 * Retrieves all permissions for a user, optionally filtered by permissionId, boardId, or permission type.
 * Includes both explicit permissions (from USER_PERMISSION collection) and implicit OWNER permissions
 * (from boards where the user is the owner).
 * 
 * @param sessionToken - The session token containing user authentication information
 * @param permissionId - Optional: Filter by specific permission ID
 * @param boardId - Optional: Filter by specific board ID
 * @param permission - Optional: Filter by permission type (VIEW, EDIT, OWNER)
 * @returns An array of UserPermission objects matching the criteria
 * @throws {DataConnectError} If db is not initialized
 */
export async function getPermision(sessionToken: SessionToken, permissionId: string = "", boardId: string = "", permission: string = ""
): Promise<UserPermission[]> {
    if (db == undefined)
        throw new DataConnectError(Code.NOT_INITIALIZED, "db not initialized");

    const results: UserPermission[] = [];

    // If a specific permissionId is provided, fetch that permission directly
    if (permissionId) {
        const permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION)
            .doc(permissionId)
            .get();

        if (permissionDoc.exists) {
            const permissionData = permissionDoc.data();
            if (permissionData && permissionData.userId === sessionToken.UID) {
                // Apply additional filters if provided
                if (boardId && permissionData.boardId !== boardId) {
                    return [];
                }
                if (permission && permissionData.permission !== permission) {
                    return [];
                }

                results.push({
                    permissionId: permissionDoc.id,
                    boardId: permissionData.boardId || '',
                    userId: permissionData.userId || '',
                    permission: permissionData.permission || Permision.VIEW,
                    timestamp: permissionData.timeStamp || ''
                });
            }
        }
        return results;
    }

    // Get all explicit permissions for the user
    let query = db.collection(DataBaseidentifiers.USER_PERMISSION)
        .where('userId', '==', sessionToken.UID);

    // Apply boardId filter if provided
    if (boardId) {
        query = query.where('boardId', '==', boardId);
    }

    // Apply permission type filter if provided
    if (permission) {
        query = query.where('permission', '==', permission);
    }

    const permissionsSnapshot = await query.get();

    // Convert explicit permissions to UserPermission objects
    for (const permissionDoc of permissionsSnapshot.docs) {
        const permissionData = permissionDoc.data();
        results.push({
            permissionId: permissionDoc.id,
            boardId: permissionData.boardId || '',
            userId: permissionData.userId || '',
            permission: permissionData.permission || Permision.VIEW,
            timestamp: permissionData.timeStamp || ''
        });
    }

    return results;
}