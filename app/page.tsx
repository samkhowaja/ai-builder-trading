"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";

// ───────────────────────────────
// Types
// ───────────────────────────────

type UploadImage = { name: string; dataUrl: string };
type ChartImage = { id: string; name: string; dataUrl: string };

type ChecklistItem = { text: string; satisfied: boolean };
type ChecklistState = { text: string; done: boolean };

type ScreenshotGuide = {
  title: string;
  description: string;
  timeframeHint?: string;
};

type LearningResourceQuery = {
  concept: string;
  query: string;
  platforms: string[];
};

type ChartAnalysis = {
  overview: string;
  htfBias: string;
  liquidityStory: string;
  entryPlan: string;
  riskManagement: string;
  redFlags: string;
  nextMove: string;
  qualityScore: number;
  qualityLabel: string; // "A+", "A", "B" etc
  qualityReason: string;
  checklist: ChecklistItem[];
  screenshotGuides: ScreenshotGuide[];
  learningQueries: LearningResourceQuery[];
  tradeOutcome?: "hit" | "miss" | "pending";
};

type AnalyzeResponse = {
  analysis?: ChartAnalysis;
  error?: string;
};

type ChartAnalysisEntry = {
  id: string;
  pair: string;
  timeframes: string[];
  notes: string;
  analysis: ChartAnalysis;
  candleEnds: Record<string, number>;
  checklistState: ChecklistState[];
  chartImages: ChartImage[];
  createdAt: string;
};

type ViewTab =
  | "dashboard"
  | "upload"
  | "analysis"
  | "predictions"
  | "history";

type ProgressStep = 0 | 1 | 2 | 3; // 0 = nothing, 1 upload, 2 analyzed, 3 planned

const TF_MINUTES: Record<string, number> = {
  M1: 1,
  M5: 5,
  M15: 15,
  M30: 30,
  H1: 60,
  H4: 240,
  D1: 1440,
};

const defaultPairs = ["EURUSD", "GBPUSD", "XAUUSD", "NAS100", "US30"];

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function computeCandleEnds(
  nowTs: number,
  timeframes: string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const tf of timeframes) {
    const mins = TF_MINUTES[tf];
    if (!mins) continue;
    const tfMs = mins * 60_000;
    out[tf] = Math.ceil(nowTs / tfMs) * tfMs;
  }
  return out;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "closed";
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function buildSearchUrl(platform: string, query: string): string {
  const q = encodeURIComponent(query);
  switch (platform) {
    case "YouTube":
      return `https://www.youtube.com/results?search_query=${q}`;
    case "TikTok":
      return `https://www.tiktok.com/search?q=${q}`;
    case "Instagram":
      return `https://www.instagram.com/explore/search/keyword/?q=${q}`;
    case "Images":
      return `https://www.google.com/search?tbm=isch&q=${q}`;
    default:
      return `https://www.google.com/search?q=${q}`;
  }
}

function qualityRank(label: string | undefined): number {
  if (!label) return 0;
  const v = label.toUpperCase();
  if (v.includes("A+")) return 3;
  if (v.startsWith("A")) return 2;
  if (v.startsWith("B")) return 1;
  return 0;
}

// ───────────────────────────────
// Clipboard paste zone
// ───────────────────────────────

