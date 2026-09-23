import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { z } from "zod";

// Provider layer. Every configured free provider joins one fallback chain, tried in order:
//   1. Groq     (GROQ_API_KEY)   free tier ~1,000 requests/day per model, very fast   ← recommended
//   2. Custom   (LLM_BASE_URL + LLM_MODEL [+ LLM_API_KEY]) any OpenAI-compatible server, e.g. Ollama
//   3. Gemini   (GEMINI_API_KEY) free tier, but small daily quotas and frequent "high demand" errors
// Claude (ANTHROPIC_API_KEY, paid) is used only when LLM_PROVIDER=anthropic or nothing else is set.
// A model that fails (quota, overload, timeout) is benched for a while and the next one is tried.

export type ChatMsg = { role: "user" | "assistant"; content: string };
export type Effort = "low" | "medium";

type Route = { name: string; client: OpenAI; model: string; extra?: Record<string, unknown> };

const routes: Route[] = [];
const csv = (s: string | undefined, d: string[]) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : d);

if (process.env.GROQ_API_KEY) {
  const client = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1", maxRetries: 0, timeout: 20_000 });
  for (const model of csv(process.env.GROQ_MODELS, ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"])) {
    routes.push({ name: "groq", client, model, extra: model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : { reasoning_format: "hidden" } });
  }
}
if (process.env.LLM_BASE_URL) {
  const client = new OpenAI({ apiKey: process.env.LLM_API_KEY || "not-needed", baseURL: process.env.LLM_BASE_URL, maxRetries: 0, timeout: 60_000 });
  for (const model of csv(process.env.LLM_MODEL, ["llama3.1"])) routes.push({ name: "custom", client, model });
}
if (process.env.GEMINI_API_KEY) {
  const client = new OpenAI({ apiKey: process.env.GEMINI_API_KEY, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", maxRetries: 0, timeout: 20_000 });
  for (const model of csv(process.env.GEMINI_MODELS, ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"])) {
    routes.push({ name: "gemini", client, model });
  }
}

const useAnthropic =
  process.env.LLM_PROVIDER === "anthropic" || (!routes.length && Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN));

export const llmConfigured = () => useAnthropic || routes.length > 0;
export const llmLabel = () =>
  useAnthropic ? `claude (${process.env.ANTHROPIC_MODEL ?? "claude-opus-5"})`
  : routes.length ? Array.from(new Set(routes.map((r) => r.name))).join(" → ")
  : "OFF - add GROQ_API_KEY or GEMINI_API_KEY (both free) to .env";

/** Normalises provider errors to an HTTP-ish status so routes can show a helpful message. */
export function errorStatus(err: unknown): number | undefined {
  if (err instanceof OpenAI.APIConnectionTimeoutError) return 504;
  const status = (err as { status?: unknown })?.status;
  return typeof status === "number" ? status : undefined;
}

const benchedUntil = new Map<string, number>();

async function withFallback<T>(fn: (r: Route) => Promise<T>): Promise<T> {
  const now = Date.now();
  const ready = routes.filter((r) => (benchedUntil.get(`${r.name}:${r.model}`) ?? 0) <= now);
  let lastErr: unknown = new Error("No AI model available right now");
  for (const r of ready.length ? ready : routes) {
    try {
      return await fn(r);
    } catch (err) {
      const status = errorStatus(err) ?? 0;
      if (status === 401 || status === 403) { lastErr = err; benchedUntil.set(`${r.name}:${r.model}`, now + 3_600_000); continue; }
      const perDay = /PerDay|per day|RPD/i.test(String((err as Error)?.message));
      const bench = status === 404 ? 3_600_000 : status === 429 ? (perDay ? 3_600_000 : 60_000) : 45_000;
      benchedUntil.set(`${r.name}:${r.model}`, Date.now() + bench);
      console.warn(`[llm] ${r.name}/${r.model} failed (${status || "network"}); trying next`);
      lastErr = err;
    }
  }
  throw lastErr;
}

// ---------------- OpenAI-compatible routes ----------------

async function* oaStream(system: string[], messages: ChatMsg[]) {
  const stream = await withFallback((r) => r.client.chat.completions.create({
    model: r.model,
    stream: true,
    max_tokens: 1200,
    messages: [{ role: "system", content: system.join("\n\n") }, ...messages],
    ...(r.extra ?? {}),
  } as OpenAI.Chat.ChatCompletionCreateParamsStreaming));
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

async function oaJson<T>(schema: z.ZodType<T>, name: string, system: string | undefined, prompt: string): Promise<T> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    { role: "user", content: `${prompt}\n\nRespond with only a JSON object matching this schema:\n${JSON.stringify(jsonSchema)}` },
  ];
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await withFallback((r) => r.client.chat.completions.create({
      model: r.model,
      max_tokens: 1500,
      messages,
      response_format: { type: "json_object" },
      ...(r.extra ?? {}),
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming));
    const raw = res.choices[0]?.message?.content ?? "";
    try {
      return schema.parse(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")));
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Model returned invalid JSON: ${String(lastErr)}`);
}

// ---------------- Anthropic (Claude) ----------------

let anthropic: Anthropic | null = null;
const ant = () => (anthropic ??= new Anthropic());
const claudeModel = () => process.env.ANTHROPIC_MODEL ?? "claude-opus-5";
const fallbackParams =
  process.env.ANTHROPIC_FALLBACKS === "off" ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

async function* antStream(system: string[], messages: ChatMsg[]) {
  const stream = ant().beta.messages.stream({
    model: claudeModel(),
    max_tokens: 2000,
    output_config: { effort: "low" },
    system: system.map((text, i) => (i === 0 ? { type: "text" as const, text, cache_control: { type: "ephemeral" as const } } : { type: "text" as const, text })),
    messages,
    ...fallbackParams,
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") yield "Let's keep our focus on the ocean around us. What would you like to explore?";
}

async function antJson<T>(schema: z.ZodType<T>, system: string | undefined, prompt: string, effort: Effort): Promise<T> {
  const res = await ant().beta.messages.parse({
    model: claudeModel(),
    max_tokens: 4000,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: prompt }],
    ...fallbackParams,
  });
  if (!res.parsed_output) throw new Error("Model returned no structured output");
  return res.parsed_output as T;
}

// ---------------- Public API ----------------

/** Stream a conversational reply. `system[0]` should be the stable prompt. */
export function streamReply(system: string[], messages: ChatMsg[]): AsyncGenerator<string> {
  return useAnthropic ? antStream(system, messages) : oaStream(system, messages);
}

/** One-shot call that returns data validated against `schema`. */
export function jsonCall<T>(schema: z.ZodType<T>, opts: { name: string; system?: string; prompt: string; effort?: Effort }): Promise<T> {
  return useAnthropic ? antJson(schema, opts.system, opts.prompt, opts.effort ?? "low") : oaJson(schema, opts.name, opts.system, opts.prompt);
}
