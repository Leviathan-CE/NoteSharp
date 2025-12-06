import type { User } from "firebase/auth"
import { db } from "./firebase.js"
import type { DocumentReference } from "firebase-admin/firestore"
import { FieldValue } from "firebase-admin/firestore"
import { Code, DataConnectError } from "firebase/data-connect"
import type { Item, Board, UserPermission } from "../datContainers/dataTypes.js"
import { ContentType, Permision } from '../datContainers/dataTypes.js';
import type { SessionToken } from '../datContainers/sessionToken.js';
import { RemovePermission } from "./dbPermissions.js"



export enum DataBaseidentifiers {
    USER = "Users",
    BOARD = "Boards",
    ITEMS = "Items",
    USER_PERMISSION = "UserPermission"
}

export function formatTimestamp(timestampString: string) {
    const date = new Date(Number(timestampString));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}



/**
 * Creates a default root board for a user
 * @param sessionToken - The session token containing user authentication information
 * @throws DataConnectError, if db is not initialized
 */
export async function createDefaultRootBoard(sessionToken: SessionToken, cursorPosition: number[] = [0, 0]): Promise<string> {
    if (db == undefined)
        throw new DataConnectError(Code.NOT_INITIALIZED, "db not initialized")

    // First, check if the user document has a rootBoardId field
    const userRef = db.collection(DataBaseidentifiers.USER).doc(sessionToken.UID);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.rootBoardId) {
            // Verify the root board exists and belongs to this user
            const rootBoardRef = db.collection(DataBaseidentifiers.BOARD).doc(userData.rootBoardId);
            const rootBoardDoc = await rootBoardRef.get();
            
            if (rootBoardDoc.exists) {
                const rootBoardData = rootBoardDoc.data();
                if (rootBoardData?.owner === sessionToken.UID) {
                    console.log('Using root board from user document:', userData.rootBoardId);
                    return userData.rootBoardId;
                }
            }
        }
    }

    // If no rootBoardId in user document, check if user already has a root board
    const boardsRef = db.collection(DataBaseidentifiers.BOARD);
    const existingBoards = await boardsRef
        .where('owner', '==', sessionToken.UID)
        .where('isRoot', '==', true)
        .get();

    if (existingBoards.size > 0) {
        // User already has a root board, return the existing one
        const existingBoard = existingBoards.docs[0];
        if (existingBoard) {
            // Update user document with this root board ID for future reference
            await userRef.set({ rootBoardId: existingBoard.id }, { merge: true });
            return existingBoard.id;
        }
    }

    // Create a new root board
    const document: DocumentReference = db.collection(DataBaseidentifiers.BOARD).doc();

    await document.set({
        id: document.id,
        owner: sessionToken.UID,
        contentType: ContentType.BOARD,
        isRoot: true,
        content: 'Default Board',
        position: cursorPosition
    });

    // Update user document with the new root board ID
    await userRef.set({ rootBoardId: document.id }, { merge: true });

    return document.id;
}

/**
 * 
 * @param user : the user to add to the database
 * @param isAdmin : whether they are being added as a admin or not
 * @param createDefaultBoard : whether to create a default root board for the user (default: false)
 * @throws DataConnectError, if db is not initialized
 */
export async function addedUser(user: SessionToken, isAdmin: boolean, createDefaultBoard: boolean = false): Promise<void> {

    if (db == undefined)
        throw new DataConnectError(Code.NOT_INITIALIZED, "db not initialized")

    let document: DocumentReference = db?.collection(DataBaseidentifiers.USER).doc(user.UID)


    // Optionally create a default root board for the user
    if (createDefaultBoard) {
        let rootboard = await createDefaultRootBoard(user);


        await document.set({
            rootBoardId: rootboard,
            isAdmin: isAdmin,
            uid: user.UID,
            displayName: user.displayName,
            email: user.email,
            permissionIds: []
        })
    }
    else {
        await document.set({
            isAdmin: isAdmin,
            uid: user.UID,
            displayName: user.displayName,
            email: user.email,
            permissionIds: []
        })
    }

}

