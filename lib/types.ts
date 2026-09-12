// Shared domain types for Resume.

export type ActivityType = "page_visit" | "copy" | "tab_switch" | string;

export interface Activity {
  id?: string;
  created_at?: string;
  type: ActivityType;
  title?: string;
  url?: string;
  content?: string;
  task?: string;
  raw?: Record<string, unknown>;
}

// The AI-generated checkpoint. Matches the /api/summarize output shape,
// and maps onto the `reminders` table (see supabase/schema.sql).
export interface ResumePoint {
  id?: string;
  created_at?: string;
  title: string;
  workingOn: string; // ← reminders.summary
  remembers: string[]; // ← reminders.remembers
  nextStep: string; // ← reminders.next_step
  deviceId?: string; // ← reminders.device_id
  source?: string; // ← reminders.source
}
