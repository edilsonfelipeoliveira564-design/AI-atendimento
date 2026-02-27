import express from "express";
import { createServer as createViteServer } from "vite";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory sessions for the "WhatsApp Provider" simulation
  // In a real production app, this would interface with a service like Baileys or WPPConnect
  const activeSessions = new Map();

  // API Routes
  app.post("/api/whatsapp/session", (req, res) => {
    const { userId, label } = req.body;
    const sessionId = uuidv4();
    
    // Simulate QR Payload generation (this would be the actual WA pairing string)
    // Format: 1@... (real WA QR payloads look like this)
    const qrPayload = `2@${uuidv4()}|${Date.now()}|${Math.random().toString(36).substring(7)}`;
    
    const session = {
      id: sessionId,
      userId,
      label: label || "Novo Dispositivo",
      status: "waiting_qr",
      qrPayload,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(), // 60 seconds expiry
    };

    activeSessions.set(sessionId, session);

    // In a real app, we would write this to Firestore here
    // For this demo, we return it and let the client handle the initial Firestore write 
    // OR we can use the Firebase Admin SDK if configured.
    // Since we want "Real Implementation", the backend SHOULD handle the logic.
    
    res.json(session);
  });

  // Simulate pairing success after 15 seconds if the session is still active
  app.post("/api/whatsapp/session/:id/simulate-pair", (req, res) => {
    const { id } = req.params;
    const session = activeSessions.get(id);
    if (session) {
      session.status = "paired";
      session.pairedAt = new Date().toISOString();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Session not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
