import { Router } from "express";
import type { Request, Response } from "express";
import { verifyUserToken } from "../services/fireAuth.js";
import { db } from "../services/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import type { CreateGroupRequest, UpdateGroupRequest } from "../datContainers/groupTypes.js";
import { DataBaseidentifiers } from "../services/dbUserItems.js";

const router = Router();

/**
 * Verify board ownership
 */
async function verifyBoardOwnership(boardId: string, userId: string): Promise<boolean> {
  if (!db) {
    throw new Error("Database not initialized");
  }

  const boardRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId);
  const boardDoc = await boardRef.get();

  if (!boardDoc.exists) {
    return false;
  }

  const boardData = boardDoc.data();
  return boardData?.owner === userId;
}

/**
 * POST /api/boards/:boardId/groups
 * Create a new group
 */
router.post("/:boardId/groups", async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    
    if (!boardId) {
      return res.status(400).json({ error: "Board ID is required" });
    }
    
    const authHeader = req.headers.authorization;

    // Verify authentication
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return res.status(401).json({ error: "Missing ID token" });
    }

    let userSession;
    try {
      userSession = await verifyUserToken(idToken);
    } catch (error: any) {
      return res.status(401).json({ error: error.message || "Invalid token" });
    }

    // Verify board ownership
    const isOwner = await verifyBoardOwnership(boardId, userSession.UID);
    if (!isOwner) {
      return res.status(403).json({ error: "Access denied: not board owner" });
    }

    // Validate request body
    const { title } = req.body as CreateGroupRequest;
    if (!title || typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ error: "Title is required and must be a non-empty string" });
    }

    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }

    // Get current max order
    const groupsRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection("groups");
    let maxOrder = 0;
    try {
      const snapshot = await groupsRef.orderBy("order", "desc").limit(1).get();
      if (!snapshot.empty) {
        maxOrder = snapshot.docs[0]?.data()?.order || 0;
      }
    } catch (error: any) {
      // If orderBy fails (e.g., no index), just use 0 as default
      // This can happen with empty collections
      console.warn("Could not query max order, using 0:", error.message);
      maxOrder = 0;
    }

    // Create group
    const groupData = {
      title: title.trim(),
      boardId,
      ownerId: userSession.UID,
      expanded: true,
      order: maxOrder + 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const groupRef = await groupsRef.add(groupData);

    res.status(201).json({
      groupId: groupRef.id,
      message: "Group created successfully",
    });
  } catch (error: any) {
    console.error("Error creating group:", error);
    res.status(500).json({ error: "Failed to create group" });
  }
});

/**
 * GET /api/boards/:boardId/groups
 * Get all groups for a board
 */
router.get("/:boardId/groups", async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    
    if (!boardId) {
      return res.status(400).json({ error: "Board ID is required" });
    }
    
    const authHeader = req.headers.authorization;

    // Verify authentication
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return res.status(401).json({ error: "Missing ID token" });
    }

    let userSession;
    try {
      userSession = await verifyUserToken(idToken);
    } catch (error: any) {
      return res.status(401).json({ error: error.message || "Invalid token" });
    }

    // Verify board ownership
    const isOwner = await verifyBoardOwnership(boardId, userSession.UID);
    if (!isOwner) {
      return res.status(403).json({ error: "Access denied: not board owner" });
    }

    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }

    // Get all groups
    const groupsRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection("groups");
    const snapshot = await groupsRef.orderBy("order", "asc").get();

    const groups = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ groups });
  } catch (error: any) {
    console.error("Error fetching groups:", error);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

/**
 * PATCH /api/boards/:boardId/groups/:groupId
 * Update a group
 */
router.patch("/:boardId/groups/:groupId", async (req: Request, res: Response) => {
  try {
    const { boardId, groupId } = req.params;
    
    if (!boardId || !groupId) {
      return res.status(400).json({ error: "Board ID and Group ID are required" });
    }
    
    const authHeader = req.headers.authorization;

    // Verify authentication
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return res.status(401).json({ error: "Missing ID token" });
    }

    let userSession;
    try {
      userSession = await verifyUserToken(idToken);
    } catch (error: any) {
      return res.status(401).json({ error: error.message || "Invalid token" });
    }

    // Verify board ownership
    const isOwner = await verifyBoardOwnership(boardId, userSession.UID);
    if (!isOwner) {
      return res.status(403).json({ error: "Access denied: not board owner" });
    }

    // Validate request body
    const { title, expanded, order } = req.body as UpdateGroupRequest;

    if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
      return res.status(400).json({ error: "Title must be a non-empty string" });
    }

    if (expanded !== undefined && typeof expanded !== "boolean") {
      return res.status(400).json({ error: "Expanded must be a boolean" });
    }

    if (order !== undefined && (typeof order !== "number" || order < 0)) {
      return res.status(400).json({ error: "Order must be a non-negative number" });
    }

    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }

    // Check if group exists
    const groupRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection("groups").doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Build update object
    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (title !== undefined) {
      updateData.title = title.trim();
    }
    if (expanded !== undefined) {
      updateData.expanded = expanded;
    }
    if (order !== undefined) {
      updateData.order = order;
    }

    await groupRef.update(updateData);

    res.status(200).json({ message: "Group updated successfully" });
  } catch (error: any) {
    console.error("Error updating group:", error);
    res.status(500).json({ error: "Failed to update group" });
  }
});

