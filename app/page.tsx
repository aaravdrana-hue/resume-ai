"use client";

import { useState } from "react";

interface ResumePoint {
  title: string;
  workingOn: string;
  remembers: string[];
  nextStep: string;
}

// Sample activity feed so the app is usable with one click at a demo.
const SAMPLE_ACTIVITIES = [
  "Opened the Slack API dashboard",
  "Read the Slack OAuth documentation",
  "Copied the channels:history scope",
  "Started sketching the OAuth callback route",
];

export default function Home() {
  const [point, setPoint] = useState<ResumePoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activities: SAMPLE_ACTIVITIES }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.error || "Request failed");
      }

      setPoint(data as ResumePoint);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-8 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-16 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Resume</h1>
            <p className="mt-2 text-lg text-zinc-400">
              Pick up where you left off.
            </p>
          </div>

          <button
            onClick={generate}
            disabled={loading}
            className="rounded-xl bg-white px-6 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate Resume Point"}
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm uppercase tracking-widest text-zinc-500">
            Recent Work
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!point && !loading && !error && (
          <p className="text-zinc-500">
            Click “Generate Resume Point” to build one from your recent activity.
          </p>
        )}

        {point && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
            <div className="mb-8 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-medium">{point.title}</h2>
                <p className="mt-1 text-zinc-500">just now</p>
              </div>

              <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
                Development
              </span>
            </div>

            <div className="space-y-7">
              <section>
                <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">
                  You were working on
                </p>
                <p className="text-lg text-zinc-200">{point.workingOn}</p>
              </section>

              <section>
                <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">
                  Resume remembers
                </p>
                <ul className="space-y-2 text-zinc-300">
                  {point.remembers.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </section>

              <section className="border-t border-zinc-800 pt-6">
                <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">
                  Next step
                </p>
                <p className="text-lg text-white">{point.nextStep}</p>
              </section>
            </div>

            <div className="mt-8 flex justify-end">
              <button className="rounded-xl bg-white px-6 py-3 font-medium text-black transition hover:bg-zinc-200">
                Resume
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
