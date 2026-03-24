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
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : ["https://simplysip.vercel.app"];
app.use(cors({ origin: ALLOWED_ORIGINS, methods: ["GET", "POST", "DELETE"] }));
app.use(express.json({ limit: "50kb" }));
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.split("Bearer ")[1]
        : null;
    if (!token) {
        return res.status(401).json({ error: "Missing or invalid authorization token." });
    }
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = decoded;
        return next();
    }
    catch {
        return res.status(401).json({ error: "Unauthorized" });
    }
};
const ALLOWED_MENU_CATEGORIES = ["Signature Blends", "Single Fruit Series"];
// API Routes
app.get("/menu", async (req, res) => {
    const menuSnapshot = await db.collection("menu").get();
    const menuItems = menuSnapshot.docs.map((doc) => doc.data());
    res.json(menuItems);
});
app.post("/menu", authenticate, async (req, res) => {
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
        id: Date.now().toString(),
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
app.delete("/menu", authenticate, async (req, res) => {
    const id = typeof req.query.id === "string" ? req.query.id : "";
    if (!id) {
        res.status(400).json({ error: "Missing id" });
        return;
    }
    await db.collection("menu").doc(id).delete();
    res.json({ success: true });
});
app.delete("/menu/:id", authenticate, async (req, res) => {
    const id = req.params.id;
    if (typeof id !== "string") {
        return res.status(400).json({ error: "Invalid id" });
    }
    await db.collection("menu").doc(id).delete();
    return res.json({ success: true });
});
// Auth routes
app.post("/auth/google", async (req, res) => {
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
    }
    catch {
        return res.status(400).json({ error: "Invalid credential" });
    }
});
export const api = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map