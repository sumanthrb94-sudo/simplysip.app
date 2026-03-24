import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createSeedMenu, MenuItem } from "./data/menu";
import { OAuth2Client } from "google-auth-library";
import admin from "firebase-admin";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

// Initialize Firebase Admin SDK
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
let db: admin.firestore.Firestore | null = null;

if (serviceAccountKey) {
  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      });
    }
    db = admin.firestore();
    console.log("✅ Firebase Admin SDK initialized.");
  } catch (e) {
    console.warn("⚠️  Firebase Admin init failed:", e);
  }
} else {
  console.warn("⚠️  FIREBASE_SERVICE_ACCOUNT_KEY not set — Admin SDK routes will be unavailable. Use npm run dev:client for frontend-only dev.");
}


const app = express();
const DEFAULT_PORT = 3000;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(express.json());

const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;

  if (!token) {
    return res.status(401).json({ error: "Missing or invalid authorization token." });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

// API Routes
app.get("/api/menu", async (req, res) => {
  if (!db) { res.status(503).json({ error: "Admin SDK unavailable" }); return; }
  const menuSnapshot = await db.collection("menu").get();
  const menuItems = menuSnapshot.docs.map((doc) => doc.data());
  if (menuItems.length === 0) {
    const seedMenu = createSeedMenu();
    for (const item of seedMenu) {
      await db.collection("menu").doc(item.id).set(item);
    }
    return res.json(seedMenu);
  }
  res.json(menuItems);
});

app.post("/api/menu", authenticate, async (req, res) => {
  if (!db) { res.status(503).json({ error: "Admin SDK unavailable" }); return; }
  const newItem = {
    id: Date.now().toString(),
    ...req.body,
  };
  await db.collection("menu").doc(newItem.id).set(newItem);
  res.json(newItem);
});

app.delete("/api/menu", authenticate, async (req, res) => {
  if (!db) { res.status(503).json({ error: "Admin SDK unavailable" }); return; }
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }
  await db.collection("menu").doc(id).delete();
  res.json({ success: true });
});

app.delete("/api/menu/:id", authenticate, async (req, res) => {
  if (!db) { res.status(503).json({ error: "Admin SDK unavailable" }); return; }
  await db.collection("menu").doc(req.params.id).delete();
  res.json({ success: true });
});

// ─── Image Upload Proxy ──────────────────────────────────────────────────────
// Uploads image via server → Firebase Storage (bypasses CORS entirely)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

app.post("/api/upload", authenticate, upload.single("image"), async (req: any, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      res.status(503).json({ error: "Storage not configured" });
      return;
    }

    const serviceAccount = JSON.parse(serviceAccountKey);
    const bucket = admin.storage().bucket();
    console.log("🔍 Using Admin SDK default bucket:", bucket.name);

    if (!bucket) {
      res.status(503).json({ error: "Firebase Storage bucket not found" });
      return;
    }

    const fileName = `products/${Date.now()}_${req.file.originalname.replace(/\s+/g, "_")}`;
    const file = bucket.file(fileName);

    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        cacheControl: "public, max-age=31536000",
      },
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(fileName)}`;
    console.log("✅ Upload complete:", publicUrl);
    res.json({ url: publicUrl });
  } catch (err: any) {
    console.error("❌ Upload failed:", err.message);
    res.status(500).json({ error: err.message || "Upload failed" });
  }
});

// Auth routes
app.post("/api/auth/google", async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      res.status(400).json({ error: "Invalid credential" });
      return;
    }
    const { sub: id, email, name, picture } = payload;

    const userRef = db.collection("users").doc(id as string);
    const user = await userRef.get();

    if (!user.exists) {
      const newUser = { id, email, name, picture };
      await userRef.set(newUser);
      return res.json(newUser);
    }

    res.json(user.data());
  } catch (error) {
    res.status(400).json({ error: "Invalid credential" });
  }
});


async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const listenWithRetry = (port: number, retries = 10) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && retries > 0) {
        const nextPort = port + 1;
        console.log(`Port ${port} in use, trying ${nextPort}...`);
        server.close(() => listenWithRetry(nextPort, retries - 1));
        return;
      }
      console.error(err);
      process.exit(1);
    });
  };

  listenWithRetry(PORT);
}

startServer();
