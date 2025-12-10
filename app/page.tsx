// app/page.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";

type AnalyzeResponse = {
  analysis: string;
};

type UploadImage = {
  name: string;
  dataUrl: string;
};

type ClipboardImage = {
  file: File;
  previewUrl: string;
};

const PAIRS_STORAGE_KEY = "ai-builder-pairs-v1";

const defaultPairs = ["EURUSD", "GBPUSD", "XAUUSD", "NAS100", "US30"];
const allTimeframes = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];

/** Clipboard paste zone for screenshots */
function ClipboardPasteZone(props: { onImages?: (files: File[]) => void }) {
  const [images, setImages] = useState<ClipboardImage[]>([]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData.items;
      const newFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const previewUrl = URL.createObjectURL(file);
            newFiles.push(file);
            setImages((prev) => [...prev, { file, previewUrl }]);
          }
        }
      }

      if (newFiles.length && props.onImages) {
        props.onImages(newFiles);
      }
    },
    [props],
  );

  return (
    <div
      onPaste={handlePaste}
      tabIndex={0}
      className="flex min-h-[140px] flex-col rounded-xl border border-dashed border-zinc-700 bg-zinc-900/70 px-4 py-3 text-xs text-zinc-300 outline-none focus:ring-2 focus:ring-emerald-500/60"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p>
          📸{" "}
          <span className="font-semibold text-zinc-100">
            Paste screenshots from clipboard
          </span>{" "}
          (Ctrl+V / Cmd+V) while this panel is focused.
        </p>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
          Click here then paste
        </span>
      </div>

      {images.length === 0 ? (
        <p className="text-[11px] text-zinc-500">
          In TradingView: copy a screenshot to clipboard, click in this box, and
          press <kbd>Ctrl</kbd>+<kbd>V</kbd>. The images will be added to your
          analysis pool automatically.
        </p>
      ) : (
        <div className="mt-2 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
          {images.map((img, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-md border border-zinc-800 bg-black"
            >
              <img
                src={img.previewUrl}
                alt={`pasted-${i}`}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

  // Sync textarea with pairs
  useEffect(() => {
    setPairsText(pairs.join("\n"));
  }, [pairs]);

  // Save pairs
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
    setFiles((prev) => [...prev, ...fileList]);
  };

  const handlePasteImages = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleClearImages = () => {
    setFiles([]);
    setAnalysis(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!files.length) {
      setError("Please upload or paste at least one chart screenshot.");
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
      const imagePromises: Promise<UploadImage>[] = files.map(
        (file, index) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: file.name || `pasted-image-${index + 1}`,
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
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100">
      {/* Top nav */}
      <header className="border-b border-zinc-800 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-xs font-black text-black">
              AI
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">
                Trading Companion
              </p>
              <p className="text-[11px] text-zinc-500">
                Multi-TF chart analyzer & playbook builder
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-300">
              Analyzer
            </span>
            <a
              href="/builder"
              className="rounded-full px-3 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Models & Learning
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 lg:flex-row">
        {/* LEFT COLUMN – Controls */}
        <aside className="flex w-full flex-col gap-4 lg:w-80">
          {/* Pairs */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
            <h2 className="mb-1 text-sm font-semibold text-zinc-50">
              🎯 Trading workspace
            </h2>
            <p className="mb-3 text-[11px] text-zinc-500">
              Pick your pair and maintain your personal watchlist.
            </p>

            <div className="mb-2 flex flex-wrap gap-1.5">
              {pairs.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPair(p)}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    p === selectedPair
                      ? "bg-emerald-500 text-black"
                      : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
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
                className="mt-1 h-24 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-[11px] outline-none focus:border-emerald-500"
                value={pairsText}
                onChange={(e) => handlePairsTextChange(e.target.value)}
                placeholder={"EURUSD\nGBPUSD\nXAUUSD\nNAS100\nUS30"}
              />
            </label>
          </section>

          {/* Timeframes */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
            <h2 className="mb-1 text-sm font-semibold text-zinc-50">
              ⏱ Timeframe stack
            </h2>
            <p className="mb-3 text-[11px] text-zinc-500">
              Tell the AI what kind of structure to expect. You can still mix
              any screenshots.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allTimeframes.map((tf) => {
                const active = selectedTimeframes.includes(tf);
                return (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => toggleTimeframe(tf)}
                    className={`rounded-full px-3 py-1 text-[11px] ${
                      active
                        ? "bg-emerald-500 text-black"
                        : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    }`}
                  >
                    {tf}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Notes */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
            <h2 className="mb-1 text-sm font-semibold text-zinc-50">
              📝 What do you want to know?
            </h2>
            <p className="mb-2 text-[11px] text-zinc-500">
              Optional prompt to steer the analysis.
            </p>
            <textarea
              className="h-24 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-[11px] text-zinc-100 outline-none focus:border-emerald-500"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                "Example:\n- Tell me the higher timeframe bias and why.\n" +
                "- Is there liquidity being grabbed here?\n" +
                "- Where is a high-probability entry with SL/TP idea?"
              }
            />
          </section>

          {/* Analyze button */}
          <section className="sticky bottom-4 rounded-2xl border border-emerald-600/60 bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-3 text-xs text-black shadow-lg shadow-emerald-500/30">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide">
                  Ready to analyze
                </p>
                <p className="text-[11px] opacity-80">
                  {files.length ? `${files.length} image(s) queued` : "No charts yet"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading}
                className="rounded-full bg-black/90 px-4 py-1.5 text-xs font-semibold text-emerald-300 disabled:cursor-not-allowed disabled:bg-black/50"
              >
                {loading ? "Analyzing…" : "Analyze Charts"}
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] opacity-80">
              <span>Pair: {selectedPair || "—"}</span>
              <button
                type="button"
                onClick={handleClearImages}
                className="underline"
              >
                Clear images
              </button>
            </div>
            {error && (
              <p className="mt-1 text-[11px] font-medium text-red-900">
                {error}
              </p>
            )}
          </section>
        </aside>

        {/* RIGHT COLUMN – Images & Analysis */}
        <main className="flex-1 space-y-4">
          {/* Step indicator */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
            <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-400">
              {["Capture charts", "Queue screenshots", "Run analysis"].map(
                (label, idx) => (
                  <div key={label} className="flex flex-1 items-center">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[11px] text-zinc-400 ring-1 ring-zinc-700">
                      {idx + 1}
                    </div>
                    <span className="ml-2 hidden text-[11px] md:inline">
                      {label}
                    </span>
                    {idx < 2 && (
                      <div className="mx-2 h-px flex-1 bg-zinc-800" />
                    )}
                  </div>
                ),
              )}
            </div>
            <p className="text-[11px] text-zinc-500">
              Use file upload or paste to add charts. All timeframes are sent
              together in a single analysis so the AI sees the full story.
            </p>
          </section>

          {/* Images / inputs */}
          <section className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg lg:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-50">
                1. Upload chart screenshots
              </h2>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesChange}
                className="text-xs"
              />
              <p className="text-[11px] text-zinc-500">
                You can select multiple images at once (e.g. H4, H1, M15, M5).
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-50">
                2. Or paste screenshots from clipboard
              </h2>
              <ClipboardPasteZone onImages={handlePasteImages} />
            </div>

            {files.length > 0 && (
              <div className="col-span-full mt-2 rounded-lg border border-zinc-800 bg-black/50 p-3 text-[11px] text-zinc-300">
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-semibold">
                    Images queued for analysis ({files.length})
                  </p>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                    All timeframes analyzed together
                  </span>
                </div>
                <ul className="max-h-24 space-y-1 overflow-auto">
                  {files.map((f, idx) => (
                    <li key={idx} className="truncate">
                      • {f.name || `pasted-image-${idx + 1}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Analysis */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-50">
                  3. Multi-TF analysis
                </h2>
                <p className="text-[11px] text-zinc-500">
                  Bias, liquidity story, entry idea and red-flags for{" "}
                  <span className="font-semibold text-emerald-300">
                    {selectedPair}
                  </span>
                  .
                </p>
              </div>
              {analysis && (
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
                  ✅ Latest run
                </span>
              )}
            </div>

            <div className="max-h-[420px] overflow-auto rounded-md border border-zinc-800 bg-black/40 p-3">
              {analysis ? (
                <div>{renderAnalysisParagraphs(analysis)}</div>
              ) : (
                <p className="text-xs text-zinc-500">
                  Once you add charts and click{" "}
                  <span className="font-semibold">Analyze Charts</span>, the
                  trading story will appear here: HTF bias, liquidity sweeps,
                  possible entries, and a reusable checklist.
                </p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
