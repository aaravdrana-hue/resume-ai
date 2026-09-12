import { jsonWithCors, preflight } from "@/lib/cors";

// Never cache — we want the live state of the running server.
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Reports whether the server can see each required variable, and enough
 * shape to spot a wrong-key-in-the-right-slot mistake. Values are never
 * returned — only booleans, lengths, and prefixes.
 */
export function GET() {
  const groq = process.env.GROQ_API_KEY ?? "";
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const describe = (v: string) => ({
    set: v.length > 0,
    length: v.length,
    prefix: v ? v.slice(0, 3) : null,
  });

  return jsonWithCors({
    ok: Boolean(groq && url && key),
    env: {
      GROQ_API_KEY: { ...describe(groq), looksRight: groq.startsWith("gsk_") },
      SUPABASE_URL: { ...describe(url), looksRight: url.includes(".supabase.co") },
      SUPABASE_SERVICE_ROLE_KEY: {
        ...describe(key),
        looksRight: key.startsWith("sb_secret_") || key.startsWith("eyJ"),
      },
    },
    runtime: {
      vercel: Boolean(process.env.VERCEL),
      env: process.env.VERCEL_ENV ?? "local",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
  });
}

export function OPTIONS() {
  return preflight();
}
