
import express from "express";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

// Initialize Firebase Admin SDK
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (serviceAccountKey) {
  const serviceAccount = JSON.parse(serviceAccountKey);
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
    });
  }
}

const db = admin.firestore();
const app = express();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(express.json());

// API Routes
app.get("/api/menu", async (req, res) => {
  const menuSnapshot = await db.collection("menu").get();
  const menuItems = menuSnapshot.docs.map((doc) => doc.data());
  res.json(menuItems);
});

app.post("/api/menu", async (req, res) => {
  const newItem = {
    id: Date.now().toString(),
    ...req.body,
  };
  await db.collection("menu").doc(newItem.id).set(newItem);
  res.json(newItem);
});

app.delete("/api/menu", async (req, res) => {
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }
  await db.collection("menu").doc(id).delete();
  res.json({ success: true });
});

app.delete("/api/menu/:id", async (req, res) => {
  await db.collection("menu").doc(req.params.id).delete();
  res.json({ success: true });
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

    const userRef = db.collection("users").doc(email as string);
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

export default app;