function ClipboardPasteZone(props: { onImages?: (files: File[]) => void }) {
  const [previews, setPreviews] = useState<string[]>([]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData.items;
      const newFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const url = URL.createObjectURL(file);
            setPreviews((prev) => [...prev, url]);
            newFiles.push(file);
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
      className="flex min-h-[120px] flex-col rounded-xl border border-dashed border-zinc-700 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 outline-none focus:ring-2 focus:ring-emerald-500/60"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p>
          📸{" "}
          <span className="font-semibold text-zinc-100">
            Paste screenshots
          </span>{" "}
          (Ctrl+V / Cmd+V) while this box is focused.
        </p>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
          Click here then paste
        </span>
      </div>

      {previews.length === 0 ? (
        <p className="text-[11px] text-zinc-500">
          In TradingView copy a screenshot to clipboard, click this box,
          then press Ctrl+V or Cmd+V. The images stay attached until you
          remove them.
        </p>
      ) : (
        <div className="mt-1 grid max-h-28 grid-cols-3 gap-1 overflow-auto">
          {previews.map((src, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-md border border-zinc-800 bg-black"
            >
              <Image
                src={src}
                alt="pasted preview"
                width={200}
                height={120}
                unoptimized
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────
// Main page component
// ───────────────────────────────

export default function Page() {
  // Sidebar
  const [pairs, setPairs] = useState<string[]>([]);
  const [selectedPair, setSelectedPair] = useState<string | null>(null);

  // Tabs for right side
  const [view, setView] = useState<ViewTab>("dashboard");

  // Upload + analysis state
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>([
    "H4",
    "H1",
    "M15",
  ]);
  const [chartImages, setChartImages] = useState<ChartImage[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [analysis, setAnalysis] = useState<ChartAnalysis | null>(null);
  const [checklist, setChecklist] = useState<ChecklistState[]>([]);
  const [candleEnds, setCandleEnds] = useState<Record<string, number>>({});
  const [historyEntries, setHistoryEntries] = useState<ChartAnalysisEntry[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For timers
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load pairs from API
  useEffect(() => {
    const loadPairs = async () => {
      try {
        const res = await fetch("/api/pairs");
        if (!res.ok) throw new Error();
        const data: { pairs: string[] } = await res.json();
        setPairs(data.pairs.length ? data.pairs : defaultPairs);
      } catch {
        setPairs(defaultPairs);
      }
    };
    loadPairs();
  }, []);

  const savePairs = async (next: string[]) => {
    setPairs(next);
    try {
      await fetch("/api/pairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairs: next }),
      });
    } catch {
      // ignore
    }
  };

  // Load analysis history when pair changes
  useEffect(() => {
    const loadForPair = async () => {
      if (!selectedPair) {
        setAnalysis(null);
        setChecklist([]);
        setChartImages([]);
        setHistoryEntries([]);
        setCandleEnds({});
        setView("dashboard");
        return;
      }

      try {
        const res = await fetch(
          `/api/chart-analyses?pair=${encodeURIComponent(
            selectedPair,
          )}&history=1`,
        );
        if (!res.ok) throw new Error();
        const data:
          | { entries: ChartAnalysisEntry[] }
          | { entry: ChartAnalysisEntry | null } = await res.json();

        let latest: ChartAnalysisEntry | null = null;
        if ("entries" in data && Array.isArray(data.entries)) {
          setHistoryEntries(data.entries);
          latest = data.entries[0] ?? null;
        } else if ("entry" in data) {
          latest = data.entry;
          setHistoryEntries(latest ? [latest] : []);
        }

        if (!latest) {
          // no previous analysis
          setAnalysis(null);
          setChecklist([]);
          setChartImages([]);
          setCandleEnds({});
          setView("upload");
          return;
        }

        setAnalysis(latest.analysis);
        setCandleEnds(latest.candleEnds || {});
        setChartImages(latest.chartImages || []);
        setNotes(latest.notes || "");
        setSelectedTimeframes(
          latest.timeframes.length ? latest.timeframes : selectedTimeframes,
        );
        setChecklist(
          (latest.checklistState || []).map((c) => ({
            text: c.text,
            done: !!c.done,
          })),
        );
        setView("analysis");
      } catch {
        setAnalysis(null);
        setChecklist([]);
        setChartImages([]);
        setCandleEnds({});
        setHistoryEntries([]);
        setView("upload");
      }
    };

    loadForPair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPair]);

  // Derived: quality by pair (for Setup column)
  const pairQuality: Record<string, string> = {};
  historyEntries.forEach((e) => {
    if (!pairQuality[e.pair]) {
      pairQuality[e.pair] = e.analysis.qualityLabel || "";
    }
  });

  // Handle timeframes
  const allTimeframes = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];
  const toggleTf = (tf: string) => {
    setSelectedTimeframes((prev) =>
      prev.includes(tf) ? prev.filter((x) => x !== tf) : [...prev, tf],
    );
  };

  // Handle images
  const addFileAsImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setChartImages((prev) => [
        ...prev,
        { id: makeId(), name: file.name || "chart.png", dataUrl },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach(addFileAsImage);
  };

  const handlePasteImages = (files: File[]) => {
    files.forEach(addFileAsImage);
  };

  const clearImages = () => {
    setChartImages([]);
    setError(null);
  };

  // Analyze
  const saveSnapshot = async (
    analysisToSave: ChartAnalysis,
    checklistToSave: ChecklistState[],
    candleEndsToSave: Record<string, number>,
  ) => {
    if (!selectedPair) return;
    try {
      await fetch("/api/chart-analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair: selectedPair,
          timeframes: selectedTimeframes,
          notes,
          analysis: analysisToSave,
          candleEnds: candleEndsToSave,
          checklistState: checklistToSave,
          chartImages,
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleAnalyze = async () => {
    if (!selectedPair) {
      setError("Pick a pair first from the left.");
      return;
    }
    if (!chartImages.length) {
      setError("Upload or paste at least one chart screenshot.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const images: UploadImage[] = chartImages.map((img) => ({
        name: img.name,
        dataUrl: img.dataUrl,
      }));

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

      const data: AnalyzeResponse = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Failed to analyze charts.");
        return;
      }
      if (!data.analysis) {
        setError("Analysis came back empty.");
        return;
      }

      const now = Date.now();
      const ends = computeCandleEnds(now, selectedTimeframes);
      const checklistState: ChecklistState[] =
        data.analysis.checklist?.map((c) => ({
          text: c.text,
          done: !!c.satisfied,
        })) || [];

      setAnalysis(data.analysis);
      setChecklist(checklistState);
      setCandleEnds(ends);
      setView("analysis");

      await saveSnapshot(data.analysis, checklistState, ends);
    } catch (err) {
      console.error(err);
      setError("Something went wrong during analysis.");
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklistItem = (index: number) => {
    setChecklist((prev) => {
      const next = prev.map((c, i) =>
        i === index ? { ...c, done: !c.done } : c,
      );
      if (analysis) {
        saveSnapshot(analysis, next, candleEnds);
      }
      return next;
    });
  };

  // Progress step
  const progressStep: ProgressStep = (() => {
    if (!selectedPair) return 0;
    if (!chartImages.length) return 1;
    if (!analysis) return 2;
    return 3;
  })();

  const completedChecklist = checklist.filter((c) => c.done).length;
  const totalChecklist = checklist.length;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  // Sidebar row for each pair (TradingView-style)
  const renderPairRow = (pair: string) => {
    const active = pair === selectedPair;
    const label = historyEntries.find((e) => e.pair === pair)?.analysis
      ?.qualityLabel;

    return (
      <button
        key={pair}
        type="button"
        onClick={() => {
          setSelectedPair(pair);
          setView("upload");
          setError(null);
        }}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
          active
            ? "bg-emerald-500/10 text-emerald-200"
            : "bg-transparent text-zinc-200 hover:bg-zinc-900"
        }`}
      >
        <span className="font-medium">{pair}</span>
        <span className="text-[11px] text-zinc-400">
          {label ? label : "–"}
        </span>
      </button>
    );
  };

  // Helper to render text blocks from analysis
  const renderTextBlocks = (value?: string) =>
    (value || "")
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length)
      .map((p, i) => (
        <p key={i} className="mb-2 text-sm text-zinc-100">
          {p.trim()}
        </p>
      ));

  // ───────────────────────────────
  // JSX
  // ───────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100">
      {/* Top bar */}
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
                Multi timeframe chart analyzer and playbook builder
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
              Models / learning
            </a>
            <a
              href="/video-models"
              className="rounded-full px-3 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            >
              YouTube models
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-4 px-4 py-6">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-black px-3 py-4">
          {/* Dashboard row */}
          <button
            type="button"
            onClick={() => {
              setSelectedPair(null);
              setView("dashboard");
            }}
            className={`mb-4 flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm ${
              view === "dashboard" && !selectedPair
                ? "bg-emerald-500/10 text-emerald-200"
                : "bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                  📊
                </div>
                <span className="font-semibold">Dashboard</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                Weekly stats and A+ radar
              </p>
            </div>
          </button>

          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Pairs
          </div>
          <div className="space-y-1">
            {pairs.map(renderPairRow)}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 space-y-4">
          {/* Progress bar when a pair is selected */}
          {selectedPair && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Workflow
                  </p>
                  <p className="text-sm font-semibold text-zinc-100">
                    {selectedPair}
                  </p>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Step {progressStep || 1} of 3
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                {[
                  { id: 1, label: "Upload screenshots" },
                  { id: 2, label: "Run analysis" },
                  { id: 3, label: "Plan & predictions" },
                ].map((step, index) => {
                  const active = progressStep === (index + 1);
                  const done = (progressStep || 0) > index + 1;

                  return (
                    <div key={step.id} className="flex flex-1 items-center">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${
                          done
                            ? "bg-emerald-500 text-black"
                            : active
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-zinc-900 text-zinc-500"
                        }`}
                      >
                        {done ? "✓" : step.id}
                      </div>
                      <div className="ml-2 text-zinc-400">
                        {step.label}
                      </div>
                      {index < 2 && (
                        <div className="ml-2 h-px flex-1 bg-zinc-800" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabs under progress when pair selected */}
          {selectedPair && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setView("upload")}
                className={`rounded-full px-3 py-1 ${
                  view === "upload"
                    ? "bg-emerald-500 text-black"
                    : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                Upload
              </button>

              {analysis && (
                <>
                  <button
                    type="button"
                    onClick={() => setView("analysis")}
                    className={`rounded-full px-3 py-1 ${
                      view === "analysis"
                        ? "bg-emerald-500 text-black"
                        : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    }`}
                  >
                    Analysis
                  </button>

                  <button
                    type="button"
                    onClick={() => setView("predictions")}
                    className={`rounded-full px-3 py-1 ${
                      view === "predictions"
                        ? "bg-emerald-500 text-black"
                        : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    }`}
                  >
                    Predictions
                  </button>

                  <button
                    type="button"
                    onClick={() => setView("history")}
                    className={`rounded-full px-3 py-1 ${
                      view === "history"
                        ? "bg-emerald-500 text-black"
                        : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    }`}
                  >
                    History
                  </button>
                </>
              )}
            </div>
          )}

          {/* Views */}
          {(!selectedPair || view === "dashboard") && (
            <section className="space-y-4">
              {/* Simple dashboard cards */}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-xs font-semibold text-zinc-400">
                    Weekly performance
                  </p>
                  <p className="mt-2 text-2xl font-bold text-emerald-400">
                    {historyEntries.length}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Analyses stored for the currently selected pair.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-xs font-semibold text-zinc-400">
                    Latest quality
                  </p>
                  <p className="mt-2 text-2xl font-bold text-emerald-400">
                    {analysis?.qualityLabel || "–"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Updated at{" "}
                    {historyEntries[0]
                      ? fmtDate(historyEntries[0].createdAt)
                      : "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-xs font-semibold text-zinc-400">
                    Checklist progress
                  </p>
                  <p className="mt-2 text-2xl font-bold text-emerald-400">
                    {totalChecklist
                      ? `${completedChecklist}/${totalChecklist}`
                      : "—"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    When every item is green, you&apos;re ready to execute
                    (for learning only, not financial advice).
                  </p>
                </div>
              </div>
            </section>
          )}

          {selectedPair && view === "upload" && (
            <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              {/* Upload + TFs */}
              <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <h2 className="text-sm font-semibold text-zinc-100">
                  1. Timeframes & screenshots
                </h2>
                <p className="text-xs text-zinc-500">
                  Select the timeframes you captured, then upload or paste
                  the actual TradingView charts. Screenshots stay attached
                  to this pair until you clear them.
                </p>

                <div className="flex flex-wrap gap-1">
                  {allTimeframes.map((tf) => {
                    const active = selectedTimeframes.includes(tf);
                    return (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => toggleTf(tf)}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] ${
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

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-300">
                      Upload chart screenshots
                    </p>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1 file:text-xs file:font-medium file:text-black hover:file:bg-emerald-500"
                    />
                    <p className="text-[11px] text-zinc-500">
                      You can select multiple images at once (H4, H1, M15,
                      M5, etc).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-300">
                      Or paste screenshots from clipboard
                    </p>
                    <ClipboardPasteZone onImages={handlePasteImages} />
                  </div>
                </div>

                {chartImages.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-zinc-300">
                        Attached screenshots ({chartImages.length})
                      </p>
                      <button
                        type="button"
                        onClick={clearImages}
                        className="text-[11px] text-red-400 hover:text-red-300"
                      >
                        Remove all
                      </button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      {chartImages.map((img) => (
                        <div
                          key={img.id}
                          className="overflow-hidden rounded-lg border border-zinc-800 bg-black"
                        >
                          <Image
                            src={img.dataUrl}
                            alt={img.name}
                            width={320}
                            height={200}
                            unoptimized
                            className="h-32 w-full object-cover"
                          />
                          <p className="truncate px-2 py-1 text-[10px] text-zinc-400">
                            {img.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/0 px-3 py-2">
                  <div className="text-xs text-zinc-400">
                    {chartImages.length === 0
                      ? "No charts yet. Add screenshots to enable analysis."
                      : "Ready. Click analyze to generate a structured playbook for this pair."}
                  </div>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={loading || !chartImages.length}
                    className={`rounded-full px-4 py-1 text-xs font-semibold ${
                      loading || !chartImages.length
                        ? "bg-zinc-800 text-zinc-500"
                        : "bg-emerald-500 text-black hover:bg-emerald-400"
                    }`}
                  >
                    {loading ? "Analyzing…" : "Analyze charts"}
                  </button>
                </div>

                {error && (
                  <p className="text-xs text-red-400">⚠ {error}</p>
                )}
              </div>

              {/* Prompt box */}
              <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <h2 className="text-sm font-semibold text-zinc-100">
                  📝 What do you want to know?
                </h2>
                <p className="text-xs text-zinc-500">
                  Optional prompt to steer the analysis.
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={8}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/60 p-2 text-xs text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500/60"
                  placeholder={
                    "- Tell me the higher timeframe bias and why.\n" +
                    "- Is there liquidity being grabbed here?\n" +
                    "- Where is a high-probability entry with SL/TP idea?"
                  }
                />
                <p className="text-[10px] text-zinc-500">
                  The text above is sent along with your screenshots to the
                  AI analyzer.
                </p>
              </div>
            </section>
          )}

          {selectedPair && view === "analysis" && analysis && (
            <section className="space-y-4">
              {/* Top summary */}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-xs font-semibold text-zinc-400">
                    Quality score
                  </p>
                  <p className="mt-2 text-2xl font-bold text-emerald-400">
                    {analysis.qualityLabel}{" "}
                    <span className="text-sm text-zinc-400">
                      ({analysis.qualityScore.toFixed(0)})
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {analysis.qualityReason}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-xs font-semibold text-zinc-400">
                    Higher timeframe bias
                  </p>
                  <div className="mt-2 max-h-24 overflow-auto text-xs text-zinc-100">
                    {renderTextBlocks(analysis.htfBias)}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-xs font-semibold text-zinc-400">
                    Candle timers
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-zinc-200">
                    {selectedTimeframes.map((tf) => {
                      const end = candleEnds[tf];
                      if (!end) return null;
                      const remaining = end - nowTs;
                      return (
                        <div
                          key={tf}
                          className="flex items-center justify-between"
                        >
                          <span className="text-zinc-400">{tf}</span>
                          <span
                            className={
                              remaining > 0
                                ? "text-emerald-400"
                                : "text-zinc-500"
                            }
                          >
                            {formatRemaining(remaining)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    When a candle closes, take a fresh screenshot to
                    update the story.
                  </p>
                </div>
              </div>

              {/* Story + checklist */}
              <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <h3 className="text-sm font-semibold text-zinc-100">
                    Liquidity story & entry plan
                  </h3>

                  <div className="space-y-3 text-sm text-zinc-100">
                    <div>
                      <p className="mb-1 text-xs font-semibold text-zinc-400">
                        Overview
                      </p>
                      {renderTextBlocks(analysis.overview)}
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-zinc-400">
                        Liquidity & structure
                      </p>
                      {renderTextBlocks(analysis.liquidityStory)}
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-zinc-400">
                        Entry idea
                      </p>
                      {renderTextBlocks(analysis.entryPlan)}
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-zinc-400">
                        Risk management
                      </p>
                      {renderTextBlocks(analysis.riskManagement)}
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-zinc-400">
                        Red flags / avoid if…
                      </p>
                      {renderTextBlocks(analysis.redFlags)}
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-zinc-400">
                        Next-move scenario
                      </p>
                      {renderTextBlocks(analysis.nextMove)}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <h3 className="text-sm font-semibold text-zinc-100">
                    Checklist for this setup
                  </h3>
                  {checklist.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      No checklist items returned for this analysis.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {checklist.map((item, i) => (
                        <li key={i} className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => toggleChecklistItem(i)}
                            className={`mt-[2px] h-4 w-4 rounded border text-[10px] ${
                              item.done
                                ? "border-emerald-500 bg-emerald-500 text-black"
                                : "border-zinc-600 bg-black text-transparent"
                            }`}
                          >
                            ✓
                          </button>
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
                  )}
                  <p className="mt-2 text-[10px] text-zinc-500">
                    Green = satisfied. If anything stays unchecked, it&apos;s
                    a learning setup, not an A+ execution.
                  </p>
                </div>
              </div>

              {/* Screenshot shot list */}
              {analysis.screenshotGuides?.length > 0 && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                    Screenshot & image references
                  </h3>
                  <p className="mb-3 text-xs text-zinc-500">
                    Use this as a mini shot-list when replaying the chart
                    or pausing the YouTube video. You can recreate these as
                    slides or a study journal.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {analysis.screenshotGuides.map((g, i) => (
                      <div
                        key={i}
                        className="space-y-2 rounded-xl border border-zinc-800 bg-black/40 p-3"
                      >
                        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-950 text-[11px] text-zinc-500">
                          Image placeholder – capture this shot in
                          TradingView
                        </div>
                        <p className="text-xs font-semibold text-zinc-100">
                          {g.title}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {g.description}
                        </p>
                        {g.timeframeHint && (
                          <p className="text-[10px] text-zinc-500">
                            TF hint: {g.timeframeHint}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Learning resources */}
              {analysis.learningQueries?.length > 0 && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                    Extra learning clips & images
                  </h3>
                  <p className="mb-3 text-xs text-zinc-500">
                    These links search YouTube / TikTok / Instagram images
                    for similar concepts, so you can see more examples of
                    the same pattern.
                  </p>
                  <div className="space-y-2 text-xs">
                    {analysis.learningQueries.map((q, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-zinc-800 bg-black/40 p-2"
                      >
                        <p className="text-[11px] font-semibold text-zinc-200">
                          {q.concept}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {q.platforms.map((p) => (
                            <a
                              key={p}
                              href={buildSearchUrl(p, q.query)}
                              target="_blank"
                              className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                            >
                              {p}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {selectedPair && view === "predictions" && analysis && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Next possible move – study notes
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  This is a learning prediction, not trading advice. Use it
                  to see how price actually played out vs. the idea.
                </p>
                <div className="mt-3 text-sm text-zinc-100">
                  {renderTextBlocks(analysis.nextMove)}
                </div>
              </div>
            </section>
          )}

          {selectedPair && view === "history" && (
            <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="text-sm font-semibold text-zinc-100">
                History for {selectedPair}
              </h3>
              {historyEntries.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No stored analyses yet. Once you run analysis, each run
                  is saved here as a snapshot.
                </p>
              ) : (
                <div className="space-y-2 text-xs">
                  {historyEntries.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setAnalysis(e.analysis);
                        setCandleEnds(e.candleEnds || {});
                        setChartImages(e.chartImages || []);
                        setChecklist(
                          (e.checklistState || []).map((c) => ({
                            text: c.text,
                            done: !!c.done,
                          })),
                        );
                        setSelectedTimeframes(
                          e.timeframes.length
                            ? e.timeframes
                            : selectedTimeframes,
                        );
                        setView("analysis");
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 text-left hover:bg-zinc-900"
                    >
                      <div>
                        <p className="font-medium text-zinc-100">
                          {e.analysis.qualityLabel} setup
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {fmtDate(e.createdAt)} · TFs:{" "}
                          {e.timeframes.join(", ")}
                        </p>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        Score {e.analysis.qualityScore.toFixed(0)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
