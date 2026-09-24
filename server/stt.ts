import { zones } from "../shared/ocean";

// Speech-to-text with Groq Whisper (free tier). Far more accurate than the browser's built-in
// recognition, works in iPhone Safari, and is primed with the game's species names.

const GROQ_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo";

export const sttConfigured = () => Boolean(GROQ_KEY);

// Vocabulary hint so rare words ("vaquita", "siphonophore") are spelled correctly.
const VOCAB = `Ocean dive game. Species: ${zones.flatMap((z) => z.species.map((s) => s.name)).join(", ")}. Zones: ${zones.map((z) => z.name).join(", ")}. Words: bioluminescence, coral reef, marine biology, Coral.`;

const EXT: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-m4a": "m4a", "audio/aac": "m4a" };

export async function transcribe(audio: Buffer, mimeType: string): Promise<string> {
  if (!GROQ_KEY) throw Object.assign(new Error("Speech recognition needs GROQ_API_KEY"), { status: 503 });
  const base = mimeType.split(";")[0].trim().toLowerCase();
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: base || "audio/webm" }), `speech.${EXT[base] ?? "webm"}`);
  form.append("model", MODEL);
  form.append("language", "en");
  form.append("prompt", VOCAB);
  form.append("response_format", "json");
  form.append("temperature", "0");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}` },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw Object.assign(new Error(`Whisper ${res.status}: ${(await res.text()).slice(0, 200)}`), { status: res.status });
  const json = (await res.json()) as { text?: string };
  // Whisper sometimes echoes the priming prompt on silence; drop that.
  const text = (json.text ?? "").trim();
  return text.startsWith("Ocean dive game") ? "" : text;
}