/**
 * Adds an item to the database inside a parent board. Creates a new document based on the item's content type.
 * 
 * For BOARD items: Creates a new nested board document in the boards collection (isRoot: false).
 * The board is always created as a nested board with the specified cursor position.
 * 
 * For non-BOARD items (TEXT, HTML, IMG, etc.): Creates a new item document in the items subcollection
 * under the parent board. Requires a valid parent board ID.
 * 
 * Note: Root boards should be created using createDefaultRootBoard() instead of this function.
 * 
 * @param item - The item to add to the database
 * @param SessionToken - The session token containing user authentication information
 * @param parent - The parent board where the item will be added (required)
 * @param cursorPosition - The cursor position where the item should be placed (default: [0,0])
 * @throws {DataConnectError} If db is not initialized
 * @throws {Error} If parent board ID is required but not provided (for non-BOARD items)
 */
export async function addItem(item: Item, SessionToken: SessionToken, parent: Board, cursorPosition: number[] = [0, 0]): Promise<string> {

    if (db == undefined)
        throw new DataConnectError(Code.NOT_INITIALIZED, "db not initialized")

    if (!parent.id) {
        throw new Error("Parent board ID is required for all items");
    }
    
    if (item.contentType === ContentType.BOARD) {
        // Child boards need both:
        // 1. A board document in Boards collection (so they can have their own items)
        // 2. An item reference in parent's items subcollection (so they show up when getting all items)
        
        // Create the board document first
        const boardDocRef = db.collection(DataBaseidentifiers.BOARD).doc();
        const boardDocId = boardDocRef.id;
        
        await boardDocRef.set({
            id: boardDocId,
            owner: SessionToken.UID,
            contentType: ContentType.BOARD,
            isRoot: false,
            content: item.content || 'Untitled Board',
            position: cursorPosition,
            size: item.size || [200, 200]
        });
        
        console.log('Created child board document:', boardDocId, 'for parent:', parent.id);
        
        // Then create the item reference in parent's items subcollection
        const itemRef = db.collection(DataBaseidentifiers.BOARD)
            .doc(parent.id)
            .collection(DataBaseidentifiers.ITEMS)
            .doc();
        
        await itemRef.set({
            id: itemRef.id,
            boardId: boardDocId, // Reference to the actual board document
            position: cursorPosition,
            size: item.size || [200, 200],
            content: item.content || 'Untitled Board',
            contentType: ContentType.BOARD
        });
        
        console.log('Created child board item reference:', itemRef.id, 'with boardId:', boardDocId);
        
        return itemRef.id; // Return the item ID (not the board ID)
    } else {
        // Non-BOARD items are stored only in the items subcollection
        console.log('Adding non-BOARD item to parent board:', parent.id);
        
        let document: DocumentReference = db.collection(DataBaseidentifiers.BOARD)
            .doc(parent.id)
            .collection(DataBaseidentifiers.ITEMS)
            .doc();

        await document.set({
            id: document.id,
            position: cursorPosition,
            size: item.size || [0, 0],
            content: item.content,
            contentType: item.contentType
        });
        
        console.log('Created item:', document.id, 'in board:', parent.id);
        
        return document.id;
    }
}

/**
 * Removes an item from the database. Deletes the document based on the item's content type.
 * 
 * For BOARD items: 
 * - Removes all permissions associated with the board before deletion
 * - Removes the board document from the boards collection
 * - Deletes all items in the board's items subcollection
 * - Prevents removal of root boards (isRoot: true)
 * - Verifies ownership before allowing removal
 * 
 * For non-BOARD items (TEXT, HTML, IMG, etc.): 
 * - Removes the item document from the items subcollection under the parent board
 * 
 * @param item - The item to remove from the database (must have an id field)
 * @param sessionToken - The session token containing user authentication information for ownership verification
 * @param parent - The parent board where the item is located (required for non-BOARD items)
 * @throws {DataConnectError} If db is not initialized
 * @throws {Error} If board is not found
 * @throws {Error} If board data is missing
 * @throws {Error} If trying to remove a root board
 * @throws {Error} If unauthorized (not the board owner)
 * @throws {Error} If item ID is not provided
 * @throws {Error} If parent board ID is required but not provided (for non-BOARD items)
 * @throws {Error} If item not found (for non-BOARD items)
 */
