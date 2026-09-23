# TheO — Gamified Ocean Learning

Dive through five ocean zones (levels), inspect species, and learn with **an AI dive companion that talks and adapts to you**. It narrates each zone as you descend, answers typed or spoken questions, sets adaptive quizzes, and keeps a learner profile so later dives are personalised.

## Quick start

```bash
pnpm install
cp .env.example .env      # then paste a free GEMINI_API_KEY into .env
pnpm dev                  # web on http://localhost:3000, API on :3001 (proxied)
```

Production (one port, the API also serves the built client):

```bash
pnpm build
pnpm start                # http://localhost:3000
```

Without an AI key the game still works (zones, XP, discovery, customisation). The companion just shows as offline.

## Screens

1. **`/login`**: create an account or log in (username + password, hashed with scrypt, session cookie). Stored in `data/users.json`.
2. **`/` Home base** (game main menu): player badge and level, counters (XP, species, quiz stars, badges), an expedition map of the 5 zones, missions, badges, a collectible species-card collection with rarity frames, and the diver locker.
3. **`/dive` Game**: full-screen ocean.
   - **Water:** a WebGL shader draws light rays, caustics and surface shimmer, plus a headlamp beam in the dark zones.
   - **Particles:** marine snow, glowing plankton that flares near you, and breath bubbles.
   - **Level:** each zone is a side-scrolling level 4 screens wide. The camera follows the diver, and a radar in the HUD shows where the creatures are.
   - **Life:** an animated diver you steer, animated creatures with their own behaviours, and scenery for each zone.
   - **Sound:** a live-generated soundscape with whale song, clicks, sonar and bubbles.

**Controls:** WASD / arrow keys or hold the mouse to swim · **E** or click a creature to swim over and scan it · swim to the bottom edge and press **Space** to dive deeper · **Q** quiz · **M** talk to your buddy.

## How the game loop works

| Action | XP |
| --- | --- |
| Inspect a new species | +25 |
| Ask the companion a question | +5 |
| Quiz answered correctly / attempted | +40 / +5 |

Zones unlock by XP: **Sunlit Reef** (0) → **Twilight Zone** (150) → **Midnight Zone** (400) → **Abyssal Plain** (750) → **Hadal Trench** (1100). Content lives in `shared/ocean.ts`. Add species or zones there and both the UI and the AI pick them up.

## AI companion

- **Model:** chosen in `.env` (see `.env.example`) and handled by `server/llm.ts`:
  - **Groq** (recommended, free, about 1,000 requests a day per model): set `GROQ_API_KEY` from https://console.groq.com/keys
  - **Gemini** (free tier, but small daily quotas): set `GEMINI_API_KEY` from https://aistudio.google.com/apikey. Several free models are tried in order, and a busy or rate-limited one is skipped for a minute.
  - **Ollama** (free, runs offline on your PC): set `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY` if needed
  - **Claude** (paid): set `ANTHROPIC_API_KEY`
- **Chat and narration** (`POST /api/chat`, SSE stream): game events such as starting a session, descending, or inspecting a species are sent as `[GAME EVENT]` turns, so the companion reacts in character. Every turn includes the live game state and the learner profile.
- **Quizzes** (`POST /api/quiz`, `/api/quiz/answer`, `server/quiz.ts`): built only from the species cards the player has scanned (habitat, threats, what helps, status, scientific name, key fact, zone). No AI call is needed, so they always work. Wrong options are real facts from other cards, and the answer stays on the server.
- **Never silent:** if every AI model is down or out of free quota, the buddy answers with a scripted line built from species facts.
- **Personality:** the buddy is written as a playful young marine biologist friend. Each reply starts with a hidden mood tag (`[excited]`, `[amazed]`, `[spooky]`…) that sets the voice's tone and the avatar colour.
- **Learner memory:** every 3 turns a background call updates `learner` (summary, knowledge level, interests, strengths, gaps, age band). The dashboard shows it as the buddy's notes.
- **Voice out** (`POST /api/tts`): uses Gemini TTS (free, natural and emotional; set the voice with `GEMINI_TTS_VOICE`, default `Leda`), then ElevenLabs, then the most natural browser voice available.
- **Voice in:** the mic button uses the browser Web Speech API (Chrome, Edge, Safari). Talking interrupts the companion.
- Claude only: server-side refusal fallbacks (beta) are on by default. Set `ANTHROPIC_FALLBACKS=off` to disable them.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | AI and voice availability |
| POST | `/api/auth/register` · `/login` · `/logout` | Accounts (sets an httpOnly session cookie) |
| GET | `/api/auth/me` | Current user + player state |
| GET | `/api/me` | Player state + highest unlocked zone |
| PATCH | `/api/me/diver` | Diver name, wetsuit hue, buddy name, voice on/off |
| POST | `/api/me/zone` | Change zone (XP-gated on the server) |
| POST | `/api/me/discover` | Record a species scan (+XP once) |
| POST | `/api/me/reset` | Wipe progress and learner profile |
| POST | `/api/chat` | Stream buddy reply (SSE: `mood`, `delta`, `done`, `error`) |
| POST | `/api/quiz` / `/api/quiz/answer` | Generate / grade an adaptive quiz |
| POST | `/api/tts` | Speech audio for a line + mood (204 = use browser voice) |

Everything except health and auth needs a logged-in session. Data lives in `data/users.json` and `data/players.json`. Swap `server/store.ts` and `server/auth.ts` for a real database before running several server instances.

## File map

| Purpose | File |
| --- | --- |
| Zones, species, shared types | `shared/ocean.ts` |
| Express server + routes | `server/index.ts` |
| Companion prompts, quizzes, learner modelling | `server/ai.ts` |
| AI provider switch (Gemini / Groq / Ollama / Claude) | `server/llm.ts` |
| Persistence | `server/store.ts` |
| Buddy voice (Gemini TTS → ElevenLabs → browser) | `server/tts.ts` |
| Accounts + sessions | `server/auth.ts` |
| Login / Dashboard / Game pages | `client/src/pages/{Login,Dashboard,Dive}.tsx` |
| Water shader + particles, scenery | `client/src/components/ocean/` |
| Diver + creature art | `client/src/components/art/` |
| Procedural soundscape | `client/src/lib/oceanAudio.ts` |
| Companion panel (chat, mic, quizzes) | `client/src/components/Companion.tsx` |
| Voice in/out | `client/src/hooks/useVoice.ts` |
| New UI styles | `client/src/game.css` |

