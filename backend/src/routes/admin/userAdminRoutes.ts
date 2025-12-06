import { Router } from "express";
import type { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import admin from "firebase-admin";
import { verifyAdmin } from "../../middleware/verifyAdmin.js";
import { db } from "../../services/firebase.js";
import { DataBaseCollection } from "../../datContainers/DataBaseIdentifiers.js";

type RawUserData = Record<string, any>;

const router = Router();

const toIsoString = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate().toISOString();
    }
  }
  return undefined;
};

const normalizeUserRecord = (docId: string, data: RawUserData) => {
  const uid = String(data.UID || data.uid || docId);
  const email = String(data.email || data.Email || "");
  const displayName = String(data.displayName || data.DisplayName || email.split("@")[0] || "User");
  const role =
    typeof data.role === "string"
      ? data.role
      : typeof data.Role === "string"
        ? data.Role
        : data.isAdmin
          ? "admin"
          : "user";
  const isAdmin = typeof data.isAdmin === "boolean" ? data.isAdmin : Boolean(data.IsAdmin);

  return {
    uid,
    email,
    displayName,
    role,
    isAdmin,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt || data.lastUpdated),
  };
};

router.get("/users", verifyAdmin, async (_req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not initialized" });
  }

  try {
    const userMap = new Map<string, ReturnType<typeof normalizeUserRecord>>();

    const snapshot = await db.collection(DataBaseCollection.USER).get();
    snapshot.forEach((doc) => {
      const normalized = normalizeUserRecord(doc.id, doc.data() as RawUserData);
      userMap.set(normalized.uid, normalized);
    });

    return res.status(200).json({
      users: Array.from(userMap.values()),
      count: userMap.size,
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.patch("/users/:userId/role", verifyAdmin, async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not initialized" });
  }

  const userId = req.params.userId;
  const { role } = req.body ?? {};

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  if (!role || typeof role !== "string") {
    return res.status(400).json({ error: "Role is required" });
  }

  const normalizedRole = role.toLowerCase();
  const isAdmin = normalizedRole === "admin";

  try {
    const updates = {
      role: normalizedRole,
      Role: normalizedRole,
      isAdmin,
      IsAdmin: isAdmin,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Only write to the capitalized 'Users' collection
    await db!.collection(DataBaseCollection.USER).doc(userId).set(updates, { merge: true });

    if (admin.apps.length > 0) {
      try {
        await admin.auth().setCustomUserClaims(userId, { isAdmin });
      } catch (err) {
        console.warn("Failed to update custom claims for user:", userId, err);
      }
    }

    return res.status(200).json({
      message: "User role updated",
      userId,
      role: normalizedRole,
      isAdmin,
    });
  } catch (error) {
    console.error("Failed to update user role:", error);
    return res.status(500).json({ error: "Failed to update user role" });
  }
});

router.delete("/users/:userId", verifyAdmin, async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not initialized" });
  }

  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // Delete from Users collection
    await db!.collection(DataBaseCollection.USER).doc(userId).delete().catch(() => {});

    if (admin.apps.length > 0) {
      try {
        await admin.auth().deleteUser(userId);
      } catch (error: any) {
        if (error?.code !== "auth/user-not-found") {
          console.warn("Failed to delete auth user:", error);
        }
      }
    }

    return res.status(200).json({ message: "User deleted", userId });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
