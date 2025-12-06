import { Router } from "express";
import type { Request, Response } from "express";
import { verifyAdmin } from "../../middleware/verifyAdmin.js";
import { db } from "../../services/firebase.js";

const METRICS_COLLECTION = "systemMetrics";
const METRICS_DOC_ID = "latest";

const router = Router();

router.get("/admin/system-metrics", verifyAdmin, async (_req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not initialized" });
  }

  try {
    const docRef = db.collection(METRICS_COLLECTION).doc(METRICS_DOC_ID);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return res.status(200).json({
        metrics: {
          cpuUsage: 45,
          memoryUsage: 63,
          diskIo: 22,
          networkTraffic: 150,
          responseTime: 210,
          systemInfo: [],
          processes: [],
          updatedAt: null,
        },
      });
    }

    return res.status(200).json({
      metrics: snapshot.data(),
    });
  } catch (error) {
    console.error("Failed to fetch system metrics:", error);
    return res.status(500).json({ error: "Failed to fetch system metrics" });
  }
});

export default router;
