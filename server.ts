import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createSeedMenu, MenuItem } from "./data/menu";
import { OAuth2Client } from "google-auth-library";
import admin from "firebase-admin";
import multer from "multer";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

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

const isProduction = process.env.NODE_ENV === "production";
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://sdk.cashfree.com", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://storage.googleapis.com", "https://lh3.googleusercontent.com"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "https://sandbox.cashfree.com", "https://api.cashfree.com"],
      frameSrc: ["https://accounts.google.com"],
    },
  } : false,
  crossOriginEmbedderPolicy: false, // Required for Google Sign-In popup flow
  strictTransportSecurity: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
}));
app.use(express.json({ limit: "50kb" }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

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

const checkAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!db) return res.status(503).json({ error: "Admin SDK unavailable" });
  const uid = (req as any).user?.uid;
  if (!uid) return res.status(403).json({ error: "Forbidden" });
  try {
    const adminDoc = await db.collection("admins").doc(uid).get();
    if (!adminDoc.exists) return res.status(403).json({ error: "Admin access required" });
    return next();
  } catch {
    return res.status(403).json({ error: "Admin access required" });
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

app.post("/api/menu", authenticate, checkAdmin, async (req, res) => {
  if (!db) { res.status(503).json({ error: "Admin SDK unavailable" }); return; }
  const { name, category, mrp, offerPrice, desc, image } = req.body;
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
    res.status(400).json({ error: "Invalid name" }); return;
  }
  if (!["Signature Blends", "Single Fruit Series", "Subscriptions"].includes(category)) {
    res.status(400).json({ error: "Invalid category" }); return;
  }
  if (typeof mrp !== "number" || mrp <= 0 || mrp > 10000) {
    res.status(400).json({ error: "Invalid mrp" }); return;
  }
  if (typeof offerPrice !== "number" || offerPrice <= 0 || offerPrice > mrp) {
    res.status(400).json({ error: "Invalid offerPrice" }); return;
  }
  const newItem = {
    id: Date.now().toString(),
    name: name.trim(),
    category,
    mrp,
    offerPrice,
    ...(typeof desc === "string" ? { desc: desc.trim() } : {}),
    ...(typeof image === "string" ? { image } : {}),
  };
  await db.collection("menu").doc(newItem.id).set(newItem);
  res.json(newItem);
});

app.delete("/api/menu", authenticate, checkAdmin, async (req, res) => {
  if (!db) { res.status(503).json({ error: "Admin SDK unavailable" }); return; }
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }
  await db.collection("menu").doc(id).delete();
  res.json({ success: true });
});

app.delete("/api/menu/:id", authenticate, checkAdmin, async (req, res) => {
  if (!db) { res.status(503).json({ error: "Admin SDK unavailable" }); return; }
  await db.collection("menu").doc(req.params.id).delete();
  res.json({ success: true });
});

// ─── Image Upload Proxy ──────────────────────────────────────────────────────
// Uploads image via server → Firebase Storage (bypasses CORS entirely)
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed."));
    }
  },
});

app.post("/api/upload", authenticate, checkAdmin, uploadLimiter, upload.single("image"), async (req: any, res) => {
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
    const isClientError = err.message?.includes("Invalid file type");
    res.status(isClientError ? 400 : 500).json({ error: isClientError ? err.message : "Upload failed" });
  }
});

// ─── Payment Routes (Cashfree) ────────────────────────────────────────────────
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "";
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || "";
const CASHFREE_BASE_URL =
  process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

const paymentLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

app.post("/api/payment/create-order", authenticate, paymentLimiter, async (req, res) => {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    res.status(503).json({ error: "Payment gateway not configured" });
    return;
  }

  const { orderId, amount, customerName, customerEmail, customerPhone } = req.body;

  if (typeof orderId !== "string" || !orderId || orderId.length > 50) {
    res.status(400).json({ error: "Invalid orderId" }); return;
  }
  if (typeof amount !== "number" || amount <= 0 || amount > 100000) {
    res.status(400).json({ error: "Invalid amount" }); return;
  }
  if (typeof customerPhone !== "string" || !/^\d{10}$/.test(customerPhone)) {
    res.status(400).json({ error: "Invalid phone number" }); return;
  }

  try {
    const response = await fetch(`${CASHFREE_BASE_URL}/orders`, {
      method: "POST",
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: (req as any).user.uid,
          customer_name: typeof customerName === "string" ? customerName.trim().slice(0, 100) : "Customer",
          customer_email:
            typeof customerEmail === "string" && customerEmail.includes("@")
              ? customerEmail
              : "customer@simplysip.app",
          customer_phone: customerPhone,
        },
      }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      console.error("Cashfree create-order failed: HTTP", response.status);
      res.status(502).json({ error: "Failed to create payment order" });
      return;
    }

    res.json({ payment_session_id: data.payment_session_id, order_id: data.order_id });
  } catch (err) {
    console.error("Cashfree create-order error:", err);
    res.status(500).json({ error: "Payment service error" });
  }
});

app.post("/api/payment/verify", authenticate, paymentLimiter, async (req, res) => {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    res.status(503).json({ error: "Payment gateway not configured" }); return;
  }

  const { orderId } = req.body;
  if (typeof orderId !== "string" || !orderId) {
    res.status(400).json({ error: "Invalid orderId" }); return;
  }

  try {
    const response = await fetch(`${CASHFREE_BASE_URL}/orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
      },
    });

    const data = await response.json() as any;

    if (!response.ok) {
      console.error("Cashfree verify failed: HTTP", response.status);
      res.status(502).json({ error: "Failed to verify payment" });
      return;
    }

    const isPaid = data.order_status === "PAID";
    const paymentId = data.cf_order_id?.toString() || data.order_id;

    res.json({ success: isPaid, paymentId, order_status: data.order_status });
  } catch (err) {
    console.error("Cashfree verify error:", err);
    res.status(500).json({ error: "Payment verification error" });
  }
});

// Auth routes
app.post("/api/auth/google", authLimiter, async (req, res) => {
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
    app.get("*", (req, res) => {
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
