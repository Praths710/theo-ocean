import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { loadDoc, saveDoc } from "./persist";

// Username/password accounts with server-side sessions (httpOnly cookie).
// Persisted as the "users" document (Postgres or data/users.json). Passwords are hashed
// with scrypt + per-user salt.

type User = { id: string; username: string; salt: string; hash: string; createdAt: string };
type Session = { userId: string; expires: number };
type AuthDb = { users: Record<string, User>; sessions: Record<string, Session> };

const COOKIE = "theo_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

let db: AuthDb = { users: {}, sessions: {} };

/** Load saved accounts; call once before the server starts listening. */
export async function initAuth() {
  db = await loadDoc<AuthDb>("users", { users: {}, sessions: {} });
}

const save = () => saveDoc("users", db);

const hashPassword = (password: string, salt: string) => crypto.scryptSync(password, salt, 64).toString("hex");

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function register(username: string, password: string): User | string {
  if (!USERNAME_RE.test(username)) return "Username must be 3–20 letters, numbers or underscores.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  const key = username.toLowerCase();
  if (db.users[key]) return "That username is taken.";
  const salt = crypto.randomBytes(16).toString("hex");
  const user: User = { id: `u_${crypto.randomBytes(9).toString("base64url")}`, username, salt, hash: hashPassword(password, salt), createdAt: new Date().toISOString() };
  db.users[key] = user;
  save();
  return user;
}

export function verify(username: string, password: string): User | null {
  const user = db.users[username.toLowerCase()];
  if (!user) {
    hashPassword(password, "timing-equaliser"); // keep response time similar for unknown users
    return null;
  }
  const a = Buffer.from(hashPassword(password, user.salt), "hex");
  const b = Buffer.from(user.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? user : null;
}

function readCookie(req: Request, name: string) {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function startSession(req: Request, res: Response, user: User) {
  const token = crypto.randomBytes(32).toString("base64url");
  db.sessions[token] = { userId: user.id, expires: Date.now() + SESSION_MS };
  // Drop expired sessions while we're here.
  for (const [t, s] of Object.entries(db.sessions)) if (s.expires < Date.now()) delete db.sessions[t];
  save();
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secure ? "; Secure" : ""}`);
}

export function endSession(req: Request, res: Response) {
  const token = readCookie(req, COOKIE);
  if (token && db.sessions[token]) {
    delete db.sessions[token];
    save();
  }
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

export function currentUser(req: Request): User | null {
  const token = readCookie(req, COOKIE);
  const session = token ? db.sessions[token] : undefined;
  if (!session || session.expires < Date.now()) return null;
  return Object.values(db.users).find((u) => u.id === session.userId) ?? null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Please log in." });
  req.user = user;
  next();
}

// Tiny in-memory brute-force limiter for login/register.
const attempts = new Map<string, { count: number; reset: number }>();
export function allowAttempt(ip: string) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.reset < now) {
    attempts.set(ip, { count: 1, reset: now + 10 * 60_000 });
    return true;
  }
  a.count += 1;
  return a.count <= 20;
}
