import { jsonWithCors, preflight } from "@/lib/cors";
import { getSupabase } from "@/lib/supabase";
import type { ResumePoint } from "@/lib/types";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

// The `reminders` table uses snake_case and slightly different names than the
// UI/AI shape, so we translate at this boundary.
interface ReminderRow {
  id: string;
  created_at: string;
  device_id: string | null;
  title: string | null;
  summary: string | null;
  remembers: unknown;
  next_step: string | null;
  source: string | null;
  activity: unknown;
}

export function rowToResumePoint(row: ReminderRow): ResumePoint {
  return {
    id: row.id,
    created_at: row.created_at,
    title: row.title ?? "Untitled task",
    workingOn: row.summary ?? "",
    remembers: Array.isArray(row.remembers) ? (row.remembers as string[]) : [],
    nextStep: row.next_step ?? "",
    deviceId: row.device_id ?? undefined,
    source: row.source ?? undefined,
  };
}

/**
 * GET /api/resume-points?limit=20
 * Newest Resume Points first — powers the dashboard feed.
 */
export async function GET(request: Request) {
  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = Math.min(Number(limitParam) || 20, 100);

  try {
    const { data, error } = await getSupabase()
      .from("reminders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    const points = (data ?? []).map((row) => rowToResumePoint(row as ReminderRow));

    return jsonWithCors({ resumePoints: points });
  } catch (error: unknown) {
    console.error("[resume-points] fetch failed:", error);
    return jsonWithCors(
      { error: "Failed to load Resume Points.", detail: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return preflight();
}
