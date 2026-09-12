// The Chrome extension runs on a `chrome-extension://<id>` origin, so every
// API route it calls needs CORS headers plus an OPTIONS preflight handler.
//
// We allow any origin because these routes carry no cookies or user auth —
// all secrets (Groq, Supabase) stay server-side and are never returned. If
// auth is added later, replace "*" with the specific extension origin.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

/** Wrap a JSON body in a Response that the extension is allowed to read. */
export function jsonWithCors(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: { ...corsHeaders, ...(init?.headers ?? {}) },
  });
}

/** Preflight handler — re-export as `OPTIONS` from any CORS-enabled route. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}
