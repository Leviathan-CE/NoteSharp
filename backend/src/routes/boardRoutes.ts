import { Router } from "express";
import type { Request, Response } from "express";
import { verifyUserToken } from "../services/fireAuth.js";
import { db } from "../services/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

const router = Router();

interface CreateBoardRequest {
  title: string;
}

/**
 * POST /boards - Create a new board
 * Requires Firebase authentication via Authorization: Bearer <idToken>
 * Body: { title: string }
 * Returns: { boardId: string }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    // Extract and verify the authorization token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    
    if (!idToken) {
      return res.status(401).json({ error: "Missing ID token" });
    }

    // Verify the user token
    let userSession;
    try {
      userSession = await verifyUserToken(idToken);
    } catch (error: any) {
      return res.status(401).json({ error: error.message || "Invalid token" });
    }

    // Validate request body
    const { title } = req.body as CreateBoardRequest;
    
    if (!title || typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ error: "Title is required and must be a non-empty string" });
    }

    // Check if Firestore is initialized
    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }

    // Create the board document in Firestore
    const boardData = {
      title: title.trim(),
      ownerId: userSession.UID,
      createdAt: FieldValue.serverTimestamp()
    };

    const boardRef = await db.collection("boards").add(boardData);

    // Return the created board ID
    res.status(201).json({ 
      boardId: boardRef.id,
      message: "Board created successfully"
    });

  } catch (error: any) {
    console.error("Error creating board:", error);
    res.status(500).json({ error: "Failed to create board" });
  }
});

export default router;
