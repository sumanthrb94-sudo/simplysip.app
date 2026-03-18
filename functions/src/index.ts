import { Request, Response } from "express";
import * as functions from "firebase-functions";
import express from "express";
import admin from "firebase-admin";
import { OAuth2Client } from "google-auth-library";
import cors from "cors";

admin.initializeApp();

const db = admin.firestore();
const app = express();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors({ origin: true }));
app.use(express.json());

// API Routes
app.get("/menu", async (req: Request, res: Response) => {
  const menuSnapshot = await db.collection("menu").get();
  const menuItems = menuSnapshot.docs.map((doc) => doc.data());
  res.json(menuItems);
});

app.post("/menu", async (req: Request, res: Response) => {
  const newItem = {
    id: Date.now().toString(),
    ...req.body,
  };
  await db.collection("menu").doc(newItem.id).set(newItem);
  res.json(newItem);
});

app.delete("/menu", async (req: Request, res: Response) => {
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }
  await db.collection("menu").doc(id).delete();
  res.json({ success: true });
});

app.delete("/menu/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  if (typeof id !== 'string') {
    return res.status(400).json({ error: "Invalid id" });
  }
  await db.collection("menu").doc(id).delete();
  return res.json({ success: true });
});

// Auth routes
app.post("/auth/google", async (req: Request, res: Response) => {
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
  } catch (error) {
    return res.status(400).json({ error: "Invalid credential" });
  }
});

export const api = functions.https.onRequest(app);
