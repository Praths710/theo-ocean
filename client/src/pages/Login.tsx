import { useState } from "react";
import { ArrowRight, Waves } from "lucide-react";
import { useLocation } from "wouter";
import OceanBackdrop from "@/components/ocean/OceanBackdrop";
import Seascape from "@/components/ocean/Seascape";
import Diver from "@/components/art/Diver";
import Creature from "@/components/art/Creature";
import { speciesArt } from "@/components/art/speciesArt";
import { useSession } from "@/lib/session";

export default function Login() {
  const { login, register } = useSession();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await (mode === "login" ? login(username, password) : register(username, password));
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <OceanBackdrop zoneIndex={0} />
      <Seascape zoneIndex={0} />
      <div className="login-life" aria-hidden="true">
        <div className="drift drift-whale"><Creature art={speciesArt.whale.art} /></div>
        <div className="drift drift-turtle"><Creature art={speciesArt.hawksbill.art} /></div>
        <div className="drift drift-diver"><Diver kick={1.1} /></div>
      </div>

      <section className="login-card" aria-labelledby="login-title">
        <div className="brand login-brand"><span className="brand-mark"><Waves size={17} strokeWidth={2.5} /></span><span>TheO</span></div>
        <h1 id="login-title">Dive in.<br /><em>Meet the deep.</em></h1>
        <p className="login-sub">Explore five ocean zones, discover real species and learn with Coral, your AI dive buddy who talks back.</p>

        <div className="login-tabs" role="tablist">
          <button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setError(""); }}>Log in</button>
          <button role="tab" aria-selected={mode === "register"} className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button>
        </div>

        <form onSubmit={submit} className="login-form">
          <label className="field"><span>USERNAME</span><input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. reef_explorer" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" /></label>
          <label className="field"><span>PASSWORD</span><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "At least 6 characters" : "••••••"} required minLength={6} /></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-cta login-submit" disabled={busy}>{busy ? "One sec…" : mode === "login" ? "Log in" : "Create my diver"}<ArrowRight size={17} /></button>
        </form>
        <p className="login-foot">{mode === "login" ? "New here? " : "Already diving? "}<button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create a free account" : "Log in"}</button></p>
      </section>
    </main>
  );
}
