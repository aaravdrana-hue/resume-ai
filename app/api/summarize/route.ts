import { jsonWithCors, preflight } from "@/lib/cors";
import OpenAI from "openai";
import { getSupabase } from "@/lib/supabase";
import type { ResumePoint } from "@/lib/types";

// Groq exposes an OpenAI-compatible API, but ONLY the /chat/completions
// surface — the newer Responses API is not implemented there. So we use
// the OpenAI SDK pointed at Groq and call chat.completions.
//
// Built lazily, on first request. At module scope the SDK constructor runs
// while Next.js collects page data at BUILD time, where no runtime env is
// available — and it throws "Missing credentials", failing the build.
let groqClient: OpenAI | null = null;

function getGroq(): OpenAI {
  if (!groqClient) {
    groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return groqClient;
}

// A current Groq-hosted model that supports JSON mode via the OpenAI SDK.
const MODEL = "openai/gpt-oss-20b";

const SYSTEM_PROMPT = `
You are the intelligence layer for an app called Resume.

Resume restores a person's TRAIN OF THOUGHT after they switch tasks. You are
given raw browsing signals (page visits, tab switches, copied text). Your job
is to reconstruct the underlying WORK, not to narrate the browsing.

Write in second person ("You were...", "You copied...").

TITLE
A short, specific project name for the work — like a ticket title.
Good: "Slack OAuth Integration", "Hero Section Redesign".
Bad: "YouTube Browsing", "Web Research", "Various Tabs".
Infer the goal that connects the pages. If the activity is genuinely
scattered, name the dominant thread rather than describing the scatter.

WORKING ON
One sentence on what the person was trying to ACCOMPLISH — the objective
behind the tabs, not the tabs themselves.

REMEMBERS
2-4 bullets of things that would be genuinely painful to reconstruct from
memory.

Each bullet must be a COMPLETE SENTENCE that says what the thing was and why
it mattered — never a bare value on its own.
  Good: "You copied the channels:history scope, which Slack requires to read
         public channel messages."
  Bad:  "channels:history"
  Good: "You hit a 'redirect_uri did not match' error, so the callback URL in
         the Slack dashboard is still wrong."
  Bad:  "redirect_uri did not match"

Prioritize, in order:
  1. Exact values copied (scopes, package names, API keys' NAMES, config
     strings, error messages) — quote them verbatim.
  2. Decisions made or options compared, and the apparent reason.
  3. Specific constraints or requirements discovered.
  4. Concrete progress made.

NEVER write a bullet that is just a logged event. These are all forbidden:
  "Switched to the YouTube tab at 14:32"
  "Visited github.com"
  "URL: https://example.com/"
  "Opened 3 tabs"
Timestamps, tab-switch events and bare URLs are INPUT, never output. If you
cannot find 2 substantive things worth remembering, return fewer bullets
rather than padding with mechanical ones.

NEXT STEP
The single most likely next action, phrased as a concrete instruction the
person could act on immediately.

Return ONLY valid JSON in this exact shape (no markdown, no code fences):

{
  "title": "Task title",
  "workingOn": "One sentence describing what the user was trying to do.",
  "remembers": ["Substantive detail 1", "Substantive detail 2"],
  "nextStep": "The most likely next action."
}
`.trim();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

/**
 * Persist a generated Resume Point. Best-effort: if Supabase isn't configured
 * yet (or the insert fails) we log it and still return the Resume Point, so
 * the summarize endpoint never breaks just because the DB is missing.
 */
async function saveResumePoint(
  point: ResumePoint,
  activities: unknown[],
  deviceId: string | null,
  source: string | null
): Promise<string | null> {
  try {
    const { data, error } = await getSupabase()
      .from("reminders")
      .insert({
        title: point.title,
        summary: point.workingOn,
        remembers: point.remembers ?? [],
        next_step: point.nextStep,
        activity: activities,
        device_id: deviceId,
        source: source,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return (data as { id: string }).id;
  } catch (error: unknown) {
    console.warn(
      "[summarize] Resume Point not persisted:",
      getErrorMessage(error)
    );
    return null;
  }
}

export async function POST(request: Request) {
  // Fail fast with a clear message if the key never made it into the env.
  if (!process.env.GROQ_API_KEY) {
    console.error("[summarize] GROQ_API_KEY is not set in .env.local");
    return jsonWithCors(
      { error: "GROQ_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let activities: unknown;
  let deviceId: string | null = null;
  let source: string | null = null;
  try {
    const body = await request.json();
    activities = body?.activities;
    // Optional metadata the extension sends so Resume Points can be traced
    // back to a machine/browser (supports the cross-device story).
    deviceId = typeof body?.deviceId === "string" ? body.deviceId : null;
    source = typeof body?.source === "string" ? body.source : null;
  } catch {
    return jsonWithCors(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!Array.isArray(activities) || activities.length === 0) {
    return jsonWithCors(
      { error: "Body must include a non-empty `activities` array." },
      { status: 400 }
    );
  }

  try {
    const completion = await getGroq().chat.completions.create({
      model: MODEL,
      // JSON mode: Groq guarantees the content is a parseable JSON object,
      // so there are no markdown fences to strip.
      response_format: { type: "json_object" },
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Here is my recent activity:\n${JSON.stringify(
            activities,
            null,
            2
          )}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error("[summarize] Model returned empty content", completion);
      return jsonWithCors(
        { error: "The model returned an empty response." },
        { status: 502 }
      );
    }

    const resumePoint = JSON.parse(content) as ResumePoint;

    // Save it so it shows up in the dashboard feed on the next load.
    const id = await saveResumePoint(resumePoint, activities, deviceId, source);

    return jsonWithCors({ ...resumePoint, id, saved: id !== null });
  } catch (error: unknown) {
    // Surface the real upstream error to the server console AND the response
    // so failures are debuggable instead of silent.
    console.error("[summarize] Groq request failed:", error);
    return jsonWithCors(
      { error: "Failed to create Resume Point.", detail: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return preflight();
}
