import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createSeedMenu, MenuItem } from "./data/menu";
import { OAuth2Client } from "google-auth-library";
import admin from "firebase-admin";
import dotenv from "dotenv";

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
  const newItem = {
    id: Date.now().toString(),
    ...req.body,
  };
  await db.collection("menu").doc(newItem.id).set(newItem);
  res.json(newItem);
});

app.delete("/api/menu", authenticate, async (req, res) => {
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }
  await db.collection("menu").doc(id).delete();
  res.json({ success: true });
});

app.delete("/api/menu/:id", authenticate, async (req, res) => {
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
