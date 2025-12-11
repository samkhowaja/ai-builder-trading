"use client";

import React, { useCallback, useEffect, useState } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type UploadImage = { name: string; dataUrl: string };
type ClipboardImage = { id: string; previewUrl: string };

type ChecklistItem = { text: string; satisfied: boolean };

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
  qualityLabel: string;
  qualityReason: string;
  checklist: ChecklistItem[];
  screenshotGuides: ScreenshotGuide[];
  learningQueries: LearningResourceQuery[];
};

type AnalyzeResponse = {
  analysis?: ChartAnalysis;
  error?: string;
};

type ChecklistItemState = { text: string; done: boolean };

type ChartImage = { id: string; name: string; dataUrl: string };

type ChartAnalysisEntry = {
  id: string;
  pair: string;
  timeframes: string[];
  notes: string;
  analysis: ChartAnalysis;
  candleEnds: Record<string, number>;
  checklistState: ChecklistItemState[];
  chartImages: ChartImage[];
  createdAt: string;
};

type SetupSummary = {
  pair: string;
  qualityScore: number;
  qualityLabel: string;
  biasSnippet: string;
  nextMoveSnippet: string;
  updatedAt: number;
};

type PairPanelTab = "upload" | "analysis" | "predictions" | "history";

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

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
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

