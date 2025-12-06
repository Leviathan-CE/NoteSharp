import { Router } from "express";
import type { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAdmin } from "../../middleware/verifyAdmin.js";
import { db } from "../../services/firebase.js";
import { DataBaseCollection } from "../../datContainers/DataBaseIdentifiers.js";

const CONFIG_DOC_ID = "server";

const router = Router();

const toIsoString = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null) {
    // Firestore Timestamp instances expose toDate/toMillis
    // Use duck typing to avoid importing FieldValue types here
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate().toISOString();
    }
  }

  return null;
};

async function countCollectionDocuments(collectionName: string): Promise<number> {
  if (!db) {
    return 0;
  }

  try {
    const snapshot = await db.collection(collectionName).select().get();
    return snapshot.size;
  } catch (error) {
    console.warn(`Failed to count documents for collection ${collectionName}:`, error);
    return 0;
  }
}

async function getTotalUserCount(): Promise<number> {
  if (!db) {
    return 0;
  }

  return await countCollectionDocuments(DataBaseCollection.USER);
}

router.get("/server-config", verifyAdmin, async (_req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not initialized" });
  }

  try {
    const docRef = db.collection(DataBaseCollection.CONFIG).doc(CONFIG_DOC_ID);
    const snapshot = await docRef.get();
    const data = snapshot.data() ?? {};
    const activeUsers = await getTotalUserCount();

    if (activeUsers >= 0) {
      const existingMetrics = (data.metrics ?? {}) as Record<string, unknown>;
      data.metrics = {
        ...existingMetrics,
        activeUsers,
      };
    }

    return res.status(200).json({
      config: data,
      exists: snapshot.exists,
      updatedAt: toIsoString(data.updatedAt ?? data.lastUpdated),
    });
  } catch (error) {
    console.error("Failed to fetch server configuration:", error);
    return res.status(500).json({ error: "Failed to fetch server configuration" });
  }
});

router.put("/server-config", verifyAdmin, async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not initialized" });
  }

  try {
    const payload = req.body;

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "Invalid configuration payload" });
    }

    const { updatedAt: _ignored, lastUpdated: _ignoredLegacy, ...rest } = payload as Record<string, unknown>;
    const docRef = db.collection(DataBaseCollection.CONFIG).doc(CONFIG_DOC_ID);

    await docRef.set(
      {
        ...rest,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: req.user?.uid ?? "unknown",
      },
      { merge: true }
    );

    return res.status(200).json({ message: "Configuration saved" });
  } catch (error) {
    console.error("Failed to save server configuration:", error);
    return res.status(500).json({ error: "Failed to save server configuration" });
  }
});

router.post("/server-config/test", verifyAdmin, async (_req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not initialized" });
  }

  try {
    const docRef = db.collection(DataBaseCollection.CONFIG).doc(CONFIG_DOC_ID);
    await docRef.get();

    return res.status(200).json({
      message: "Connection successful",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Server configuration test failed:", error);
    return res.status(500).json({ error: "Failed to reach configuration storage" });
  }
});

export default router;
