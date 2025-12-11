"use client";

export const dynamic = "force-dynamic";

import React, {
  useEffect,
  useState,
  useCallback,
  ChangeEvent,
  ClipboardEvent,
} from "react";
import Image from "next/image";

// --------------------------------------------------
// Defaults
// --------------------------------------------------

const DEFAULT_PAIRS = ["EURUSD", "GBPUSD", "XAUUSD", "NAS100", "US30"];

type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1";

type ChecklistItem = {
  label: string;
  done: boolean;
};

type AnalysisSection = {
  title: string;
  body: string;
  checklist?: ChecklistItem[];
};

type PairAnalysisSnapshot = {
  id: string;
  pair: string;
  createdAt: string;
  quality: "A+" | "A" | "B" | "C";
  sections: AnalysisSection[];
};

type AttachedScreenshot = {
  id: string;
  file: File;
  previewUrl: string;
  timeframeHint?: Timeframe;
};

// --------------------------------------------------
// Helper
// --------------------------------------------------

const timeframes: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];

function formatDate(dt: string | Date) {
  const d = typeof dt === "string" ? new Date(dt) : dt;
  return d.toLocaleString();
}

// --------------------------------------------------
// Main Page Component
// --------------------------------------------------

export default function HomePage() {
  // workspace / navigation
  const [pairs, setPairs] = useState<string[]>(DEFAULT_PAIRS);
  const [selectedPair, setSelectedPair] = useState<string>(DEFAULT_PAIRS[0]);
  const [view, setView] = useState<"dashboard" | "pair">("dashboard");

  // timeframe + screenshots
  const [selectedTFs, setSelectedTFs] = useState<Timeframe[]>(["M15", "H1", "H4"]);
  const [screenshots, setScreenshots] = useState<AttachedScreenshot[]>([]);
  const [prompt, setPrompt] = useState(
    "- Tell me the higher timeframe bias and why.\n- Is there liquidity being grabbed here?\n- Where is a high-probability entry with SL/TP idea?"
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // analysis snapshots per pair
  const [snapshots, setSnapshots] = useState<PairAnalysisSnapshot[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<PairAnalysisSnapshot | null>(null);

  // --------------------------------------------------
  // Load pairs from API (but keep defaults if it fails)
  // --------------------------------------------------

  useEffect(() => {
    async function loadPairs() {
      try {
        const res = await fetch("/api/pairs", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();

        // support:
        //   ["EURUSD", "GBPUSD", ...] OR
        //   [{ symbol: "EURUSD", ...}, ...]
        const symbols: string[] = Array.isArray(data)
          ? data
              .map((item: any) =>
                typeof item === "string" ? item : item?.symbol
              )
              .filter((s: any) => typeof s === "string")
          : [];

        if (symbols.length > 0) {
          setPairs(symbols);
          setSelectedPair((prev) =>
            prev && symbols.includes(prev) ? prev : symbols[0]
          );
        } else {
          console.warn("[pairs] /api/pairs returned empty list, keeping defaults");
        }
      } catch (err) {
        console.warn("[pairs] Failed to load from /api/pairs, using defaults", err);
        // keep DEFAULT_PAIRS
      }
    }

    loadPairs();
  }, []);

  // ensure selectedPair is always valid
  useEffect(() => {
    if (!pairs.length) return;
    if (!selectedPair || !pairs.includes(selectedPair)) {
      setSelectedPair(pairs[0]);
    }
  }, [pairs, selectedPair]);

  // --------------------------------------------------
  // Screenshot handlers
  // --------------------------------------------------

  const handleTimeframeToggle = (tf: Timeframe) => {
    setSelectedTFs((prev) =>
      prev.includes(tf) ? prev.filter((t) => t !== tf) : [...prev, tf]
    );
  };

  const handleFilesChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newShots: AttachedScreenshot[] = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setScreenshots((prev) => [...prev, ...newShots]);
    setView("pair");
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (const item of items as any) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (!files.length) return;

    const newShots: AttachedScreenshot[] = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setScreenshots((prev) => [...prev, ...newShots]);
    setView("pair");
  };

  const handleRemoveScreenshot = (id: string) => {
    setScreenshots((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRemoveAllScreenshots = () => {
    setScreenshots([]);
  };

  // --------------------------------------------------
  // Analyze charts – calls your existing /api/analyze-charts
  // --------------------------------------------------

  const handleAnalyze = useCallback(async () => {
    if (!selectedPair) return;
    if (!screenshots.length) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const formData = new FormData();
      formData.append("pair", selectedPair);
      formData.append("prompt", prompt);
      formData.append("timeframes", JSON.stringify(selectedTFs));

      screenshots.forEach((shot, idx) => {
        formData.append(`image_${idx}`, shot.file, shot.file.name);
      });

      const res = await fetch("/api/analyze-charts", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      // Expecting something like:
      // { id, quality, sections: [{title, body, checklist: [...] }], createdAt }
      const snapshot: PairAnalysisSnapshot = {
        id: data.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        pair: selectedPair,
        createdAt: data.createdAt ?? new Date().toISOString(),
        quality: data.quality ?? "A",
        sections: data.sections ?? [],
      };

      setSnapshots((prev) => [snapshot, ...prev]);
      setCurrentAnalysis(snapshot);
      setView("pair");
    } catch (err: any) {
      console.error("analyze error", err);
      setAnalysisError(
        err?.message ?? "Failed to analyze charts. Please try again."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedPair, screenshots, prompt, selectedTFs]);

  // --------------------------------------------------
  // Rendering helpers
  // --------------------------------------------------

  const dashboardWeeklyCount = snapshots.filter(
    (s) => s.pair === selectedPair
  ).length;

  const latestSnapshotForSelected = snapshots.find(
    (s) => s.pair === selectedPair
  );

  const checklistProgress = currentAnalysis?.sections.flatMap(
    (sec) => sec.checklist || []
  );
  const checklistDone =
    checklistProgress?.filter((item) => item.done).length ?? 0;
  const checklistTotal = checklistProgress?.length ?? 0;
  const checklistPercent =
    checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-[#02040a] text-slate-100">
      {/* Top nav */}
      <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <span className="text-emerald-400 font-semibold text-sm">AI</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm">
              Trading Companion
            </span>
            <span className="text-xs text-slate-400">
              Multi timeframe chart analyzer and playbook builder
            </span>
          </div>
        </div>
        <nav className="flex items-center gap-2 text-xs">
          <button className="px-3 py-1 rounded-full bg-emerald-500 text-black font-medium">
            Analyzer
          </button>
          <button className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700">
            Models / learning
          </button>
          <button className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700">
            YouTube models
          </button>
        </nav>
      </header>

      {/* Main layout */}
      <main className="flex gap-4 px-6 py-4">
        {/* Sidebar: Dashboard + pairs */}
        <aside className="w-64 flex-shrink-0">
          <div className="rounded-3xl bg-[#020814] border border-emerald-800/40 shadow-lg shadow-emerald-900/20 p-3 mb-4">
            <button
              onClick={() => setView("dashboard")}
              className={`w-full flex items-center gap-3 rounded-2xl px-3 py-3 transition ${
                view === "dashboard"
                  ? "bg-emerald-500/15 border border-emerald-500/60"
                  : "bg-transparent border border-transparent hover:bg-slate-900/60"
              }`}
            >
              <div className="h-7 w-7 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <span className="text-emerald-400 text-lg">▢</span>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold">Dashboard</span>
                <span className="text-xs text-slate-400">
                  Weekly stats and A+ radar
                </span>
              </div>
            </button>

            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                Pairs
              </div>
              <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
                {pairs.map((pair) => (
                  <button
                    key={pair}
                    onClick={() => {
                      setSelectedPair(pair);
                      setView("pair");
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                      selectedPair === pair && view === "pair"
                        ? "bg-emerald-500/20 text-emerald-100 border border-emerald-500/50"
                        : "bg-slate-900/60 text-slate-200 border border-transparent hover:bg-slate-800"
                    }`}
                  >
                    <span className="font-medium">{pair}</span>
                    <span className="text-[10px] text-slate-400">
                      Watchlist
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <section className="flex-1 space-y-4">
          {/* Dashboard cards at top – always visible */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Weekly performance */}
            <div className="rounded-3xl bg-slate-950/70 border border-slate-800 px-4 py-3">
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Weekly performance
              </div>
              <div className="text-3xl font-semibold text-emerald-400 leading-none">
                {dashboardWeeklyCount}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Analyses stored for{" "}
                <span className="font-medium">{selectedPair}</span>.
              </div>
            </div>

            {/* Latest quality */}
            <div className="rounded-3xl bg-slate-950/70 border border-slate-800 px-4 py-3">
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Latest quality
              </div>
              {latestSnapshotForSelected ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-emerald-400">
                      {latestSnapshotForSelected.quality}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatDate(latestSnapshotForSelected.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Most recent snapshot for {selectedPair}.
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 mt-1">
                  No snapshots yet.
                </div>
              )}
            </div>

            {/* Checklist progress */}
            <div className="rounded-3xl bg-slate-950/70 border border-slate-800 px-4 py-3 col-span-1 lg:col-span-2">
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Checklist progress
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-1">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${checklistPercent}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400">
                {checklistTotal > 0 ? (
                  <>
                    {checklistDone}/{checklistTotal} items green. When every item
                    is green, you&apos;re ready to execute (for learning only,
                    not financial advice).
                  </>
                ) : (
                  <>
                    When every item is green, you&apos;re ready to execute (for
                    learning only, not financial advice).
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Main workspace depending on view */}
          {view === "dashboard" ? (
            <div className="rounded-3xl bg-slate-950/60 border border-slate-800 px-5 py-6 text-sm text-slate-300">
              <div className="font-semibold mb-2">How to use this dashboard</div>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-400">
                <li>Select a pair on the left to start an analysis.</li>
                <li>
                  Upload your multi-timeframe screenshots and ask the AI targeted
                  questions (liquidity, bias, entries, SL/TP).
                </li>
                <li>
                  Each analysis is stored as a snapshot so you can review how the
                  story evolved over time.
                </li>
              </ul>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Workflow steps */}
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full border border-emerald-500 flex items-center justify-center text-[11px] text-emerald-300">
                    1
                  </div>
                  <span className="font-medium text-slate-200">
                    Upload screenshots
                  </span>
                </div>
                <div className="h-px flex-1 bg-slate-800" />
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full border border-slate-600 flex items-center justify-center text-[11px] text-slate-300">
                    2
                  </div>
                  <span>Run analysis</span>
                </div>
              </div>

              {/* Timeframes + upload */}
              <div className="rounded-3xl bg-slate-950/70 border border-slate-800 px-5 py-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-sm">
                    {selectedPair} · Timeframes &amp; screenshots
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Select the structure you&apos;re studying, then upload or
                    paste the actual TradingView charts.
                  </div>
                </div>

                {/* Timeframe pills */}
                <div className="mb-4">
                  <div className="text-[11px] text-slate-400 mb-1">
                    Timeframe stack
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {timeframes.map((tf) => {
                      const active = selectedTFs.includes(tf);
                      return (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => handleTimeframeToggle(tf)}
                          className={`px-3 py-1 rounded-full text-[11px] border transition ${
                            active
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-100"
                              : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          {tf}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Upload / paste */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* File input */}
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-950/70 px-4 py-4">
                    <div className="text-xs font-semibold mb-2">
                      1. Upload chart screenshots
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFilesChosen}
                      className="text-xs text-slate-200"
                    />
                    <p className="mt-2 text-[11px] text-slate-500">
                      You can select multiple images at once (H4, H1, M15, M5,
                      etc). They stay attached to this pair until you remove
                      them.
                    </p>
                  </div>

                  {/* Paste from clipboard */}
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-950/70 px-4 py-4">
                    <div className="text-xs font-semibold mb-2">
                      2. Or paste screenshots from clipboard
                    </div>
                    <div
                      className="border border-dashed border-slate-700 rounded-xl bg-slate-950/80 px-3 py-6 text-center text-[11px] text-slate-400 cursor-text"
                      onPaste={handlePaste}
                      tabIndex={0}
                    >
                      <div className="mb-2 font-medium text-slate-200">
                        Paste screenshots (Ctrl+V / Cmd+V)
                      </div>
                      <div>
                        In TradingView, copy a screenshot to clipboard, click
                        this box, then press Ctrl+V or Cmd+V. They will be
                        attached to <span className="font-semibold">{selectedPair}</span>{" "}
                        on the server.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attached screenshots */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-slate-200">
                      Attached screenshots ({screenshots.length})
                    </div>
                    {screenshots.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRemoveAllScreenshots}
                        className="text-[11px] text-rose-400 hover:text-rose-300"
                      >
                        Remove all
                      </button>
                    )}
                  </div>
                  {screenshots.length === 0 ? (
                    <div className="text-[11px] text-slate-500">
                      No screenshots yet. Upload or paste charts to get started.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {screenshots.map((shot) => (
                        <div
                          key={shot.id}
                          className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950/80"
                        >
                          <div className="relative h-32 bg-black">
                            <Image
                              src={shot.previewUrl}
                              alt="screenshot"
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex items-center justify-between px-3 py-2 text-[11px] text-slate-300">
                            <span className="truncate">
                              {shot.file.name || "image"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveScreenshot(shot.id)}
                              className="text-rose-400 hover:text-rose-300"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prompt + analyze */}
                <div className="mt-4 flex flex-col md:flex-row gap-4 items-stretch">
                  <div className="flex-1">
                    <div className="text-xs font-semibold mb-1">
                      📝 What do you want to know?
                    </div>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={5}
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-700 text-xs px-3 py-2 outline-none focus:border-emerald-500 resize-none"
                    />
                    <div className="mt-1 text-[11px] text-slate-500">
                      Ask specific questions about bias, liquidity, entries,
                      invalid FVGS, inducement, SL/TP, etc.
                    </div>
                  </div>

                  <div className="w-full md:w-48 flex flex-col justify-end gap-2">
                    <button
                      type="button"
                      disabled={isAnalyzing || screenshots.length === 0}
                      onClick={handleAnalyze}
                      className={`w-full rounded-full px-4 py-3 text-sm font-semibold transition ${
                        isAnalyzing || screenshots.length === 0
                          ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                          : "bg-emerald-500 text-black hover:bg-emerald-400"
                      }`}
                    >
                      {isAnalyzing ? "Analyzing..." : "Analyze charts"}
                    </button>
                    <div className="text-[11px] text-slate-500">
                      Ready. Click analyze to generate a structured playbook for{" "}
                      <span className="font-semibold">{selectedPair}</span>.
                    </div>
                    {analysisError && (
                      <div className="text-[11px] text-rose-400">
                        {analysisError}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Analysis ebook */}
              {currentAnalysis && (
                <div className="rounded-3xl bg-slate-950/70 border border-slate-800 px-5 py-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-300">
                        Multi timeframe playbook for {currentAnalysis.pair}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {formatDate(currentAnalysis.createdAt)} ·{" "}
                        <span className="font-semibold">
                          Quality: {currentAnalysis.quality}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 text-sm text-slate-200">
                    {currentAnalysis.sections.map((section, idx) => (
                      <div key={idx} className="border-t border-slate-800 pt-4">
                        <div className="font-semibold text-slate-100 mb-1">
                          {idx + 1}. {section.title}
                        </div>
                        <div className="text-[13px] text-slate-300 whitespace-pre-line">
                          {section.body}
                        </div>
                        {section.checklist && section.checklist.length > 0 && (
                          <ul className="mt-2 text-[12px] space-y-1">
                            {section.checklist.map((item, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-2 text-slate-300"
                              >
                                <span
                                  className={`h-3 w-3 rounded-full border flex items-center justify-center text-[9px] ${
                                    item.done
                                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                                      : "border-slate-600 text-slate-500"
                                  }`}
                                >
                                  {item.done ? "✓" : ""}
                                </span>
                                <span>{item.label}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
