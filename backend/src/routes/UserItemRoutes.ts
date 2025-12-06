import { Router } from "express";
import {
    createDefaultRootBoard,
    addedUser,
    addItem,
    removeItem,
    UpadteBaordItem,
    getItem,
    getAllItemsFromBoard
} from "../services/dbUserItems.js";
import { DataBaseCollection } from "../datContainers/DataBaseIdentifiers.js";
import admin from "firebase-admin";
import type { SessionToken } from "../datContainers/sessionToken.js";
import type { Item, Board } from "../datContainers/dataTypes.js";
import { ContentType } from "../datContainers/dataTypes.js";

const router = Router();

/**
 * POST /create-root-board
 * Creates a default root board for the authenticated user
 */
router.post("/create-root-board", async (req, res) => {
    try {
        const { sessionToken, cursorPosition } = req.body;

        if (!sessionToken || !sessionToken.UID) {
            return res.status(400).json({ error: "Session token with UID is required" });
        }

        const boardId = await createDefaultRootBoard(
            sessionToken as SessionToken,
            cursorPosition || [0, 0]
        );

        res.status(201).json({
            message: "Root board created successfully",
            boardId: boardId
        });
    } catch (error: any) {
        console.error("Error creating root board:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /add-user
 * Adds a user to the database (typically used during account creation)
 */
router.post("/add-user", async (req, res) => {
    try {
        const { user, isAdmin, createDefaultBoard } = req.body;

        if (!user || !user.uid) {
            return res.status(400).json({ error: "User object with uid is required" });
        }

        // Convert user object to SessionToken format (uid -> UID)
        const sessionToken: SessionToken = {
            email: user.email || '',
            displayName: user.displayName || 'no name user',
            UID: user.uid // Convert lowercase uid to uppercase UID
        };

        await addedUser(
            sessionToken,
            isAdmin || false,
            createDefaultBoard || false
        );

        res.status(201).json({
            message: "User added successfully"
        });
    } catch (error: any) {
        console.error("Error adding user:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /add-item
 * Adds an item to a parent board
 */
router.post("/add-item", async (req, res) => {
    try {
        const { item, sessionToken, parent, cursorPosition } = req.body;

        if (!item) {
            return res.status(400).json({ error: "Item is required" });
        }

        if (!sessionToken || !sessionToken.UID) {
            return res.status(400).json({ error: "Session token with UID is required" });
        }

        if (!parent || !parent.id) {
            return res.status(400).json({ error: "Parent board with id is required" });
        }

        const itemId = await addItem(
            item as Item,
            sessionToken as SessionToken,
            parent as Board,
            cursorPosition || [0, 0]
        );

        console.log('addItem returned itemId:', itemId, 'type:', typeof itemId);
        console.log('itemId value:', JSON.stringify(itemId));

        if (!itemId || typeof itemId !== 'string') {
            console.error('addItem returned invalid value!', { itemId, type: typeof itemId });
            return res.status(500).json({ error: "Failed to get item ID from database" });
        }

        // For BOARD items, we need to also return the boardId (board document ID)
        let boardId: string | undefined;
        if (item.contentType === ContentType.BOARD) {
            // Get the boardId from the item reference we just created
            try {
                const firestoreDb = admin.firestore();
                const itemRef = firestoreDb.collection(DataBaseCollection.BOARD).doc(parent.id).collection(DataBaseCollection.ITEMS).doc(itemId);
                const itemDoc = await itemRef.get();
                if (itemDoc.exists) {
                    const itemData = itemDoc.data();
                    boardId = itemData?.boardId;
                    console.log('Fetched boardId from item:', boardId);
                }
            } catch (e) {
                console.warn('Could not fetch boardId:', e);
            }
        }

        // Ensure itemId is definitely included
        const response: { message: string; itemId: string; boardId?: string } = {
            message: "Item added successfully",
            itemId: String(itemId), // Explicitly convert to string
            ...(boardId && { boardId: String(boardId) })
        };
        
        console.log('Sending response:', JSON.stringify(response));
        console.log('Response itemId check:', response.itemId, typeof response.itemId);
        
        // Double-check before sending
        if (!response.itemId) {
            console.error('Response itemId is missing!', response);
            return res.status(500).json({ error: "Failed to include item ID in response" });
        }
        
        res.status(201).json(response);
    } catch (error: any) {
        console.error("Error adding item:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /remove-item
 * Removes an item from a board
 */
router.delete("/remove-item", async (req, res) => {
    try {
        const { item, sessionToken, parent } = req.body;

        if (!item || !item.id) {
            return res.status(400).json({ error: "Item with id is required" });
        }

        if (!sessionToken || !sessionToken.UID) {
            return res.status(400).json({ error: "Session token with UID is required" });
        }

        await removeItem(
            item as Item,
            sessionToken as SessionToken,
            parent as Board | undefined
        );

        res.status(200).json({
            message: "Item removed successfully"
        });
    } catch (error: any) {
        console.error("Error removing item:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /update-item
 * Updates an item in a board's items subcollection
 */
router.put("/update-item", async (req, res) => {
    try {
        const { boardId, sessionToken, itemId, updates } = req.body;

        if (!boardId) {
            return res.status(400).json({ error: "Board ID is required" });
        }

        if (!sessionToken || !sessionToken.UID) {
            return res.status(400).json({ error: "Session token with UID is required" });
        }

        if (!itemId) {
            return res.status(400).json({ error: "Item ID is required" });
        }

        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({ error: "Updates object is required" });
        }

        await UpadteBaordItem(
            boardId,
            sessionToken as SessionToken,
            itemId,
            updates as Partial<Item>
        );

        res.status(200).json({
            message: "Item updated successfully"
        });
    } catch (error: any) {
        console.error("Error updating item:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /get-item
 * Retrieves an item from the database
 * Query parameters: itemId, contentType, itemParentId
 * Headers: Authorization (Bearer JSON-encoded sessionToken)
 */
router.get("/get-item", async (req, res) => {
    try {
        const { itemId, contentType, itemParentId } = req.query;

        if (!itemId || typeof itemId !== "string") {
            return res.status(400).json({ error: "Item ID is required as query parameter" });
        }

        if (!contentType || typeof contentType !== "string") {
            return res.status(400).json({ error: "Content type is required as query parameter" });
        }

        // Get sessionToken from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Authorization header with Bearer token is required" });
        }

        const tokenStr = authHeader.substring(7); // Remove "Bearer " prefix
        let sessionToken: SessionToken;
        try {
            sessionToken = JSON.parse(tokenStr) as SessionToken;
        } catch (e: any) {
            return res.status(400).json({ error: `Invalid session token format: ${e.message}` });
        }

        if (!sessionToken.UID) {
            return res.status(400).json({ error: "Session token with UID is required" });
        }

        // For non-BOARD items, itemParentId is required
        if (contentType !== ContentType.BOARD && !itemParentId) {
            return res.status(400).json({ error: "Parent board ID is required for non-BOARD items" });
        }

        const item = await getItem(
            sessionToken,
            itemId,
            contentType,
            (itemParentId as string) || itemId // Use itemId as parentId for boards
        );

        res.status(200).json({
            message: "Item retrieved successfully",
            item: item
        });
    } catch (error: any) {
        console.error("Error getting item:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /get-all-items
 * Retrieves all items from a board's ITEMS subcollection
 * Query parameters: boardId
 * Headers: Authorization (Bearer JSON-encoded sessionToken)
 */
router.get("/get-all-items", async (req, res) => {
    try {
        const { boardId } = req.query;

        if (!boardId || typeof boardId !== "string") {
            return res.status(400).json({ error: "Board ID is required as query parameter" });
        }

        // Get sessionToken from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Authorization header with Bearer token is required" });
        }

        const tokenStr = authHeader.substring(7); // Remove "Bearer " prefix
        let sessionToken: SessionToken;
        try {
            sessionToken = JSON.parse(tokenStr) as SessionToken;
        } catch (e: any) {
            return res.status(400).json({ error: `Invalid session token format: ${e.message}` });
        }

        if (!sessionToken.UID) {
            return res.status(400).json({ error: "Session token with UID is required" });
        }

        const items = await getAllItemsFromBoard(
            boardId,
            sessionToken
        );

        res.status(200).json({
            message: "Items retrieved successfully",
            items: items
        });
    } catch (error: any) {
        console.error("Error getting all items:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
});

export default router;

