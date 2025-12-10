// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
        {/* Hero */}
        <header className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">
            AI Builder Trading
          </h1>
          <p className="max-w-2xl text-sm text-zinc-400">
            Learn entries from your favorite YouTube trader, turn them into
            structured entry models, and quiz yourself until it&apos;s burned
            into your brain.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/builder"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black"
            >
              🚀 Open AI Entry Model Builder
            </Link>

            <a
              href="https://youtube.com/@waqarasim"
              target="_blank"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200"
            >
              📺 Waqar Asim YouTube Channel
            </a>
          </div>
        </header>

        {/* Section: How it works */}
        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="text-sm font-semibold text-zinc-100">
            How this tool fits your learning
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-xs text-zinc-300">
            <li>Watch a strategy video on YouTube (e.g. Waqar Asim).</li>
            <li>
              Open the{" "}
              <Link href="/builder" className="text-emerald-400 underline">
                AI Entry Model Builder
              </Link>{" "}
              and create a new model.
            </li>
            <li>
              Paste the video URL + important timestamps (where he explains HTF
              bias, liquidity, entries).
            </li>
            <li>
              Let the AI Coach create detailed explanations and image
              references so you know exactly what to screenshot.
            </li>
            <li>Use the Quiz tab to drill the rules until they feel natural.</li>
          </ol>
        </section>

        {/* Section: Example video links */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-100">
            Example Videos To Turn Into Models
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            <a
              href="https://www.youtube.com/@waqarasim"
              target="_blank"
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs hover:border-emerald-500"
            >
              <p className="font-medium text-zinc-100">
                Waqar Asim – Smart Money / ICT concepts
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">
                Use his videos as the base for your entry models. Note timestamps
                where he explains bias, liquidity and entries.
              </p>
            </a>

            {/* Add more specific video links here if you want */}
            {/* Example: */}
            {/* <a
              href="https://www.youtube.com/watch?v=VIDEO_ID"
              target="_blank"
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs hover:border-emerald-500"
            >
              <p className="font-medium text-zinc-100">
                London Session Liquidity Sweep Strategy
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">
                Great candidate to build a model: HTF bias, liquidity grab, FVG
                entry, clear TP.
              </p>
            </a> */}
          </div>
        </section>
      </div>
    </div>
  );
}