// ─────────────────────────────────────────────
// Clipboard paste zone
// ─────────────────────────────────────────────

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
            setImages((prev) => [
              ...prev,
              { id: makeId(), previewUrl },
            ]);
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

      {images.length === 0 ? (
        <p className="text-[11px] text-zinc-500">
          In TradingView, copy a screenshot to clipboard, click this box,
          then press Ctrl+V or Cmd+V. They will be attached to the
          current pair on the server.
        </p>
      ) : (
        <div className="mt-1 grid max-h-28 grid-cols-3 gap-1 overflow-auto">
          {images.map((img) => (
            <div
              key={img.id}
              className="overflow-hidden rounded-md border border-zinc-800 bg-black"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt="pasted preview"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function HomePage() {
  // Pairs / watchlist
  const [pairs, setPairs] = useState<string[]>([]);
  const [selectedPair, setSelectedPair] = useState<string>("");
  const [newPairInput, setNewPairInput] = useState("");
  const [isAddingPair, setIsAddingPair] = useState(false);

  // Left / right selection
  const [activeTab, setActiveTab] = useState<PairPanelTab>("upload");

  // Timeframes
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>([
    "H4",
    "H1",
    "M15",
  ]);

  // Charts & notes
  const [chartImages, setChartImages] = useState<ChartImage[]>([]);
  const [notes, setNotes] = useState("");

  // Analysis state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ChartAnalysis | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItemState[]>([]);
  const [candleEnds, setCandleEnds] = useState<Record<string, number>>({});
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  // Radar & history
  const [setupRadar, setSetupRadar] = useState<SetupSummary[]>([]);
  const [historyEntries, setHistoryEntries] = useState<ChartAnalysisEntry[]>(
    [],
  );

  // Tick the clock for candle timers
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load pairs from server
  useEffect(() => {
    const loadPairs = async () => {
      try {
        const res = await fetch("/api/pairs");
        if (!res.ok) throw new Error("Failed to load pairs");
        const data: { pairs: string[] } = await res.json();
        const fromServer =
          data.pairs && data.pairs.length ? data.pairs : defaultPairs;
        setPairs(fromServer);
        if (!selectedPair && fromServer.length) {
          setSelectedPair(fromServer[0]);
        }
      } catch {
        setPairs(defaultPairs);
        if (!selectedPair) setSelectedPair(defaultPairs[0]);
      }
    };
    loadPairs();
  }, [selectedPair]);

  const savePairsToServer = async (symbols: string[]) => {
    try {
      await fetch("/api/pairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairs: symbols }),
      });
    } catch (e) {
      console.error("savePairs error", e);
    }
  };

  const updatePairs = (next: string[]) => {
    setPairs(next);
    if (next.length && !next.includes(selectedPair)) {
      setSelectedPair(next[0]);
      setActiveTab("upload");
    }
    savePairsToServer(next);
  };

  const handleAddPair = () => {
    const raw = newPairInput.trim().toUpperCase();
    if (!raw) return;
    if (pairs.includes(raw)) {
      setNewPairInput("");
      setIsAddingPair(false);
      return;
    }
    const next = [...pairs, raw];
    setNewPairInput("");
    setIsAddingPair(false);
    updatePairs(next);
  };

  const handleRemovePair = (symbol: string) => {
    const next = pairs.filter((p) => p !== symbol);
    updatePairs(next);
  };

  // Radar (cross-pair priority)
  const refreshSetupRadarFromServer = async () => {
    try {
      const res = await fetch("/api/chart-analyses");
      if (!res.ok) return;
      const data: {
        entries: { pair: string; analysis: ChartAnalysis; createdAt: string }[];
      } = await res.json();

      if (!data.entries || !data.entries.length) {
        setSetupRadar([]);
        return;
      }

      const list: SetupSummary[] = data.entries.map((sa) => {
        const a = sa.analysis;
        const qs =
          typeof a.qualityScore === "number" ? a.qualityScore : 0;
        const label = a.qualityLabel || "N/A";
        const bias = (a.htfBias || "").slice(0, 160);
        const nm = (a.nextMove || "").slice(0, 160);
        return {
          pair: sa.pair,
          qualityScore: qs,
          qualityLabel: label,
          biasSnippet: bias,
          nextMoveSnippet: nm,
          updatedAt: Date.parse(sa.createdAt),
        };
      });

      // Sort by quality score (higher first)
      list.sort((a, b) => b.qualityScore - a.qualityScore);
      setSetupRadar(list);
    } catch (e) {
      console.error("radar load error", e);
      setSetupRadar([]);
    }
  };

  useEffect(() => {
    refreshSetupRadarFromServer();
  }, []);

  // Helper: map radar by pair
  const radarByPair = new Map<string, SetupSummary>();
  setupRadar.forEach((s) => radarByPair.set(s.pair, s));

  // Load history & latest analysis for selected pair
  const loadHistoryEntryIntoView = (entry: ChartAnalysisEntry) => {
    setAnalysis(entry.analysis);
    setNotes(entry.notes || "");
    setSelectedTimeframes(
      entry.timeframes && entry.timeframes.length
        ? entry.timeframes
        : ["H4", "H1", "M15"],
    );
    setCandleEnds(entry.candleEnds || {});
    setChartImages(entry.chartImages || []);
    if (entry.checklistState && entry.checklistState.length) {
      setChecklist(entry.checklistState);
    } else {
      const fromAnalysis =
        entry.analysis.checklist?.map((item) => ({
          text: item.text,
          done: !!item.satisfied,
        })) || [];
      setChecklist(fromAnalysis);
    }
  };

  useEffect(() => {
    const loadPairAnalysis = async () => {
      if (!selectedPair) {
        setAnalysis(null);
        setChecklist([]);
        setChartImages([]);
        setCandleEnds({});
        setHistoryEntries([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/chart-analyses?pair=${encodeURIComponent(
            selectedPair,
          )}&history=1`,
        );
        if (!res.ok) throw new Error("Failed to load analysis");
        const data:
          | { entries: ChartAnalysisEntry[] }
          | { entry: ChartAnalysisEntry | null } = await res.json();

        if ("entries" in data && Array.isArray(data.entries)) {
          const entries = data.entries;
          setHistoryEntries(entries);
          if (!entries.length) {
            setAnalysis(null);
            setChecklist([]);
            setChartImages([]);
            setCandleEnds({});
            return;
          }
          loadHistoryEntryIntoView(entries[0]);
        } else if ("entry" in data) {
          const entry = (data as { entry: ChartAnalysisEntry | null })
            .entry;
          if (!entry) {
            setAnalysis(null);
            setChecklist([]);
            setChartImages([]);
            setCandleEnds({});
            setHistoryEntries([]);
            return;
          }
          setHistoryEntries([entry]);
          loadHistoryEntryIntoView(entry);
        } else {
          setAnalysis(null);
          setChecklist([]);
          setChartImages([]);
          setCandleEnds({});
          setHistoryEntries([]);
        }
      } catch (e) {
        console.error("loadPairAnalysis error", e);
        setAnalysis(null);
        setChecklist([]);
        setChartImages([]);
        setCandleEnds({});
        setHistoryEntries([]);
      }
    };
    loadPairAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPair]);

  // Timeframes
  const toggleTimeframe = (tf: string) => {
    setSelectedTimeframes((prev) =>
      prev.includes(tf) ? prev.filter((t) => t !== tf) : [...prev, tf],
    );
  };

  // Images
  const addFileAsChartImage = (file: File) => {
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

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = Array.from(e.target.files);
    fileList.forEach(addFileAsChartImage);
  };

  const handlePasteImages = (newFiles: File[]) => {
    newFiles.forEach(addFileAsChartImage);
  };

  const handleClearImages = () => {
    setChartImages([]);
    setError(null);
  };

  // Save snapshot
  const saveCurrentStateToServer = async (
    analysisToSave: ChartAnalysis,
    checklistStateToSave: ChecklistItemState[],
    candleEndsToSave: Record<string, number>,
  ) => {
    try {
      if (!selectedPair) return;
      await fetch("/api/chart-analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair: selectedPair,
          timeframes: selectedTimeframes,
          notes,
          analysis: analysisToSave,
          candleEnds: candleEndsToSave,
          checklistState: checklistStateToSave,
          chartImages,
        }),
      });
      await refreshSetupRadarFromServer();
      const res = await fetch(
        `/api/chart-analyses?pair=${encodeURIComponent(
          selectedPair,
        )}&history=1`,
      );
      if (res.ok) {
        const data:
          | { entries: ChartAnalysisEntry[] }
          | { entry: ChartAnalysisEntry | null } = await res.json();
        if ("entries" in data && Array.isArray(data.entries)) {
          setHistoryEntries(data.entries);
        }
      }
    } catch (e) {
      console.error("saveCurrentStateToServer error", e);
    }
  };

  // Analyze charts
  const handleAnalyze = async () => {
    if (!chartImages.length) {
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

        const newChecklist: ChecklistItemState[] =
          data.analysis.checklist.map((item) => ({
            text: item.text,
            done: !!item.satisfied,
          }));

        setAnalysis(data.analysis);
        setChecklist(newChecklist);

        await saveCurrentStateToServer(
          data.analysis,
          newChecklist,
          newCandleEnds,
        );
        setActiveTab("analysis");
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

  // Text helpers
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
    setChecklist((prev) => {
      const next = prev.map((item, idx) =>
        idx === index ? { ...item, done: !item.done } : item,
      );
      if (analysis) {
        saveCurrentStateToServer(analysis, next, candleEnds);
      }
      return next;
    });
  };

  const completedCount = checklist.filter((c) => c.done).length;
  const totalCount = checklist.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      hour12: false,
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  // Watchlist grouping: analyzed vs normal
  const analyzedPairs = setupRadar.map((s) => s.pair);
  const normalPairs = pairs.filter((p) => !analyzedPairs.includes(p));

  // Order analyzed by quality (already sorted by score, but group A+ > A > B > rest)
  const qualityRank = (label: string) => {
    const l = label.toUpperCase();
    if (l.includes("A+")) return 3;
    if (l.startsWith("A")) return 2;
    if (l.startsWith("B")) return 1;
    return 0;
  };

  const sortedAnalyzed = [...setupRadar].sort((a, b) => {
    const ra = qualityRank(a.qualityLabel);
    const rb = qualityRank(b.qualityLabel);
    if (ra !== rb) return rb - ra;
    return b.qualityScore - a.qualityScore;
  });

  // ─────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────

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
        {/* Sidebar watchlist */}
        <aside className="w-72 flex-shrink-0 space-y-4">
          {/* Trading workspace / watchlist */}
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 px-3 py-3 text-xs shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-lg">
                  ⇄
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-50">
                    Trading workspace
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    Pairs grouped by analyzed quality, similar to a
                    watchlist.
                  </p>
                </div>
              </div>
              <div className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] text-zinc-400">
                Shared
              </div>
            </div>

            {/* Analyzed section */}
            <div className="mb-2 mt-1">
              <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                <span>Analyzed setups</span>
                <span>{sortedAnalyzed.length}</span>
              </div>
              {sortedAnalyzed.length ? (
                <div className="space-y-1.5">
                  {sortedAnalyzed.map((s) => {
                    const isSelected = s.pair === selectedPair;
                    return (
                      <div
                        key={s.pair}
                        className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-2 py-1"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPair(s.pair);
                            setActiveTab("analysis");
                          }}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                                isSelected
                                  ? "bg-emerald-500 text-black"
                                  : "bg-zinc-900 text-zinc-100"
                              }`}
                            >
                              {s.pair}
                            </span>
                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              {s.qualityLabel}{" "}
                              {s.qualityScore
                                ? `(${s.qualityScore.toFixed(0)})`
                                : ""}
                            </span>
                          </div>
                          <span className="text-[12px] text-zinc-500">
                            {isSelected ? "▾" : "▸"}
                          </span>
                        </button>
                        {isSelected && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => setActiveTab("upload")}
                              className={`rounded-full px-2 py-0.5 text-[11px] ${
                                activeTab === "upload"
                                  ? "bg-emerald-500 text-black"
                                  : "bg-zinc-900 text-zinc-200"
                              }`}
                            >
                              Upload
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveTab("analysis")}
                              className={`rounded-full px-2 py-0.5 text-[11px] ${
                                activeTab === "analysis"
                                  ? "bg-emerald-500 text-black"
                                  : "bg-zinc-900 text-zinc-200"
                              }`}
                            >
                              Analysis
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveTab("predictions")
                              }
                              className={`rounded-full px-2 py-0.5 text-[11px] ${
                                activeTab === "predictions"
                                  ? "bg-emerald-500 text-black"
                                  : "bg-zinc-900 text-zinc-200"
                              }`}
                            >
                              Predictions
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveTab("history")}
                              className={`rounded-full px-2 py-0.5 text-[11px] ${
                                activeTab === "history"
                                  ? "bg-emerald-500 text-black"
                                  : "bg-zinc-900 text-zinc-200"
                              }`}
                            >
                              History
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg bg-zinc-950/80 px-2 py-2 text-[11px] text-zinc-500">
                  Once you run analysis for a pair, it appears here with
                  quality grade (A+, A, B).
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="my-2 border-t border-zinc-800" />

            {/* Normal watchlist */}
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                <span>Watchlist pairs</span>
                <span>{normalPairs.length}</span>
              </div>
              <div className="space-y-1.5">
                {normalPairs.map((p) => {
                  const isSelected = p === selectedPair;
                  return (
                    <div
                      key={p}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-2 py-1"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPair(p);
                          setActiveTab("upload");
                        }}
                        className="flex w-full items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                              isSelected
                                ? "bg-emerald-500 text-black"
                                : "bg-zinc-900 text-zinc-100"
                            }`}
                          >
                            {p}
                          </span>
                        </div>
                        <span className="text-[12px] text-zinc-500">
                          {isSelected ? "▾" : "▸"}
                        </span>
                      </button>
                      {isSelected && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => setActiveTab("upload")}
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              activeTab === "upload"
                                ? "bg-emerald-500 text-black"
                                : "bg-zinc-900 text-zinc-200"
                            }`}
                          >
                            Upload
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab("analysis")}
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              activeTab === "analysis"
                                ? "bg-emerald-500 text-black"
                                : "bg-zinc-900 text-zinc-200"
                            }`}
                          >
                            Analysis
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab("predictions")}
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              activeTab === "predictions"
                                ? "bg-emerald-500 text-black"
                                : "bg-zinc-900 text-zinc-200"
                            }`}
                          >
                            Predictions
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab("history")}
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              activeTab === "history"
                                ? "bg-emerald-500 text-black"
                                : "bg-zinc-900 text-zinc-200"
                            }`}
                          >
                            History
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add pair pill */}
                {isAddingPair ? (
                  <div className="inline-flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/80 px-2 py-1">
                    <input
                      autoFocus
                      className="w-24 bg-transparent text-[12px] uppercase text-zinc-100 outline-none"
                      value={newPairInput}
                      onChange={(e) =>
                        setNewPairInput(e.target.value.toUpperCase())
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddPair();
                        if (e.key === "Escape") {
                          setIsAddingPair(false);
                          setNewPairInput("");
                        }
                      }}
                      placeholder="EURUSD"
                    />
                    <button
                      type="button"
                      onClick={handleAddPair}
                      className="text-[11px] text-emerald-400"
                      title="Add pair"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingPair(true)}
                    className="inline-flex w-full items-center justify-between rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-2 py-1 text-[12px] text-zinc-300 hover:border-emerald-500 hover:text-emerald-300"
                  >
                    <span>+ Add pair</span>
                    <span className="text-[14px]">+</span>
                  </button>
                )}

                {!pairs.length && !isAddingPair && (
                  <p className="text-[11px] text-zinc-500">
                    No pairs yet. Add a symbol like EURUSD, XAUUSD, or NAS100.
                  </p>
                )}
              </div>
            </div>
          </section>
        </aside>

        {/* Main panel */}
        <main className="flex-1 space-y-4">
          {/* Small breadcrumb / header */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 text-xs shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="rounded-full bg-zinc-900 px-2 py-0.5">
                  Pair:{" "}
                  <span className="font-semibold text-zinc-100">
                    {selectedPair || "none"}
                  </span>
                </span>
                <span className="rounded-full bg-zinc-900 px-2 py-0.5">
                  Mode:{" "}
                  <span className="font-semibold text-zinc-100">
                    {activeTab}
                  </span>
                </span>
                {selectedTimeframes.length > 0 && (
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5">
                    TFs: {selectedTimeframes.join(", ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                <span>Right side updates based on Upload / Analysis / Predictions / History.</span>
              </div>
            </div>
          </section>

          {/* UPLOAD TAB */}
          {activeTab === "upload" && (
            <section className="space-y-4">
              {/* Timeframes + screenshots */}
              <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-50">
                      Timeframes and chart screenshots
                    </h2>
                    <p className="text-[11px] text-zinc-500">
                      Select the structure you are studying, then upload or
                      paste actual TradingView charts. Screenshots stay
                      attached to this pair until you remove them.
                    </p>
                  </div>
                </div>

                {/* Timeframe chips */}
                <div className="mt-3">
                  <p className="mb-1 text-[11px] font-semibold text-zinc-400">
                    Timeframe stack
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {allTimeframes.map((tf) => {
                      const active = selectedTimeframes.includes(tf);
                      const endTs = candleEnds[tf];
                      const remainingMs =
                        typeof endTs === "number" ? endTs - nowTs : null;
                      const isClosed =
                        remainingMs !== null &&
                        Number.isFinite(remainingMs) &&
                        remainingMs <= 0;
                      return (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => toggleTimeframe(tf)}
                          className={`relative rounded-full px-3 py-1 text-[11px] ${
                            active
                              ? "bg-emerald-500 text-black"
                              : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                          }`}
                        >
                          {tf}
                          {isClosed && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Candle timers */}
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
                            ? "candle closed – upload a fresh chart if you want updated analysis"
                            : `about ${formatRemaining(
                                remaining,
                              )} left in this candle (approximate)`}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Upload + paste */}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-zinc-400">
                      Upload chart screenshots
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFilesChange}
                      className="text-xs"
                    />
                    <p className="text-[11px] text-zinc-500">
                      Select multiple images at once (H4, H1, M15, M5). They
                      stay attached to this pair until you clear them.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-zinc-400">
                      Or paste screenshots from clipboard
                    </p>
                    <ClipboardPasteZone onImages={handlePasteImages} />
                  </div>
                </div>

                {/* Preview of stored screenshots */}
                {chartImages.length > 0 && (
                  <div className="mt-3 rounded-lg border border-zinc-800 bg-black/50 p-3 text-[11px] text-zinc-300">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="font-semibold">
                        Screenshots stored for {selectedPair || "—"} (
                        {chartImages.length})
                      </p>
                      <button
                        type="button"
                        onClick={handleClearImages}
                        className="text-[11px] text-red-400 hover:text-red-300"
                      >
                        Remove screenshots
                      </button>
                    </div>
                    <div className="mt-1 grid max-h-32 grid-cols-3 gap-2 overflow-auto">
                      {chartImages.map((img) => (
                        <div
                          key={img.id}
                          className="overflow-hidden rounded-md border border-zinc-800 bg-black"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.dataUrl}
                            alt={img.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Notes + Analyze */}
              <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-50">
                      What do you want the AI to focus on
                    </h2>
                    <p className="text-[11px] text-zinc-500">
                      Optional prompt to steer the analysis for this pair.
                    </p>
                  </div>
                </div>
                <textarea
                  className="mb-3 h-28 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-[11px] text-zinc-100 outline-none focus:border-emerald-500"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    "Example:\n- Tell me the higher timeframe bias and why.\n- Is there liquidity being grabbed here?\n- Where is a high probability entry with SL/TP idea?"
                  }
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-zinc-500">
                    {chartImages.length
                      ? `${chartImages.length} chart image(s) ready for analysis.`
                      : "No charts yet. Upload or paste screenshots first."}
                  </div>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700"
                  >
                    {loading ? "Analyzing…" : "Analyze charts"}
                  </button>
                </div>
                {error && (
                  <p className="mt-1 text-[11px] font-medium text-red-400">
                    {error}
                  </p>
                )}
              </section>
            </section>
          )}

          {/* ANALYSIS TAB */}
          {activeTab === "analysis" && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-50">
                    Multi timeframe playbook for{" "}
                    <span className="text-emerald-300">
                      {selectedPair || "—"}
                    </span>
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    Structured like a mini ebook: context, liquidity story,
                    entry plan, risk, red flags, next move, checklist, and
                    practice links.
                  </p>
                </div>
                {analysis && (
                  <div className="flex flex-col items-end gap-1 text-right">
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
                      Saved in database
                    </span>
                    <span className="text-[11px] text-amber-300">
                      Quality: {analysis.qualityLabel || "N/A"}{" "}
                      {typeof analysis.qualityScore === "number"
                        ? `(${analysis.qualityScore.toFixed(0)}/100)`
                        : ""}
                    </span>
                  </div>
                )}
              </div>

              <div className="max-h-[540px] overflow-auto rounded-md border border-zinc-800 bg-black/40 p-3">
                {analysis ? (
                  <div className="space-y-4 text-sm">
                    <div>
                      <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-zinc-300">
                        1. Overview – what the market is doing
                      </h3>
                      {renderParagraphs(analysis.overview)}
                    </div>
                    <div>
                      <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-zinc-300">
                        2. Higher timeframe bias and structure
                      </h3>
                      {renderParagraphs(analysis.htfBias)}
                    </div>
                    <div>
                      <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-zinc-300">
                        3. Liquidity story – where participants are trapped
                      </h3>
                      {renderParagraphs(analysis.liquidityStory)}
                    </div>
                    <div>
                      <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-zinc-300">
                        4. Execution plan – how to enter
                      </h3>
                      {renderParagraphs(analysis.entryPlan)}
                    </div>
                    <div>
                      <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-zinc-300">
                        5. Risk management and trade handling
                      </h3>
                      {renderParagraphs(analysis.riskManagement)}
                    </div>
                    <div>
                      <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-red-300">
                        6. Red flags – when to stay out
                      </h3>
                      {renderParagraphs(analysis.redFlags)}
                    </div>
                    <div>
                      <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-emerald-300">
                        7. Scenario for the next possible move
                      </h3>
                      <p className="mb-1 text-[11px] text-zinc-500">
                        Educational if–then scenarios only. Not financial
                        advice.
                      </p>
                      {renderParagraphs(analysis.nextMove)}
                      {analysis.qualityReason && (
                        <p className="mt-1 text-[11px] text-amber-300">
                          Quality reason: {analysis.qualityReason}
                        </p>
                      )}
                    </div>

                    {/* Checklist */}
                    <div className="mt-3 rounded-lg border border-zinc-800 bg-black/60 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <h3 className="text-[13px] font-semibold text-zinc-100">
                            Entry checklist
                          </h3>
                          <p className="text-[11px] text-zinc-500">
                            AI marks what looks satisfied. Toggle items as you
                            confirm them on your charts.
                          </p>
                        </div>
                        <div className="text-right text-[11px]">
                          <p className="font-semibold text-emerald-300">
                            {completedCount} / {totalCount} checked
                          </p>
                          <p className="text-zinc-500">Tap items to toggle.</p>
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
                          All checklist items are marked as satisfied. This
                          does not guarantee a winning trade, but it means the
                          setup matches the model you described.
                        </p>
                      )}
                    </div>

                    {/* Screenshot overlay guides */}
                    <div className="mt-3 rounded-lg border border-zinc-800 bg-black/60 p-3">
                      <h3 className="mb-1 text-[13px] font-semibold text-zinc-100">
                        Screenshot overlay ideas
                      </h3>
                      <p className="mb-2 text-[11px] text-zinc-500">
                        Use these as drawing instructions: boxes for order
                        blocks, arrows for liquidity sweeps, and labels for
                        entry, stop and targets.
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
                          No screenshot overlay ideas for this analysis.
                        </p>
                      )}
                    </div>

                    {/* Learning links */}
                    <div className="mt-3 rounded-lg border border-zinc-800 bg-black/60 p-3">
                      <h3 className="mb-1 text-[13px] font-semibold text-zinc-100">
                        Practice resources for this idea
                      </h3>
                      <p className="mb-2 text-[11px] text-zinc-500">
                        These buttons open search pages so you can find
                        example videos and images on other platforms.
                      </p>
                      {analysis.learningQueries &&
                      analysis.learningQueries.length ? (
                        <div className="space-y-2">
                          {analysis.learningQueries.map((q, idx) => {
                            const queryText = q.query || q.concept;
                            return (
                              <div
                                key={idx}
                                className="flex flex-col gap-1 rounded-md border border-zinc-800 bg-zinc-950/80 px-2 py-2"
                              >
                                <div className="text-[12px] font-semibold text-zinc-100">
                                  {q.concept}
                                </div>
                                <div className="text-[11px] text-zinc-500">
                                  Search phrase: <span>{queryText}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                                  <a
                                    href={buildSearchUrl(
                                      "YouTube",
                                      queryText,
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full bg-red-600/80 px-3 py-1 text-xs font-medium text-white hover:bg-red-600"
                                  >
                                    YouTube
                                  </a>
                                  <a
                                    href={buildSearchUrl(
                                      "TikTok",
                                      queryText,
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-50 hover:bg-zinc-700"
                                  >
                                    TikTok
                                  </a>
                                  <a
                                    href={buildSearchUrl(
                                      "Instagram",
                                      queryText,
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full bg-purple-700/80 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700"
                                  >
                                    Instagram
                                  </a>
                                  <a
                                    href={buildSearchUrl(
                                      "Images",
                                      queryText,
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full bg-blue-700/80 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                  >
                                    Images
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-zinc-500">
                          No learning queries were generated for this run.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Once you store screenshots and run the analyzer, a
                    structured playbook will appear here for the selected
                    pair. Every run is stored so you can compare how the
                    story changed over time.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* PREDICTIONS TAB */}
          {activeTab === "predictions" && (
            <section className="space-y-4">
              <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-50">
                      Next possible move for{" "}
                      <span className="text-emerald-300">
                        {selectedPair || "—"}
                      </span>
                    </h2>
                    <p className="text-[11px] text-zinc-500">
                      Scenario summary based on your last analysis. For
                      study and planning only, not financial advice.
                    </p>
                  </div>
                  {analysis && (
                    <div className="text-right text-[11px]">
                      <p className="rounded-full bg-amber-500/20 px-3 py-1 text-amber-300">
                        {analysis.qualityLabel || "N/A"} setup{" "}
                        {typeof analysis.qualityScore === "number"
                          ? `(${analysis.qualityScore.toFixed(0)}/100)`
                          : ""}
                      </p>
                      {analysis.qualityReason && (
                        <p className="mt-1 text-amber-200">
                          {analysis.qualityReason}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-zinc-800 bg-black/40 p-3">
                  {analysis ? (
                    <>
                      {renderParagraphs(analysis.nextMove)}
                      <p className="mt-3 text-[11px] text-zinc-500">
                        Reminder: this is a description of a possible
                        pattern based on your screenshots and rules. Always
                        follow your own plan and manage risk.
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-zinc-500">
                      Run an analysis first to see a structured prediction
                      narrative for this pair.
                    </p>
                  )}
                </div>
              </section>

              {/* Cross pair radar summary */}
              <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-50">
                    Setup radar across all pairs
                  </h2>
                  <span className="text-[11px] text-zinc-400">
                    Sorted by quality score (A+ first)
                  </span>
                </div>
                {setupRadar.length ? (
                  <div className="space-y-1 text-[11px]">
                    {sortedAnalyzed.map((s) => (
                      <div
                        key={s.pair}
                        className="flex flex-col gap-1 rounded-md border border-zinc-800 bg-black/60 px-2 py-2 md:flex-row md:items-start md:gap-3"
                      >
                        <div className="flex items-center gap-2 md:w-40">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPair(s.pair);
                              setActiveTab("predictions");
                            }}
                            className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
                          >
                            {s.pair}
                          </button>
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            {s.qualityLabel}{" "}
                            {s.qualityScore
                              ? `(${s.qualityScore.toFixed(0)})`
                              : ""}
                          </span>
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-[11px] text-zinc-300">
                            <span className="font-semibold text-zinc-400">
                              Bias:
                            </span>{" "}
                            {s.biasSnippet || "No bias summary available."}
                          </p>
                          <p className="text-[11px] text-emerald-300">
                            <span className="font-semibold text-emerald-400">
                              Scenario:
                            </span>{" "}
                            {s.nextMoveSnippet ||
                              "No scenario summary for this pair yet."}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500">
                    Once you have analysed a few pairs, this radar shows
                    which ones are closest to an A+ setup based on your
                    rules.
                  </p>
                )}
              </section>
            </section>
          )}

          {/* HISTORY TAB */}
          {activeTab === "history" && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-50">
                  Analysis history for {selectedPair || "—"}
                </h2>
                <span className="text-[11px] text-zinc-400">
                  {historyEntries.length} snapshot
                  {historyEntries.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="max-h-[540px] overflow-auto rounded-md border border-zinc-800 bg-black/40 p-2 text-[11px]">
                {historyEntries.length ? (
                  <div className="space-y-1">
                    {historyEntries.map((entry) => {
                      const a = entry.analysis;
                      const briefBias = (a.htfBias || "").slice(0, 120);
                      const briefScenario = (a.nextMove || "").slice(
                        0,
                        120,
                      );
                      return (
                        <div
                          key={entry.id}
                          className="flex flex-col gap-1 rounded-md border border-zinc-800 bg-zinc-950/80 px-2 py-2 md:flex-row md:items-start md:gap-3"
                        >
                          <div className="md:w-44">
                            <p className="text-[11px] font-semibold text-zinc-100">
                              {formatDateTime(entry.createdAt)}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                              TF:{" "}
                              {entry.timeframes &&
                              entry.timeframes.length
                                ? entry.timeframes.join(", ")
                                : "n/a"}
                            </p>
                            <p className="mt-1 text-[10px] text-amber-300">
                              {a.qualityLabel || "N/A"}{" "}
                              {typeof a.qualityScore === "number"
                                ? `(${a.qualityScore.toFixed(0)})`
                                : ""}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                loadHistoryEntryIntoView(entry)
                              }
                              className="mt-1 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-100 hover:bg-zinc-800"
                            >
                              Load this snapshot in Analysis
                            </button>
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-[11px] text-zinc-300">
                              <span className="font-semibold text-zinc-400">
                                Bias:
                              </span>{" "}
                              {briefBias || "No bias summary."}
                            </p>
                            <p className="text-[11px] text-emerald-300">
                              <span className="font-semibold text-emerald-400">
                                Scenario:
                              </span>{" "}
                              {briefScenario ||
                                "No scenario summary for this snapshot."}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500">
                    No history for this pair yet. Every time you analyze, a
                    snapshot is saved here so you can later compare how the
                    market evolved around your idea.
                  </p>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
