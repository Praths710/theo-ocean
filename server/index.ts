import "./env"; // must stay first: loads .env before other modules read process.env
import express, { type Request, type Response } from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { XP, findSpecies, maxZoneIndex, zones } from "../shared/ocean";
import { aiConfigured, generateQuiz, gradeQuiz, streamCompanion } from "./ai";
import { allowAttempt, currentUser, endSession, initAuth, register, requireAuth, startSession, verify } from "./auth";
import { persistLabel } from "./persist";
import { errorStatus, llmLabel } from "./llm";
import { getPlayer, initStore, resetPlayer, updatePlayer } from "./store";
import { synthesize, ttsConfigured, ttsLabel } from "./tts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// The bundled server (dist/index.js) always runs in production mode.
const isProd = process.env.NODE_ENV === "production" || !__filename.endsWith(".ts");

const OFFLINE = "AI companion is offline: add a free GEMINI_API_KEY to .env and restart.";

function aiErrorMessage(err: unknown) {
  const status = errorStatus(err);
  if (status === 400 || status === 401 || status === 403) return { status: 500, error: "AI key is invalid or the model name is wrong. Check .env." };
  if (status === 429) return { status: 429, error: "Free-tier limit reached for now. Give me a minute and try again!" };
  if (status) return { status: 502, error: "The ocean's a bit busy right now. Try again in a moment." };
  return { status: 500, error: "Lost signal for a second. Try again!" };
}

function apiError(res: Response, err: unknown) {
  console.error("[api]", err);
  if (res.headersSent) return;
  const { status, error } = aiErrorMessage(err);
  res.status(status).json({ error });
}

const snapshot = (id: string) => {
  const { state } = getPlayer(id);
  return { state, maxZoneIndex: maxZoneIndex(state.xp) };
};

