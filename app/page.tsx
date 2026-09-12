const resumePoints = [
  {
    id: "1",
    title: "Slack Integration",
    timeAgo: "12 minutes ago",
    category: "Development",
    workingOn: "Implementing Slack OAuth for your application.",
    remembers: [
      "You decided to use Slack Bolt.",
      "You were researching OAuth permissions.",
      "You copied the channels:history scope.",
    ],
    nextStep: "Finish the OAuth callback route.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white px-8 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-16">
          <h1 className="text-4xl font-semibold tracking-tight">
            Resume
          </h1>

          <p className="mt-2 text-lg text-zinc-400">
            Pick up where you left off.
          </p>
        </div>

        <div className="mb-6">
          <p className="text-sm uppercase tracking-widest text-zinc-500">
            Recent Work
          </p>
        </div>

        <div className="space-y-6">
          {resumePoints.map((point) => (
            <div
              key={point.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8"
            >
              <div className="mb-8 flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-medium">
                    {point.title}
                  </h2>

                  <p className="mt-1 text-zinc-500">
                    {point.timeAgo}
                  </p>
                </div>

                <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
                  {point.category}
                </span>
              </div>

              <div className="space-y-7">
                <section>
                  <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">
                    You were working on
                  </p>

                  <p className="text-lg text-zinc-200">
                    {point.workingOn}
                  </p>
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

                  <p className="text-lg text-white">
                    {point.nextStep}
                  </p>
                </section>
              </div>

              <div className="mt-8 flex justify-end">
                <button className="rounded-xl bg-white px-6 py-3 font-medium text-black transition hover:bg-zinc-200">
                  Resume
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}