/**
 * DELETE /api/boards/:boardId/groups/:groupId
 * Delete a group
 */
router.delete("/:boardId/groups/:groupId", async (req: Request, res: Response) => {
  try {
    const { boardId, groupId } = req.params;
    
    if (!boardId || !groupId) {
      return res.status(400).json({ error: "Board ID and Group ID are required" });
    }
    
    const authHeader = req.headers.authorization;

    // Verify authentication
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return res.status(401).json({ error: "Missing ID token" });
    }

    let userSession;
    try {
      userSession = await verifyUserToken(idToken);
    } catch (error: any) {
      return res.status(401).json({ error: error.message || "Invalid token" });
    }

    // Verify board ownership
    const isOwner = await verifyBoardOwnership(boardId, userSession.UID);
    if (!isOwner) {
      return res.status(403).json({ error: "Access denied: not board owner" });
    }

    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }

    // Check if group exists
    const groupRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection("groups").doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Unassign all notes from this group (set groupId to null)
    const notesRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection("notes");
    const notesSnapshot = await notesRef.where("groupId", "==", groupId).get();

    const batch = db.batch();
    notesSnapshot.docs.forEach((noteDoc: any) => {
      batch.update(noteDoc.ref, { groupId: null });
    });

    // Delete the group
    batch.delete(groupRef);

    await batch.commit();

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting group:", error);
    res.status(500).json({ error: "Failed to delete group" });
  }
});

/**
 * PATCH /api/boards/:boardId/notes/:noteId/group
 * Assign a note to a group (for drag and drop)
 */
router.patch("/:boardId/notes/:noteId/group", async (req: Request, res: Response) => {
  try {
    const { boardId, noteId } = req.params;
    const { groupId } = req.body;
    
    if (!boardId || !noteId) {
      return res.status(400).json({ error: "Board ID and Note ID are required" });
    }
    
    const authHeader = req.headers.authorization;

    // Verify authentication
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return res.status(401).json({ error: "Missing ID token" });
    }

    let userSession;
    try {
      userSession = await verifyUserToken(idToken);
    } catch (error: any) {
      return res.status(401).json({ error: error.message || "Invalid token" });
    }

    // Verify board ownership
    const isOwner = await verifyBoardOwnership(boardId, userSession.UID);
    if (!isOwner) {
      return res.status(403).json({ error: "Access denied: not board owner" });
    }

    // Validate groupId
    if (groupId !== null && typeof groupId !== "string") {
      return res.status(400).json({ error: "GroupId must be a string or null" });
    }

    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }

    // Check if note exists
    const noteRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection("notes").doc(noteId);
    const noteDoc = await noteRef.get();

    if (!noteDoc.exists) {
      return res.status(404).json({ error: "Note not found" });
    }

    // If groupId is provided, verify group exists
    if (groupId) {
      const groupRef = db.collection(DataBaseidentifiers.BOARD).doc(boardId).collection("groups").doc(groupId);
      const groupDoc = await groupRef.get();

      if (!groupDoc.exists) {
        return res.status(404).json({ error: "Group not found" });
      }
    }

    // Update note's groupId
    await noteRef.update({
      groupId: groupId || null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.status(200).json({ message: "Note group updated successfully" });
  } catch (error: any) {
    console.error("Error updating note group:", error);
    res.status(500).json({ error: "Failed to update note group" });
  }
});

export default router;
