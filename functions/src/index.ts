import { Request, Response } from "express";
import * as functions from "firebase-functions";
import express from "express";
import admin from "firebase-admin"; // v2
import { OAuth2Client } from "google-auth-library";
import cors from "cors";
import rateLimit from "express-rate-limit";

admin.initializeApp();

const db = admin.firestore();
const app = express();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://simplysip.app")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: ALLOWED_ORIGINS, methods: ["GET", "POST", "DELETE"] }));
app.use(express.json({ limit: "50kb" }));

// Firebase Hosting rewrites pass the full path (e.g. /api/payment/create-order)
// Strip the /api prefix so Express routes match correctly
app.use((req: Request, _res: Response, next: any) => {
  if (req.url.startsWith("/api/")) {
    req.url = req.url.slice(4); // remove "/api"
  }
  next();
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

const authenticate = async (req: Request, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  const token =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.split("Bearer ")[1]
      : null;

  if (!token) {
    return res.status(401).json({ error: "Missing or invalid authorization token." });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

const checkAdmin = async (req: Request, res: Response, next: any) => {
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

const ALLOWED_MENU_CATEGORIES = ["Signature Blends", "Single Fruit Series"];

// API Routes
app.get("/menu", async (req: Request, res: Response) => {
  const menuSnapshot = await db.collection("menu").get();
  const menuItems = menuSnapshot.docs.map((doc) => doc.data());
  res.json(menuItems);
});

app.post("/menu", authenticate, checkAdmin, async (req: Request, res: Response) => {
  const { name, category, mrp, offerPrice, desc, image } = req.body;
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
    return res.status(400).json({ error: "Invalid name" });
  }
  if (!ALLOWED_MENU_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }
  if (typeof mrp !== "number" || mrp <= 0 || mrp > 10000) {
    return res.status(400).json({ error: "Invalid mrp" });
  }
  if (typeof offerPrice !== "number" || offerPrice <= 0 || offerPrice > mrp) {
    return res.status(400).json({ error: "Invalid offerPrice" });
  }
  const newItem = {
    id: crypto.randomUUID(),
    name: name.trim(),
    category,
    mrp,
    offerPrice,
    ...(typeof desc === "string" ? { desc: desc.trim() } : {}),
    ...(typeof image === "string" ? { image } : {}),
  };
  await db.collection("menu").doc(newItem.id).set(newItem);
  return res.json(newItem);
});

app.delete("/menu", authenticate, checkAdmin, async (req: Request, res: Response) => {
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }
  await db.collection("menu").doc(id).delete();
  res.json({ success: true });
});

app.delete("/menu/:id", authenticate, checkAdmin, async (req: Request, res: Response) => {
  const id = req.params.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid id" });
  }
  await db.collection("menu").doc(id).delete();
  return res.json({ success: true });
});

// ─── Payment Routes (Cashfree) ────────────────────────────────────────────────
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "";
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || "";
const CASHFREE_BASE_URL =
  process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

app.post("/payment/create-order", authenticate, async (req: Request, res: Response) => {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    return res.status(503).json({ error: "Payment gateway not configured" });
  }

  const { orderId, amount, customerName, customerEmail, customerPhone } = req.body;

  if (typeof orderId !== "string" || !orderId || orderId.length > 50) {
    return res.status(400).json({ error: "Invalid orderId" });
  }
  if (typeof amount !== "number" || amount <= 0 || amount > 100000) {
    return res.status(400).json({ error: "Invalid amount" });
  }
  if (typeof customerPhone !== "string" || !/^\d{10}$/.test(customerPhone)) {
    return res.status(400).json({ error: "Invalid phone number" });
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
      return res.status(502).json({ error: "Failed to create payment order" });
    }

    return res.json({ payment_session_id: data.payment_session_id, order_id: data.order_id });
  } catch (err) {
    console.error("Cashfree create-order error:", err);
    return res.status(500).json({ error: "Payment service error" });
  }
});

app.post("/payment/verify", authenticate, async (req: Request, res: Response) => {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    return res.status(503).json({ error: "Payment gateway not configured" });
  }

  const { orderId } = req.body;
  if (typeof orderId !== "string" || !orderId) {
    return res.status(400).json({ error: "Invalid orderId" });
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
      return res.status(502).json({ error: "Failed to verify payment" });
    }

    const isPaid = data.order_status === "PAID";
    const paymentId = data.cf_order_id?.toString() || data.order_id;

    return res.json({ success: isPaid, paymentId, order_status: data.order_status });
  } catch (err) {
    console.error("Cashfree verify error:", err);
    return res.status(500).json({ error: "Payment verification error" });
  }
});

// Auth routes
app.post("/auth/google", authLimiter, async (req: Request, res: Response) => {
  const { credential } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ error: "Invalid credential" });
    }
    const { sub: id, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: "Email not found in credential" });
    }
    const userRef = db.collection("users").doc(email);
    const user = await userRef.get();

    if (!user.exists) {
      const newUser = { id, email, name, picture };
      await userRef.set(newUser);
      return res.json(newUser);
    }

    return res.json(user.data());
  } catch {
    return res.status(400).json({ error: "Invalid credential" });
  }
});

export const api = functions.https.onRequest(app);