export async function removeItem(item: Item, sessionToken: SessionToken, parent?: Board): Promise<void> {
    if (db == undefined)
        throw new DataConnectError(Code.NOT_INITIALIZED, "db not initialized")

    if (!item.id) {
        throw new Error("Item ID is required for removal");
    }

    if (!parent?.id) {
        throw new Error("Parent board ID is required for all items");
    }

    // All items (including child boards) are stored in the items subcollection
    // Only root boards are in the Boards collection
    const itemRef = db.collection(DataBaseidentifiers.BOARD)
        .doc(parent.id)
        .collection(DataBaseidentifiers.ITEMS)
        .doc(item.id);

    const itemDoc = await itemRef.get();

    if (!itemDoc.exists) {
        throw new Error("Item not found");
    }

    const itemData = itemDoc.data();
    if (!itemData) {
        throw new Error("Item data is missing");
    }

    // If it's a child board, we need to delete its board document and items first
    if (item.contentType === ContentType.BOARD) {
        // Child boards have a boardId reference in the item data
        const boardId = itemData.boardId || item.id;
        
        // Check if there's a board document for this child board
        const childBoardRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId);
        const childBoardDoc = await childBoardRef.get();
        
        if (childBoardDoc.exists) {
            // This child board has its own board document (for storing its items)
            // Delete all items in the child board's subcollection first
            const childBoardItemsRef = childBoardRef.collection(DataBaseidentifiers.ITEMS);
            const childItemsSnapshot = await childBoardItemsRef.get();
            
            const deletePromises = childItemsSnapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);
            
            // Then delete the child board document itself
            await childBoardRef.delete();
        }
        
        // Finally, delete the child board item reference from the parent's items subcollection
        await itemRef.delete();
    } else {
        // Remove non-BOARD items from the items subcollection
        await itemRef.delete();
    }
}

/**
 * Updates an item in a board's items subcollection.
 * Only allows updates if the user is the board owner or has EDIT permission.
 * 
 * @param boardId - The ID of the board containing the item
 * @param sessionToken - The session token containing user authentication information
 * @param itemId - The ID of the item to update
 * @param updates - Partial Item object containing the fields to update
 * @throws {DataConnectError} If db is not initialized
 * @throws {Error} If board is not found
 * @throws {Error} If board data is missing
 * @throws {Error} If user is not authorized (not owner and no EDIT/OWNER permission)
 * @throws {Error} If item is not found
 */
export async function UpadteBaordItem(boardId: string, sessionToken: SessionToken, itemId: string, updates: Partial<Item>
): Promise<void> {
    if (db == undefined)
        throw new DataConnectError(Code.NOT_INITIALIZED, "db not initialized");

    // Get the board document
    const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId);
    const boardDoc = await boardRef.get();

    if (!boardDoc.exists) {
        throw new Error("Board not found");
    }

    const boardData = boardDoc.data();
    if (!boardData) {
        throw new Error("Board data is missing");
    }

    // Check if user is the owner
    const isOwner = boardData.owner === sessionToken.UID;

    // If not owner, check for EDIT or OWNER permission
    let hasEditPermission = false;
    if (!isOwner) {
        const permissions: string[] = boardData.permissions || [];

        // Check each permission to see if user has EDIT or OWNER
        for (const permissionId of permissions) {
            const permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION)
                .doc(permissionId)
                .get();

            if (permissionDoc.exists) {
                const permissionData = permissionDoc.data();
                if (permissionData?.userId === sessionToken.UID) {
                    const permission = permissionData.permission;
                    if (permission === Permision.EDIT || permission === Permision.OWNER) {
                        hasEditPermission = true;
                        break;
                    }
                }
            }
        }
    }

    // Verify authorization
    if (!isOwner && !hasEditPermission) {
        throw new Error("Unauthorized: You need to be the owner or have EDIT permission to change items");
    }

    // Get the item document
    const itemRef = boardRef.collection(DataBaseidentifiers.ITEMS).doc(itemId);
    const itemDoc = await itemRef.get();

    if (!itemDoc.exists) {
        throw new Error("Item not found");
    }

    // Prepare update object (only include fields that are provided and not undefined)
    // This automatically handles any new fields added to the Item interface
    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
            updateData[key] = value;
        }
    }

    // Only update if there are fields to update
    if (Object.keys(updateData).length === 0) {
        throw new Error("No valid fields provided for update");
    }

    // Update the item
    await itemRef.update(updateData);
}


