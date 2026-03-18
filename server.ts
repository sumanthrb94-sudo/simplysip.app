import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createSeedMenu, MenuItem } from "./data/menu";
import { OAuth2Client } from "google-auth-library";
import db from "./data/database";

const app = express();
const DEFAULT_PORT = 3000;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(express.json());

// In-memory store for prototype
let menuItems: MenuItem[] = createSeedMenu();

// API Routes
app.get("/api/menu", (req, res) => {
  res.json(menuItems);
});

app.post("/api/menu", (req, res) => {
  const newItem = {
    id: Date.now().toString(),
    ...req.body
  };
  menuItems.push(newItem);
  res.json(newItem);
});

app.delete("/api/menu", (req, res) => {
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }
  menuItems = menuItems.filter(item => item.id !== id);
  res.json({ success: true });
});

app.delete("/api/menu/:id", (req, res) => {
  menuItems = menuItems.filter(item => item.id !== req.params.id);
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

    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user) {
      db.prepare(
        "INSERT INTO users (id, email, name, picture) VALUES (?, ?, ?, ?)"
      ).run(id, email, name, picture);
      user = { id, email, name, picture };
    }

    res.json(user);
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