function buildApi() {
  const api = express.Router();
  api.use(express.json({ limit: "64kb" }));

  api.get("/health", (_req, res) => res.json({ ok: true, ai: aiConfigured(), premiumVoice: ttsConfigured() }));

  // ----- Accounts -----
  api.post("/auth/register", (req, res) => {
    if (!allowAttempt(req.ip ?? "?")) return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
    const username = String(req.body?.username ?? "").trim();
    const result = register(username, String(req.body?.password ?? ""));
    if (typeof result === "string") return res.status(400).json({ error: result });
    updatePlayer(result.id, (r) => { r.state.diver.name = result.username; });
    startSession(req, res, result);
    res.json({ user: { id: result.id, username: result.username }, ...snapshot(result.id) });
  });

  api.post("/auth/login", (req, res) => {
    if (!allowAttempt(req.ip ?? "?")) return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
    const user = verify(String(req.body?.username ?? "").trim(), String(req.body?.password ?? ""));
    if (!user) return res.status(401).json({ error: "Wrong username or password." });
    startSession(req, res, user);
    res.json({ user: { id: user.id, username: user.username }, ...snapshot(user.id) });
  });

  api.post("/auth/logout", (req, res) => {
    endSession(req, res);
    res.json({ ok: true });
  });

  api.get("/auth/me", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: "Not logged in." });
    res.json({ user: { id: user.id, username: user.username }, ...snapshot(user.id) });
  });

  // ----- Everything below needs a logged-in diver -----
  api.use(requireAuth);
  const uid = (req: Request) => req.user!.id;

  api.get("/me", (req, res) => res.json(snapshot(uid(req))));

  api.patch("/me/diver", (req, res) => {
    const b = req.body ?? {};
    updatePlayer(uid(req), (r) => {
      const d = r.state.diver;
      if (typeof b.name === "string") d.name = b.name.trim().slice(0, 24) || d.name;
      if (typeof b.companionName === "string") d.companionName = b.companionName.trim().slice(0, 24) || d.companionName;
      if (Number.isFinite(b.suitHue)) d.suitHue = ((Math.round(Number(b.suitHue)) % 360) + 360) % 360;
      if (typeof b.voiceOn === "boolean") d.voiceOn = b.voiceOn;
    });
    res.json(snapshot(uid(req)));
  });

  api.post("/me/reset", (req, res) => {
    const name = getPlayer(uid(req)).state.diver.name;
    resetPlayer(uid(req));
    updatePlayer(uid(req), (r) => { r.state.diver.name = name; });
    res.json(snapshot(uid(req)));
  });

  api.post("/me/zone", (req, res) => {
    const idx = zones.findIndex((z) => z.id === req.body?.zoneId);
    const { state } = getPlayer(uid(req));
    if (idx < 0) return res.status(400).json({ error: "Unknown zone" });
    if (idx > maxZoneIndex(state.xp)) return res.status(403).json({ error: `Need ${zones[idx].xpRequired} XP to dive to ${zones[idx].name}.` });
    updatePlayer(uid(req), (r) => { r.state.zoneId = zones[idx].id; });
    res.json(snapshot(uid(req)));
  });

  api.post("/me/discover", (req, res) => {
    const found = findSpecies(req.body?.speciesId);
    if (!found) return res.status(400).json({ error: "Unknown species" });
    let gained = 0;
    updatePlayer(uid(req), (r) => {
      if (!r.state.discovered.includes(found.species.id)) {
        r.state.discovered.push(found.species.id);
        r.state.xp += XP.discover;
        gained = XP.discover;
      }
    });
    res.json({ ...snapshot(uid(req)), gained });
  });

  // ----- AI companion: chat + game-event narration, streamed as SSE -----
  api.post("/chat", async (req, res) => {
    const id = uid(req);
    const message = String(req.body?.message ?? "").trim().slice(0, 2000);
    if (!message) return res.status(400).json({ error: "Empty message" });
    if (!aiConfigured()) return res.status(503).json({ error: OFFLINE });

    const isEvent = Boolean(req.body?.isEvent);
    if (!isEvent) updatePlayer(id, (r) => { r.state.xp += XP.question; });

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      for await (const chunk of streamCompanion({ playerId: id, message, isEvent, focusSpeciesId: req.body?.focusSpeciesId })) {
        if (chunk.type === "mood") send("mood", { mood: chunk.mood });
        else send("delta", { text: chunk.text });
      }
      send("done", snapshot(id));
    } catch (err) {
      console.error("[chat]", err);
      send("error", { error: aiErrorMessage(err).error });
    }
    res.end();
  });

  // ----- Quizzes -----
  // Quizzes come from species cards the player has scanned (no AI needed, always works).
  api.post("/quiz", (req, res) => {
    const quiz = generateQuiz(uid(req), req.body?.speciesId);
    if (!quiz) return res.json({ quiz: null, message: "Scan a creature first (swim up to it and press E), then I'll quiz you on what you learned!" });
    res.json({ quiz });
  });

  api.post("/quiz/answer", (req, res) => {
    const result = gradeQuiz(uid(req), String(req.body?.quizId ?? ""), Number(req.body?.answerIndex));
    if (!result) return res.status(409).json({ error: "That quiz has expired. Ask for a new one." });
    const gained = result.correct ? XP.quizCorrect : XP.quizAttempt;
    updatePlayer(uid(req), (r) => { r.state.xp += gained; });
    res.json({ ...result, gained, ...snapshot(uid(req)) });
  });

  // ----- Voice -----
  api.post("/tts", async (req, res) => {
    const text = String(req.body?.text ?? "").trim();
    if (!text) return res.status(400).end();
    try {
      const audio = await synthesize(text, String(req.body?.mood ?? "curious"));
      if (!audio) return res.status(204).end(); // client falls back to browser speech
      res.setHeader("Content-Type", audio.mime);
      res.setHeader("Cache-Control", "no-store");
      res.end(audio.data);
    } catch (err) {
      console.error("[tts]", err);
      res.status(204).end();
    }
  });

  return api;
}

async function startServer() {
  await Promise.all([initAuth(), initStore()]);
  const app = express();
  const server = createServer(app);
  app.set("trust proxy", 1);

  app.use("/api", buildApi());

  // In production this server also serves the built client.
  const staticPath = isProd ? path.resolve(__dirname, "public") : path.resolve(__dirname, "..", "dist", "public");
  app.use(express.static(staticPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  // Dev: Vite runs on 3000 and proxies /api here.
  const port = process.env.PORT || (isProd ? 3000 : 3001);
  server.listen(port, () => {
    console.log(`TheO server on http://localhost:${port}/  (AI: ${llmLabel()}, voice: ${ttsLabel()}, storage: ${persistLabel()})`);
  });
}

startServer().catch(console.error);