/**
 * Retrieves an item from the database with all its field values.
 * Returns an extended Item object or Board object.
 * If the item is a board, also returns all sub-items the board holds.
 * 
 * For BOARD items: Fetches from the BOARD collection and includes all items from the ITEMS subcollection.
 * For non-BOARD items: Searches through boards the user has access to and finds the item in their ITEMS subcollections.
 * 
 * Authorization: User must be the board owner or have VIEW, EDIT, or OWNER permission.
 * 
 * @param sessionToken - The session token containing user authentication information
 * @param itemId - The ID of the item to retrieve
 * @param contentType - The content type of the item (ContentType enum value)
 * @param itemParentId - The ID of the parent board containing the item (required for non-BOARD items)
 * @returns A Partial<Item> or Partial<Board> object with all field values. For boards, includes the items array.
 * @throws {DataConnectError} If db is not initialized
 * @throws {Error} If item is not found
 * @throws {Error} If user is not authorized to access the item
 * @throws {Error} If board data is missing
 * @throws {Error} If parent board ID is required but not provided (for non-BOARD items)
 */
export async function getItem(sessionToken: SessionToken, itemId: string, contentType: string, itemParentId: string): Promise<Partial<Item> | Partial<Board>> {
    if (db == undefined)
        throw new DataConnectError(Code.NOT_INITIALIZED, "db not initialized");

    // Handle BOARD items
    if (contentType === ContentType.BOARD) {
        const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(itemId);
        const boardDoc = await boardRef.get();

        if (!boardDoc.exists) {
            throw new Error("Board not found");
        }

        const boardData = boardDoc.data();
        if (!boardData) {
            throw new Error("Board data is missing");
        }

        // Check authorization: user must be owner or have permission
        const isOwner = boardData.owner === sessionToken.UID;
        let hasPermission = false;

        if (!isOwner) {
            const permissions: string[] = boardData.permissions || [];

            // Check each permission to see if user has VIEW, EDIT, or OWNER
            for (const permissionId of permissions) {
                const permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION)
                    .doc(permissionId)
                    .get();

                if (permissionDoc.exists) {
                    const permissionData = permissionDoc.data();
                    if (permissionData?.userId === sessionToken.UID) {
                        const permission = permissionData.permission;
                        if (permission === Permision.VIEW || permission === Permision.EDIT || permission === Permision.OWNER) {
                            hasPermission = true;
                            break;
                        }
                    }
                }
            }
        }

        if (!isOwner && !hasPermission) {
            throw new Error("Unauthorized: You need to be the owner or have permission to view this board");
        }

        // Fetch all items from the board's ITEMS subcollection
        const itemsRef = boardRef.collection(DataBaseidentifiers.ITEMS);
        const itemsSnapshot = await itemsRef.get();
        const items: Item[] = [];

        for (const itemDoc of itemsSnapshot.docs) {
            const itemData = itemDoc.data();
            items.push({
                id: itemDoc.id,
                content: itemData.content || '',
                contentType: itemData.contentType || ContentType.TEXT,
                position: itemData.position || [0, 0],
                size: itemData.size || [0, 0]
            });
        }

        // Return board with items
        const board: Board = {
            id: boardDoc.id,
            content: boardData.content || '',
            contentType: boardData.contentType || ContentType.BOARD,
            position: boardData.position || [0, 0],
            size: boardData.size || [0, 0],
            owner: boardData.owner || '',
            parentId: boardData.parentId,
            isRoot: boardData.isRoot ?? false,
            permissions: boardData.permissions || [],
            items: items
        };

        return board;
    } else {
        // Handle non-BOARD items (TEXT, HTML, IMG, etc.)
        // Use itemParentId to directly access the parent board
        if (!itemParentId) {
            throw new Error("Parent board ID is required for non-BOARD items");
        }

        // Get the parent board to check authorization
        const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(itemParentId);
        const boardDoc = await boardRef.get();

        if (!boardDoc.exists) {
            throw new Error("Parent board not found");
        }

        const boardData = boardDoc.data();
        if (!boardData) {
            throw new Error("Board data is missing");
        }

        // Check authorization: user must be owner or have permission
        const isOwner = boardData.owner === sessionToken.UID;
        let hasPermission = false;

        if (!isOwner) {
            const permissions: string[] = boardData.permissions || [];

            // Check each permission to see if user has VIEW, EDIT, or OWNER
            for (const permissionId of permissions) {
                const permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION)
                    .doc(permissionId)
                    .get();

                if (permissionDoc.exists) {
                    const permissionData = permissionDoc.data();
                    if (permissionData?.userId === sessionToken.UID) {
                        const permission = permissionData.permission;
                        if (permission === Permision.VIEW || permission === Permision.EDIT || permission === Permision.OWNER) {
                            hasPermission = true;
                            break;
                        }
                    }
                }
            }
        }

        if (!isOwner && !hasPermission) {
            throw new Error("Unauthorized: You need to be the owner or have permission to view items in this board");
        }

        // Fetch the item directly from the parent board's ITEMS subcollection
        const itemDoc = await boardRef.collection(DataBaseidentifiers.ITEMS).doc(itemId).get();

        if (!itemDoc.exists) {
            throw new Error("Item not found");
        }

        const itemData = itemDoc.data();
        if (!itemData) {
            throw new Error("Item data is missing");
        }

        // Verify contentType matches
        if (itemData.contentType !== contentType) {
            throw new Error(`Item content type mismatch. Expected ${contentType}, found ${itemData.contentType}`);
        }

        return {
            id: itemDoc.id,
            content: itemData.content || '',
            contentType: itemData.contentType || ContentType.TEXT,
            position: itemData.position || [0, 0],
            size: itemData.size || [0, 0]
        };
    }
}

