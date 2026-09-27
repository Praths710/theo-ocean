import dotenv from "dotenv";

dotenv.config({ quiet: true });

// Keys pasted into a hosting dashboard often pick up spaces, line breaks or quotes: strip them.
for (const name of Object.keys(process.env)) {
  if (!/_(API_)?KEY$/.test(name)) continue;
  const clean = process.env[name]!.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
  if (clean) process.env[name] = clean;
  else delete process.env[name];
}
