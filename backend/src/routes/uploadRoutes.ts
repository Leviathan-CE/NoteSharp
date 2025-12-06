import { Router, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "..", "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1e9);
        const extension = path.extname(file.originalname) || ".bin";
        cb(null, `${timestamp}-${random}${extension}`);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB max
    },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            cb(new Error("Only image files are allowed"));
            return;
        }
        cb(null, true);
    },
});

router.post("/image", upload.single("image"), (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: "Image file is required" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get("host")}${fileUrl}`;
    return res.status(201).json({
        message: "Image uploaded successfully",
        url: fullUrl,
        path: fileUrl,
        originalName: req.file.originalname,
    });
});

router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof MulterError) {
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ error: err.message });
    }

    if (err.message === "Only image files are allowed") {
        return res.status(400).json({ error: err.message });
    }

    console.error("Upload error:", err);
    return res.status(500).json({ error: "Failed to upload image" });
});

export default router;
