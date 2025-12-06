import { Router } from "express";
import type { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAdmin } from "../middleware/verifyAdmin.js";
import { db } from "../services/firebase.js";

const SETTINGS_COLLECTION = "config";
const SETTINGS_DOC_ID = "adminSettings";

const router = Router();

router.get("/admin/settings", verifyAdmin, async (_req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not initialized" });
  }

  try {
    const docRef = db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);
    const snapshot = await docRef.get();
    return res.status(200).json({
      settings: snapshot.data() ?? {},
      exists: snapshot.exists,
    });
  } catch (error) {
    console.error("Failed to fetch admin settings:", error);
    return res.status(500).json({ error: "Failed to fetch admin settings" });
  }
});

router.put("/admin/settings", verifyAdmin, async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not initialized" });
  }

  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "Invalid settings payload" });
    }

    const docRef = db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);
    await docRef.set(
      {
        ...payload,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: req.user?.uid ?? "unknown",
      },
      { merge: true }
    );

    return res.status(200).json({ message: "Settings saved" });
  } catch (error) {
    console.error("Failed to save admin settings:", error);
    return res.status(500).json({ error: "Failed to save admin settings" });
  }
});

export default router;
