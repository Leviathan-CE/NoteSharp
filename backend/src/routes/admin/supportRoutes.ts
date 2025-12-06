import { Router } from "express";
import type { Request, Response } from "express";
import { verifyAdmin } from "../../middleware/verifyAdmin.js";
import { db } from "../../services/firebase.js";
import { DataBaseCollection } from "../../datContainers/DataBaseIdentifiers.js";

const SUPPORT_COLLECTIONS = [DataBaseCollection.SUPPORT_REQUESTS, "supportRequests", "support"];

const router = Router();

const normalizeTicket = (docId: string, data: Record<string, any>) => {
  const status = (data.status || "open").toLowerCase();
  return {
    id: data.id || docId,
    subject: data.subject || "Untitled Ticket",
    userName: data.userName || "Unknown User",
    userEmail: data.userEmail || "",
    category: data.category || "General",
    priority: (data.priority || "medium").toLowerCase(),
    status,
    createdAt: data.createdAt || null,
    lastUpdate: data.lastUpdate || null,
    description: data.description || "",
    messages: Array.isArray(data.messages) ? data.messages : [],
  };
};

router.get("/support/tickets", verifyAdmin, async (_req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not initialized" });
  }

  for (const collection of SUPPORT_COLLECTIONS) {
    try {
      const snapshot = await db.collection(collection).orderBy("createdAt", "desc").limit(50).get();
      if (!snapshot.empty) {
        const tickets = snapshot.docs.map((doc) => normalizeTicket(doc.id, doc.data() as Record<string, any>));
        const stats = {
          total: tickets.length,
          open: tickets.filter((ticket) => ticket.status === "open").length,
          inProgress: tickets.filter((ticket) => ticket.status === "in-progress").length,
          resolved: tickets.filter((ticket) => ticket.status === "resolved").length,
        };
        return res.status(200).json({ tickets, stats });
      }
    } catch (error) {
      console.warn(`Failed to read support tickets from ${collection}:`, error);
    }
  }

  return res.status(200).json({ tickets: [], stats: { total: 0, open: 0, inProgress: 0, resolved: 0 } });
});

export default router;
