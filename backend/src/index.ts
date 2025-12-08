import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import fireAuthRoutes from "./routes/fireAuthRoutes.js";
import userItemRoutes from "./routes/UserItemRoutes.js";
import permissionRoutes from "./routes/PermissionRoutes.js";
import boardRoutes from "./routes/boardRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import adminVerifyRoutes from "./routes/admin/adminVerifyRoutes.js";
import serverConfigRoutes from "./routes/admin/serverConfigRoutes.js";
import userAdminRoutes from "./routes/admin/userAdminRoutes.js";
import adminMetricsRoutes from "./routes/admin/adminMetricsRoutes.js";
import supportRoutes from "./routes/admin/supportRoutes.js";
import adminSettingsRoutes from "./routes/admin/adminSettingsRoutes.js";
import systemMetricsRoutes from "./routes/admin/systemMetricsRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";

const app = express();
app.use(cors());
// Increase payload limit to handle base64 encoded images (50mb)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/uploads", express.static(uploadsDir));

app.use("/api/auth", fireAuthRoutes);
app.use("/api/items", userItemRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/boards", groupRoutes);
app.use("/api", adminVerifyRoutes);
app.use("/api", serverConfigRoutes);
app.use("/api", userAdminRoutes);
app.use("/api", adminMetricsRoutes);
app.use("/api", supportRoutes);
app.use("/api", adminSettingsRoutes);
app.use("/api", systemMetricsRoutes);
app.use("/api/uploads", uploadRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
