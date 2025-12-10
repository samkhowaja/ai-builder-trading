// app/page.tsx
"use client";

import React, { useEffect, useState } from "react";

type AnalyzeResponse = {
  analysis: string;
};

type UploadImage = {
  name: string;
  dataUrl: string;
};

const PAIRS_STORAGE_KEY = "ai-builder-pairs-v1";

const defaultPairs = ["EURUSD", "GBPUSD", "XAUUSD", "NAS100", "US30"];

const allTimeframes = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];

export default function HomePage() {
  const [pairs, setPairs] = useState<string[]>([]);
  const [pairsText, setPairsText] = useState("");
  const [selectedPair, setSelectedPair] = useState<string>("EURUSD");

  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>([
    "H4",
    "H1",
    "M15",
  ]);

  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);

  // Load pairs from localStorage
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(PAIRS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        const list = parsed.length ? parsed : defaultPairs;
        setPairs(list);
        setSelectedPair(list[0]);
      } else {
        setPairs(defaultPairs);
        setSelectedPair(defaultPairs[0]);
      }
    } catch (e) {
      console.error("failed to load pairs", e);
      setPairs(defaultPairs);
      setSelectedPair(defaultPairs[0]);
    }
  }, []);

  // Keep textarea in sync with pairs
  useEffect(() => {
    setPairsText(pairs.join("\n"));
  }, [pairs]);

  // Save pairs whenever they change
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PAIRS_STORAGE_KEY, JSON.stringify(pairs));
      }
    } catch (e) {
      console.error("failed to save pairs", e);
    }
  }, [pairs]);

  const handlePairsTextChange = (raw: string) => {
    setPairsText(raw);
    const list = raw
      .split("\n")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const unique = Array.from(new Set(list));
    setPairs(unique);
    if (unique.length && !unique.includes(selectedPair)) {
      setSelectedPair(unique[0]);
    }
  };

  const toggleTimeframe = (tf: string) => {
    setSelectedTimeframes((prev) =>
      prev.includes(tf) ? prev.filter((t) => t !== tf) : [...prev, tf],
    );
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = Array.from(e.target.files);
    setFiles(fileList);
  };

  const handleAnalyze = async () => {
    if (!files.length) {
      setError("Please upload at least one chart screenshot.");
      return;
    }
    if (!selectedPair) {
      setError("Please select a trading pair.");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      // Convert each file to base64 data URL
      const imagePromises: Promise<UploadImage>[] = files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: file.name,
                dataUrl: reader.result as string,
              });
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          }),
      );

      const images = await Promise.all(imagePromises);

      const res = await fetch("/api/analyze-charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair: selectedPair,
          timeframes: selectedTimeframes,
          notes,
          images,
        }),
      });

      const data = (await res.json()) as AnalyzeResponse & { error?: string };

      if (!res.ok) {
        setError(data.error || "Failed to analyze charts.");
        return;
      }

      setAnalysis(data.analysis);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while analyzing.");
    } finally {
      setLoading(false);
    }
  };

  const renderAnalysisParagraphs = (text: string) =>
    text
      .split(/\n\s*\n/)
      .map((p, idx) => (
        <p key={idx} className="mb-2 text-sm leading-relaxed text-zinc-100">
          {p.trim()}
        </p>
      ));

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row">
        {/* LEFT SIDEBAR */}
        <aside className="w-full md:w-72 space-y-4">
          {/* My Trading Pairs */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-xs">
            <h2 className="mb-2 text-sm font-semibold text-zinc-100">
              🎯 My Trading Pairs
            </h2>

            <div className="mb-2 flex flex-wrap gap-1">
              {pairs.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPair(p)}
                  className={`rounded-full px-2 py-1 text-[11px] ${
                    p === selectedPair
                      ? "bg-emerald-500 text-black"
                      : "bg-zinc-800 text-zinc-200"
                  }`}
                >
                  {p}
                </button>
              ))}
              {!pairs.length && (
                <p className="text-[11px] text-zinc-500">
                  Add some pairs below (one per line).
                </p>
              )}
            </div>

            <label className="block text-[11px] text-zinc-400">
              Edit pairs (one per line)
              <textarea
                className="mt-1 h-24 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-[11px] outline-none"
                value={pairsText}
                onChange={(e) => handlePairsTextChange(e.target.value)}
                placeholder={"EURUSD\nGBPUSD\nXAUUSD\nNAS100\nUS30"}
              />
            </label>
          </section>

          {/* Quick Help / Navigation */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-[11px] text-zinc-300">
            <h2 className="mb-2 text-sm font-semibold text-zinc-100">
              📚 Learning Page
            </h2>
            <p className="mb-2">
              This home page is your{" "}
              <span className="font-semibold">Chart Analyzer</span>.
            </p>
            <p>
              To see your saved entry models and ebook-style study guides, go to{" "}
              <a
                href="/builder"
                className="font-medium text-emerald-400 underline"
              >
                /builder
              </a>
              .
            </p>
          </section>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 space-y-4">
          {/* Hero / Explanation */}
          <header className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
              🧠 AI Chart Analyzer
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Upload screenshots from multiple timeframes (H4, H1, M15, M5,
              etc.) for <span className="font-semibold">{selectedPair}</span>.
              The AI will analyze <span className="italic">all of them together</span>{" "}
              so it sees the full story from higher timeframe to execution.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Tip: Grouping all timeframes into one analysis is usually more
              cost-efficient than sending separate requests, because the base
              instructions are only paid for once.
            </p>
          </header>

          {/* Upload + options */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-4">
            {/* Timeframe selectors */}
            <div>
              <h2 className="mb-2 text-sm font-semibold text-zinc-100">
                1. Select timeframes you uploaded
              </h2>
              <div className="flex flex-wrap gap-2 text-xs">
                {allTimeframes.map((tf) => {
                  const active = selectedTimeframes.includes(tf);
                  return (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => toggleTimeframe(tf)}
                      className={`rounded-full px-3 py-1 ${
                        active
                          ? "bg-emerald-500 text-black"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      {tf}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                This just tells the AI what kind of structure to expect; you
                still upload the actual screenshots below.
              </p>
            </div>

            {/* File upload */}
            <div>
              <h2 className="mb-2 text-sm font-semibold text-zinc-100">
                2. Upload chart screenshots
              </h2>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesChange}
                className="text-xs"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                You can select multiple images at once (e.g. H4, H1, M15, M5).
                They will all be analyzed in one go.
              </p>

              {files.length > 0 && (
                <div className="mt-2 rounded-md border border-zinc-800 bg-black/40 p-2 text-[11px] text-zinc-300">
                  <p className="mb-1 font-semibold">
                    Selected images ({files.length}):
                  </p>
                  <ul className="max-h-24 space-y-1 overflow-auto">
                    {files.map((f) => (
                      <li key={f.name} className="truncate">
                        • {f.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <h2 className="mb-2 text-sm font-semibold text-zinc-100">
                3. Extra notes / question (optional)
              </h2>
              <textarea
                className="h-20 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-100 outline-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  "Example:\n- Tell me the higher timeframe bias and why.\n" +
                  "- Is there liquidity being grabbed here?\n" +
                  "- Where is a high-probability entry with SL/TP idea?"
                }
              />
            </div>

            {/* Analyze button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:bg-emerald-900"
              >
                {loading ? "Analyzing..." : "Analyze Charts"}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-400">
                {error}
              </p>
            )}
          </section>

          {/* Analysis output */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <h2 className="mb-2 text-sm font-semibold text-zinc-100">
              4. Analysis
            </h2>
            <div className="max-h-[400px] overflow-auto rounded-md border border-zinc-800 bg-black/40 p-3">
              {analysis ? (
                <div>{renderAnalysisParagraphs(analysis)}</div>
              ) : (
                <p className="text-xs text-zinc-500">
                  Once you upload charts and click{" "}
                  <span className="font-semibold">Analyze Charts</span>, the
                  breakdown will appear here: bias, liquidity story, key levels,
                  and a possible entry idea.
                </p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
