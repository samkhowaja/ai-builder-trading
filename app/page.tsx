// app/page.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";

type UploadImage = {
  name: string;
  dataUrl: string;
};

type ClipboardImage = {
  file: File;
  previewUrl: string;
};

type ChecklistItem = {
  text: string;
  satisfied: boolean;
};

type ScreenshotGuide = {
  title: string;
  description: string;
  timeframeHint?: string;
};

type ChartAnalysis = {
  overview: string;
  htfBias: string;
  liquidityStory: string;
  entryPlan: string;
  riskManagement: string;
  redFlags: string;
  checklist: ChecklistItem[];
  screenshotGuides: ScreenshotGuide[];
};

type AnalyzeResponse = {
  analysis?: ChartAnalysis;
  error?: string;
};

type ChecklistItemState = {
  text: string;
  done: boolean;
};

type SavedAnalysis = {
  pair: string;
  timeframes: string[];
  notes: string;
  analysis: ChartAnalysis;
  candleEnds: Record<string, number>;
  createdAt: number;
};

const PAIRS_STORAGE_KEY = "ai-builder-pairs-v1";
const ANALYSIS_STORAGE_KEY = "ai-builder-chart-analysis-v1";

const defaultPairs = ["EURUSD", "GBPUSD", "XAUUSD", "NAS100", "US30"];
const allTimeframes = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];

const TF_MINUTES: Record<string, number> = {
  M1: 1,
  M5: 5,
  M15: 15,
  M30: 30,
  H1: 60,
  H4: 240,
  D1: 1440,
};

