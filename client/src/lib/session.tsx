import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { zones } from "@shared/ocean";
import { api, type PlayerSnapshot, type User } from "./api";

export type SessionValue = {
  status: "loading" | "anon" | "authed";
  user: User | null;
  snap: PlayerSnapshot | null;
  aiOnline: boolean;
  login: (u: string, p: string) => Promise<void>;
  register: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Apply a fresh server snapshot; toasts XP gains and newly unlocked zones. */
  apply: (s: PlayerSnapshot, gained?: number) => void;
};

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionValue["status"]>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [snap, setSnap] = useState<PlayerSnapshot | null>(null);
  const [aiOnline, setAiOnline] = useState(false);

  useEffect(() => {
    api.me()
      .then((r) => { setUser(r.user); setSnap({ state: r.state, maxZoneIndex: r.maxZoneIndex }); setStatus("authed"); })
      .catch(() => setStatus("anon"));
    api.health().then((h) => setAiOnline(h.ai)).catch(() => setAiOnline(false));
    const onLoggedOut = () => { setUser(null); setSnap(null); setStatus("anon"); };
    window.addEventListener("theo:logged-out", onLoggedOut);
    return () => window.removeEventListener("theo:logged-out", onLoggedOut);
  }, []);

  const apply = useCallback((s: PlayerSnapshot, gained?: number) => {
    setSnap((prev) => {
      if (prev && s.maxZoneIndex > prev.maxZoneIndex) {
        toast.success(`New depth unlocked: ${zones[s.maxZoneIndex].name}`, { description: "Swim to the bottom or hit “Dive deeper”." });
      }
      return s;
    });
    if (gained) toast(`+${gained} XP`, { duration: 1600 });
  }, []);

  const value = useMemo<SessionValue>(() => ({
    status, user, snap, aiOnline, apply,
    login: async (u, p) => { const r = await api.login(u, p); setUser(r.user); setSnap(r); setStatus("authed"); },
    register: async (u, p) => { const r = await api.register(u, p); setUser(r.user); setSnap(r); setStatus("authed"); },
    logout: async () => { await api.logout().catch(() => {}); setUser(null); setSnap(null); setStatus("anon"); },
  }), [status, user, snap, aiOnline, apply]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
