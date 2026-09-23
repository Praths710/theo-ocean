import type { PlayerState, Quiz } from "@shared/ocean";

export type PlayerSnapshot = { state: PlayerState; maxZoneIndex: number };
export type User = { id: string; username: string };
export type AuthResult = PlayerSnapshot & { user: User };

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !res.url.includes("/api/auth/")) window.dispatchEvent(new Event("theo:logged-out"));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

const send = (url: string, body: unknown = {}, method = "POST") =>
  fetch(url, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  health: () => fetch("/api/health").then((r) => json<{ ok: boolean; ai: boolean; premiumVoice: boolean }>(r)),
  me: () => fetch("/api/auth/me", { credentials: "same-origin" }).then((r) => json<AuthResult>(r)),
  login: (username: string, password: string) => send("/api/auth/login", { username, password }).then((r) => json<AuthResult>(r)),
  register: (username: string, password: string) => send("/api/auth/register", { username, password }).then((r) => json<AuthResult>(r)),
  logout: () => send("/api/auth/logout").then((r) => json<{ ok: boolean }>(r)),

  updateDiver: (diver: Partial<PlayerState["diver"]>) => send("/api/me/diver", diver, "PATCH").then((r) => json<PlayerSnapshot>(r)),
  setZone: (zoneId: string) => send("/api/me/zone", { zoneId }).then((r) => json<PlayerSnapshot>(r)),
  discover: (speciesId: string) => send("/api/me/discover", { speciesId }).then((r) => json<PlayerSnapshot & { gained: number }>(r)),
  reset: () => send("/api/me/reset").then((r) => json<PlayerSnapshot>(r)),
  quiz: (speciesId?: string) => send("/api/quiz", { speciesId }).then((r) => json<{ quiz: Quiz | null; message?: string }>(r)),
  answer: (quizId: string, answerIndex: number) =>
    send("/api/quiz/answer", { quizId, answerIndex }).then((r) =>
      json<PlayerSnapshot & { correct: boolean; correctIndex: number; explanation: string; gained: number; mood: string }>(r),
    ),
};

/** POST /api/chat and read the SSE stream. */
export async function streamChat(
  body: { message: string; isEvent?: boolean; focusSpeciesId?: string },
  handlers: { onDelta: (text: string) => void; onMood?: (mood: string) => void },
): Promise<PlayerSnapshot | null> {
  const res = await send("/api/chat", body);
  if (!res.ok || !res.body) await json(res); // throws with the server's message

  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let done: PlayerSnapshot | null = null;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buffer += value;
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const event = /^event: (.*)$/m.exec(frame)?.[1];
      const data = /^data: (.*)$/m.exec(frame)?.[1];
      if (!event || !data) continue;
      const payload = JSON.parse(data);
      if (event === "delta") handlers.onDelta(payload.text);
      else if (event === "mood") handlers.onMood?.(payload.mood);
      else if (event === "done") done = payload;
      else if (event === "error") throw new Error(payload.error);
    }
  }
  return done;
}