function computeCandleEndsForSelected(
  nowTs: number,
  timeframes: string[],
): Record<string, number> {
  const res: Record<string, number> = {};
  for (const tf of timeframes) {
    const mins = TF_MINUTES[tf];
    if (!mins) continue;
    const tfMs = mins * 60_000;
    const end = Math.ceil(nowTs / tfMs) * tfMs;
    res[tf] = end;
  }
  return res;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "closed";
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

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
          press Ctrl+V or Cmd+V. The images will be added to your analysis pool
          automatically.
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
  const [analysis, setAnalysis] = useState<ChartAnalysis | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItemState[]>([]);

  const [candleEnds, setCandleEnds] = useState<Record<string, number>>({});
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  // Tick "now" so timers update
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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

  // Load saved analysis whenever pair changes
  useEffect(() => {
    try {
      if (typeof window === "undefined" || !selectedPair) return;
      const raw = window.localStorage.getItem(ANALYSIS_STORAGE_KEY);
      if (!raw) {
        setAnalysis(null);
        setChecklist([]);
        setCandleEnds({});
        return;
      }
      const store = JSON.parse(raw) as Record<string, SavedAnalysis>;
      const saved = store[selectedPair];
      if (!saved) {
        setAnalysis(null);
        setChecklist([]);
        setCandleEnds({});
        return;
      }

      setAnalysis(saved.analysis);
      setNotes(saved.notes || "");
      if (saved.timeframes && saved.timeframes.length) {
        setSelectedTimeframes(saved.timeframes);
      }
      setCandleEnds(saved.candleEnds || {});
      setChecklist(
        (saved.analysis.checklist || []).map((item) => ({
          text: item.text,
          done: !!item.satisfied,
        })),
      );
    } catch (e) {
      console.error("Failed to load saved analysis", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPair]);

  // When a new analysis arrives, reset checklist if it is empty
  useEffect(() => {
    if (analysis?.checklist && checklist.length === 0) {
      setChecklist(
        analysis.checklist.map((item) => ({
          text: item.text,
          done: !!item.satisfied,
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

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
    setChecklist([]);
    setCandleEnds({});
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
    setChecklist([]);

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

      const data = (await res.json()) as AnalyzeResponse;

      if (!res.ok || data.error) {
        setError(data.error || "Failed to analyze charts.");
        return;
      }

      if (data.analysis) {
        const now = Date.now();
        const newCandleEnds = computeCandleEndsForSelected(
          now,
          selectedTimeframes,
        );
        setCandleEnds(newCandleEnds);
        setAnalysis(data.analysis);
        setChecklist(
          data.analysis.checklist.map((item) => ({
            text: item.text,
            done: !!item.satisfied,
          })),
        );

        // persist per pair
        try {
          if (typeof window !== "undefined") {
            const raw = window.localStorage.getItem(ANALYSIS_STORAGE_KEY);
            const store = raw
              ? (JSON.parse(raw) as Record<string, SavedAnalysis>)
              : {};
            store[selectedPair] = {
              pair: selectedPair,
              timeframes: selectedTimeframes,
              notes,
              analysis: data.analysis,
              candleEnds: newCandleEnds,
              createdAt: now,
            };
            window.localStorage.setItem(
              ANALYSIS_STORAGE_KEY,
              JSON.stringify(store),
            );
          }
        } catch (e) {
          console.error("Failed to save analysis", e);
        }
      } else {
        setError("Analysis response was empty.");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong while analyzing.");
    } finally {
      setLoading(false);
    }
  };

  const renderParagraphs = (text?: string) =>
    (text || "")
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 0)
      .map((p, idx) => (
        <p key={idx} className="mb-2 text-sm leading-relaxed text-zinc-100">
          {p.trim()}
        </p>
      ));

  const toggleChecklistItem = (index: number) => {
    setChecklist((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, done: !item.done } : item,
      ),
    );
  };

  const completedCount = checklist.filter((c) => c.done).length;
  const totalCount = checklist.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

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
                Multi-timeframe chart analyzer and playbook builder
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
              Models and learning
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
                  Add some pairs below, one per line.
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
                const endTs = candleEnds[tf];
                const remainingMs =
                  typeof endTs === "number" ? endTs - nowTs : null;
                const isClosed =
                  remainingMs !== null && Number.isFinite(remainingMs)
                    ? remainingMs <= 0
                    : false;

                return (
                  <div key={tf} className="relative">
                    <button
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
                    {isClosed && (
                      <div className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* candle timers summary */}
            <div className="mt-2 space-y-1 text-[11px] text-zinc-500">
              {selectedTimeframes.map((tf) => {
                const endTs = candleEnds[tf];
                if (!endTs) return null;
                const remaining = endTs - nowTs;
                const isClosed = remaining <= 0;
                return (
                  <div key={tf}>
                    {tf}:{" "}
                    {isClosed
                      ? "candle closed – update chart if you want fresh analysis"
                      : `about ${formatRemaining(
                          remaining,
                        )} left in the current candle (approximate)`}
                  </div>
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
                "- Is there liquidity being grabbed here.\n" +
                "- Where is a high probability entry with SL and TP idea."
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
                  {files.length
                    ? `${files.length} image(s) queued`
                    : "No charts yet"}
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

        {/* RIGHT COLUMN – Images and Analysis */}
        <main className="flex-1 space-y-4">
          {/* Step indicator */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
            <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-400">
              {["Capture charts", "Queue screenshots", "Read playbook"].map(
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
              together in one run so the AI can see the full story. The latest
              analysis for each pair is saved even after refresh.
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
                You can select multiple images at once such as H4, H1, M15 and
                M5.
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

          {/* Ebook-style analysis + checklist + screenshot guides */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-50">
                  3. Multi-timeframe playbook for{" "}
                  <span className="text-emerald-300">{selectedPair}</span>
                </h2>
                <p className="text-[11px] text-zinc-500">
                  Structured like a mini ebook: context, liquidity story, entry
                  plan, risk, red flags, checklist, and screenshot overlay
                  ideas.
                </p>
              </div>
              {analysis && (
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
                  Saved analysis
                </span>
              )}
            </div>

            <div className="max-h-[460px] overflow-auto rounded-md border border-zinc-800 bg-black/40 p-3">
              {analysis ? (
                <div className="space-y-4 text-sm">
                  {/* Overview */}
                  <div>
                    <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-zinc-300">
                      1. Overview – what the market is doing
                    </h3>
                    {renderParagraphs(analysis.overview)}
                  </div>

                  {/* HTF Bias */}
                  <div>
                    <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-zinc-300">
                      2. Higher timeframe bias and structure
                    </h3>
                    {renderParagraphs(analysis.htfBias)}
                  </div>

                  {/* Liquidity story */}
                  <div>
                    <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-zinc-300">
                      3. Liquidity story – where the money sits
                    </h3>
                    {renderParagraphs(analysis.liquidityStory)}
                  </div>

                  {/* Entry plan */}
                  <div>
                    <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-zinc-300">
                      4. Execution plan – how to enter
                    </h3>
                    {renderParagraphs(analysis.entryPlan)}
                  </div>

                  {/* Risk management */}
                  <div>
                    <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-zinc-300">
                      5. Risk management and trade handling
                    </h3>
                    {renderParagraphs(analysis.riskManagement)}
                  </div>

                  {/* Red flags */}
                  <div>
                    <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-red-300">
                      6. Red flags – when not to take this setup
                    </h3>
                    {renderParagraphs(analysis.redFlags)}
                  </div>

                  {/* Checklist */}
                  <div className="mt-3 rounded-lg border border-zinc-800 bg-black/60 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <h3 className="text-[13px] font-semibold text-zinc-100">
                          ✅ Entry checklist
                        </h3>
                        <p className="text-[11px] text-zinc-500">
                          The AI marks what already looks satisfied. You can
                          toggle items as you confirm things on your chart.
                        </p>
                      </div>
                      <div className="text-right text-[11px]">
                        <p className="font-semibold text-emerald-300">
                          {completedCount} / {totalCount} checked
                        </p>
                        <p className="text-zinc-500">Tap items to toggle</p>
                      </div>
                    </div>

                    {checklist.length ? (
                      <ul className="space-y-1 text-[13px] text-zinc-200">
                        {checklist.map((item, idx) => (
                          <li
                            key={idx}
                            className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-zinc-900/60"
                            onClick={() => toggleChecklistItem(idx)}
                          >
                            <div
                              className={`mt-[2px] flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
                                item.done
                                  ? "border-emerald-400 bg-emerald-500 text-black"
                                  : "border-zinc-500 bg-black text-transparent"
                              }`}
                            >
                              ✓
                            </div>
                            <span
                              className={
                                item.done
                                  ? "text-zinc-400 line-through"
                                  : "text-zinc-100"
                              }
                            >
                              {item.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-zinc-500">
                        No checklist items were generated for this run.
                      </p>
                    )}

                    {allDone && (
                      <p className="mt-3 rounded-md bg-emerald-500/10 px-2 py-2 text-[11px] text-emerald-300">
                        All checklist items are marked as satisfied. This does
                        not guarantee a winning trade, but it means the setup
                        matches the model you defined. Always follow your own
                        risk plan.
                      </p>
                    )}
                  </div>

                  {/* Screenshot overlay guides */}
                  <div className="mt-3 rounded-lg border border-zinc-800 bg-black/60 p-3">
                    <h3 className="mb-1 text-[13px] font-semibold text-zinc-100">
                      🖼 Screenshot overlay ideas
                    </h3>
                    <p className="mb-2 text-[11px] text-zinc-500">
                      Use these as drawing instructions on your screenshots:
                      boxes for order blocks, arrows for liquidity sweeps, and
                      labels for entry, stop and target.
                    </p>
                    {analysis.screenshotGuides &&
                    analysis.screenshotGuides.length ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        {analysis.screenshotGuides.map((g, idx) => (
                          <div
                            key={idx}
                            className="rounded-md border border-zinc-800 bg-zinc-950/80 p-2"
                          >
                            <div className="mb-1 flex items-center justify-between">
                              <p className="text-[12px] font-semibold text-zinc-100">
                                {g.title}
                              </p>
                              {g.timeframeHint && (
                                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">
                                  {g.timeframeHint}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-300">
                              {g.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-zinc-500">
                        No screenshot overlay ideas were generated for this run.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  Once you add charts and click{" "}
                  <span className="font-semibold">Analyze Charts</span>, you
                  will get a structured playbook here: higher timeframe bias,
                  liquidity story, entry plan, risk, red flags, checklist, and
                  screenshot overlay ideas. The latest analysis for each pair is
                  saved so it survives refresh.
                </p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