/**
 * Retrieves all immediate child items from a board's ITEMS subcollection.
 * This includes both regular items (TEXT, HTML, IMG, etc.) and child boards (BOARD).
 * Only returns immediate children - does not recursively fetch nested children.
 * 
 * Authorization: User must be the board owner or have VIEW, EDIT, or OWNER permission.
 * 
 * @param boardId - The ID of the board to get items from
 * @param sessionToken - The session token containing user authentication information
 * @returns An array of Item objects from the board's ITEMS subcollection (immediate children only)
 * @throws {DataConnectError} If db is not initialized
 * @throws {Error} If board is not found
 * @throws {Error} If board data is missing
 * @throws {Error} If user is not authorized to access the board
 */
export async function getAllItemsFromBoard(boardId: string, sessionToken: SessionToken): Promise<Item[]> {
    if (db == undefined)
        throw new DataConnectError(Code.NOT_INITIALIZED, "db not initialized");

    // Get the board document
    const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId);
    const boardDoc = await boardRef.get();

    if (!boardDoc.exists) {
        throw new Error("Board not found");
    }

    const boardData = boardDoc.data();
    if (!boardData) {
        throw new Error("Board data is missing");
    }

    // Check authorization: user must be owner or have permission
    // Ensure owner field exists and compare as strings to avoid type issues
    const boardOwner = boardData.owner;
    if (boardOwner === undefined || boardOwner === null) {
        throw new Error("Board owner is missing or invalid");
    }
    // Convert both to strings for reliable comparison
    const isOwner = String(boardOwner).trim() === String(sessionToken.UID).trim();
    let hasPermission = false;

    if (!isOwner) {
        const permissions: string[] = boardData.permissions || [];
        
        // Check each permission to see if user has VIEW, EDIT, or OWNER
        for (const permissionId of permissions) {
            const permissionDoc = await db.collection(DataBaseidentifiers.USER_PERMISSION)
                .doc(permissionId)
                .get();
            
            if (permissionDoc.exists) {
                const permissionData = permissionDoc.data();
                if (permissionData?.userId === sessionToken.UID) {
                    const permission = permissionData.permission;
                    if (permission === Permision.VIEW || permission === Permision.EDIT || permission === Permision.OWNER) {
                        hasPermission = true;
                        break;
                    }
                }
            }
        }
    }

    if (!isOwner && !hasPermission) {
        throw new Error("Unauthorized: You need to be the owner or have permission to view items in this board");
    }

    // Fetch all items from the board's ITEMS subcollection
    const itemsRef = boardRef.collection(DataBaseidentifiers.ITEMS);
    const itemsSnapshot = await itemsRef.get();
    const items: Item[] = [];

    for (const itemDoc of itemsSnapshot.docs) {
        const itemData = itemDoc.data();
        const item: Item = {
            id: itemDoc.id,
            content: itemData.content || '',
            contentType: itemData.contentType || ContentType.TEXT,
            position: itemData.position || [0, 0],
            size: itemData.size || [0, 0]
        };
        
        // For child boards, include the boardId reference if it exists
        if (itemData.contentType === ContentType.BOARD && itemData.boardId) {
            (item as any).boardId = itemData.boardId;
        }
        
        items.push(item);
    }

    return items;
}