import crypto from "node:crypto";

// Companion voice, best available first:
//   1. Gemini TTS (free tier, natural + emotional) when GEMINI_API_KEY is set
//   2. ElevenLabs when ELEVENLABS_API_KEY is set
//   3. otherwise 204 → the browser's built-in speechSynthesis
// Returns audio bytes + mime type, or null to tell the client to use the browser voice.

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_TTS_MODELS = (process.env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-tts,gemini-3.8-flash-lite-tts").split(",").map((s) => s.trim());
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_flash_v2_5";

export const ttsConfigured = () => Boolean(GEMINI_KEY || ELEVEN_KEY);
export const ttsLabel = () => (GEMINI_KEY ? "Gemini voice" : ELEVEN_KEY ? "ElevenLabs" : "browser");

// Voice per companion "mood" style. Leda = youthful, bright; tweak with GEMINI_TTS_VOICE.
const VOICE = process.env.GEMINI_TTS_VOICE ?? "Leda";
const MOOD_STYLE: Record<string, string> = {
  excited: "bubbly and excited, smiling while talking, fast and bright",
  amazed: "breathless wonder, genuinely amazed, a little awed",
  curious: "curious and playful, leaning in, warm",
  playful: "cheeky and playful, teasing with a grin",
  calm: "calm, soft and soothing, like whispering underwater",
  gentle: "gentle, kind and encouraging",
  proud: "proud and cheering, celebrating a friend",
  spooky: "hushed, mysterious and a bit spooky, like telling a campfire story",
};

// Small LRU so repeated lines (e.g. quiz explanations replayed) don't burn free quota.
const cache = new Map<string, { data: Buffer; mime: string }>();
function remember(k: string, v: { data: Buffer; mime: string }) {
  cache.set(k, v);
  if (cache.size > 60) cache.delete(cache.keys().next().value!);
}

let geminiCooldownUntil = 0;

async function geminiTts(text: string, mood: string): Promise<{ data: Buffer; mime: string } | null> {
  if (Date.now() < geminiCooldownUntil) return null;
  const style = `${MOOD_STYLE[mood] ?? MOOD_STYLE.curious}; a friendly young marine biologist diving buddy, natural and human, never robotic`;
  for (const model of GEMINI_TTS_MODELS) {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style }] }] }],
        response_format: { type: "audio", mime_type: "audio/wav", sample_rate: 24000 },
        generation_config: { speech_config: [{ voice: VOICE }] },
        stream: false,
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res) continue;
    if (res.status === 429) {
      console.warn(`[tts] ${model} rate-limited`);
      continue;
    }
    if (!res.ok) {
      console.warn(`[tts] ${model} ${res.status}`);
      continue;
    }
    const json = (await res.json()) as { steps?: { content?: { data?: string; mime_type?: string }[] }[] };
    for (const step of json.steps ?? []) {
      for (const c of step.content ?? []) {
        if (c.data) return { data: Buffer.from(c.data, "base64"), mime: c.mime_type?.startsWith("audio/") ? c.mime_type.split(";")[0] : "audio/wav" };
      }
    }
  }
  // Every model failed (usually free-tier quota) — rest for a minute, browser voice meanwhile.
  geminiCooldownUntil = Date.now() + 60_000;
  return null;
}

async function elevenTts(text: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": ELEVEN_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: ELEVEN_MODEL }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  return { data: Buffer.from(await res.arrayBuffer()), mime: "audio/mpeg" };
}

export async function synthesize(rawText: string, mood = "curious"): Promise<{ data: Buffer; mime: string } | null> {
  const text = rawText.slice(0, 900);
  const key = crypto.createHash("sha1").update(`${mood}|${text}`).digest("hex");
  const hit = cache.get(key);
  if (hit) return hit;
  let out: { data: Buffer; mime: string } | null = null;
  if (GEMINI_KEY) out = await geminiTts(text, mood);
  if (!out && ELEVEN_KEY) out = await elevenTts(text).catch(() => null);
  if (out) remember(key, out);
  return out;
}
