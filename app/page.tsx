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
            Turn YouTube strategy videos (like Waqar Asim) into structured entry
            models, detailed study guides, and quizzes so you actually remember
            the setups.
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
            <li>Pick a strategy video on YouTube.</li>
            <li>
              Go to{" "}
              <Link href="/builder" className="text-emerald-400 underline">
                /builder
              </Link>{" "}
              and paste the video link.
            </li>
            <li>
              Let AI auto-create an entry model from the video and store it in
              your library.
            </li>
            <li>
              Use the AI Coach to get a detailed explanation and image
              references for what to screenshot on the charts.
            </li>
            <li>Use the Quiz feature to drill the rules into your brain.</li>
          </ol>
        </section>

        {/* Section: Example video link */}
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
                Use any of his strategy videos as the base for your entry
                models. Paste the link into the builder and let AI structure it.
              </p>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
