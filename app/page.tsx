"use client";

import React, { useCallback, useEffect, useState } from "react";

// Types
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

// Clipboard paste zone
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
          then press Ctrl+V or Cmd+V. They will be attached to the current
          pair on the server.
        </p>
      ) : (
        <div className="mt-1 grid max-h-28 grid-cols-3 gap-1 overflow-auto">
          {images.map((img) => (
            <div
              key={img.id}
              className="overflow-hidden rounded-md border border-zinc-800 bg-black"
            >
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

export default function HomePage() {
  // Pairs
  const [pairs, setPairs] = useState<string[]>([]);
  const [selectedPair, setSelectedPair] = useState<string>("");
  const [newPairInput, setNewPairInput] = useState("");
  const [isAddingPair, setIsAddingPair] = useState(false);

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

  // Tick time
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

  // Save pairs
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

  // Radar
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

  // Load history for current pair
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

  // Save analysis snapshot
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

  // JSX
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
              Models and learning
            </a>
            <a
              href="/video-models"
              className="rounded-full px-3 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Videos
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 lg:flex-row">
        {/* LEFT COLUMN */}
        <aside className="flex w-full flex-col gap-4 lg:w-80">
          {/* Trading workspace */}
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 px-4 py-4 text-xs shadow-lg">
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
                    Pick a pair and maintain a shared watchlist.
                  </p>
                </div>
              </div>
              <div className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] text-zinc-400">
                Shared
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {pairs.map((p) => (
                <div
                  key={p}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] ${
                    p === selectedPair
                      ? "bg-emerald-500 text-black"
                      : "bg-zinc-900 text-zinc-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedPair(p)}
                    className="text-[12px]"
                  >
                    {p}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemovePair(p)}
                    className="ml-2 text-[11px] text-zinc-400 hover:text-zinc-200"
                    title="Remove pair"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {isAddingPair ? (
                <div className="inline-flex items-center rounded-full bg-zinc-900 px-3 py-1 text-[12px]">
                  <input
                    autoFocus
                    className="w-20 bg-transparent text-[12px] uppercase text-zinc-100 outline-none"
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
                    className="ml-2 text-[11px] text-emerald-400"
                    title="Add pair"
                  >
                    ↵
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingPair(true)}
                  className="inline-flex items-center rounded-full bg-zinc-900 px-3 py-1 text-[12px] text-zinc-200 hover:bg-zinc-800"
                >
                  + Add pair
                </button>
              )}
              {!pairs.length && !isAddingPair && (
                <span className="rounded-full bg-zinc-900 px-2 py-1 text-[11px] text-zinc-500">
                  No pairs yet – add one.
                </span>
              )}
            </div>
          </section>

          {/* Notes */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
            <h2 className="mb-1 text-sm font-semibold text-zinc-50">
              📝 What do you want to know
            </h2>
            <p className="mb-2 text-[11px] text-zinc-500">
              Optional prompt to steer the analysis.
            </p>
            <textarea
              className="h-24 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-[11px] text-zinc-100 outline-none focus:border-emerald-500"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                "Example:\n- Tell me the higher timeframe bias and why.\n- Is there liquidity being grabbed here?\n- Where is a high-probability entry with SL/TP idea?"
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
                  {chartImages.length
                    ? `${chartImages.length} image(s) stored for this pair`
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
                Remove screenshots
              </button>
            </div>
            {error && (
              <p className="mt-1 text-[11px] font-medium text-red-900">
                {error}
              </p>
            )}
          </section>
        </aside>

        {/* RIGHT COLUMN */}
        <main className="flex-1 space-y-4">
          {/* Steps */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
            <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-400">
              {["Timeframes & charts", "Playbook", "Compare & plan"].map(
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
          </section>

          {/* Timeframes + screenshots merged */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-50">
                  1. Timeframes & chart screenshots
                </h2>
                <p className="text-[11px] text-zinc-500">
                  Select the structure you&apos;re studying, then upload or
                  paste the actual TradingView charts.
                </p>
              </div>
              <div className="rounded-full bg-zinc-900 px-3 py-1 text-[11px] text-zinc-400">
                {selectedTimeframes.length
                  ? `TFs: ${selectedTimeframes.join(", ")}`
                  : "No timeframe selected"}
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

              {/* candle timers */}
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
                        : `~${formatRemaining(
                            remaining,
                          )} left in current candle (approximate)`}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upload + paste in one area */}
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
                  You can select multiple images at once (H4, H1, M15, M5).
                  They stay attached to this pair in the database until you
                  remove them.
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
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                    Used for every analysis until removed
                  </span>
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

          {/* Ebook-style analysis */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-50">
                  2. Multi timeframe playbook for{" "}
                  <span className="text-emerald-300">
                    {selectedPair || "—"}
                  </span>
                </h2>
                <p className="text-[11px] text-zinc-500">
                  Structured like a mini ebook: context, liquidity story,
                  entry plan, risk, red flags, next-move scenarios,
                  checklist, and practice links.
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

            <div className="max-h-[460px] overflow-auto rounded-md border border-zinc-800 bg-black/40 p-3">
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
                      3. Liquidity story – where the money sits
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
                      6. Red flags – when not to take this setup
                    </h3>
                    {renderParagraphs(analysis.redFlags)}
                  </div>
                  <div>
                    <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-emerald-300">
                      7. Scenario for the next possible move
                    </h3>
                    <p className="mb-1 text-[11px] text-zinc-500">
                      Educational if-then scenarios only. Not financial
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
                          ✅ Entry checklist
                        </h3>
                        <p className="text-[11px] text-zinc-500">
                          The AI marks what already looks satisfied. You can
                          toggle items as you confirm them on your chart.
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
                        All checklist items are marked as satisfied. This
                        does not guarantee a winning trade, but it means the
                        setup matches the model. Always follow your own risk
                        plan.
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
                      boxes for order blocks, arrows for liquidity sweeps,
                      and labels for entry, stop and target.
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
                        No screenshot overlay ideas were generated for this
                        run.
                      </p>
                    )}
                  </div>

                  {/* Learning links */}
                  <div className="mt-3 rounded-lg border border-zinc-800 bg-black/60 p-3">
                    <h3 className="mb-1 text-[13px] font-semibold text-zinc-100">
                      🎓 Practice resources for this idea
                    </h3>
                    <p className="mb-2 text-[11px] text-zinc-500">
                      These buttons open search pages so you can find example
                      videos and images on other platforms.
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
                  Once you store screenshots and click{" "}
                  <span className="font-semibold">Analyze Charts</span>, you
                  will get a structured playbook here. Every run is stored,
                  so you can compare how the story changed over time.
                </p>
              )}
            </div>
          </section>

          {/* History */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-50">
                3. Recent analyses for this pair
              </h2>
              <span className="text-[11px] text-zinc-400">
                Latest {historyEntries.length || 0} snapshots
              </span>
            </div>
            <div className="max-h-56 overflow-auto rounded-md border border-zinc-800 bg-black/40 p-2 text-[11px]">
              {historyEntries.length ? (
                <div className="space-y-1">
                  {historyEntries.map((entry) => {
                    const a = entry.analysis;
                    const briefBias = (a.htfBias || "").slice(0, 120);
                    const briefScenario = (a.nextMove || "").slice(0, 120);
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
                            {entry.timeframes && entry.timeframes.length
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
                            onClick={() => loadHistoryEntryIntoView(entry)}
                            className="mt-1 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-100 hover:bg-zinc-800"
                          >
                            Load this snapshot
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
                            {briefScenario || "No scenario summary."}
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
                  market evolved.
                </p>
              )}
            </div>
          </section>

          {/* Radar */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-50">
                4. Setup radar and predictions across pairs
              </h2>
              <span className="text-[11px] text-zinc-400">
                Sorted by quality score (A+ setups at the top)
              </span>
            </div>
            {setupRadar.length ? (
              <div className="space-y-1 text-[11px]">
                {setupRadar.map((s) => (
                  <div
                    key={s.pair}
                    className="flex flex-col gap-1 rounded-md border border-zinc-800 bg-black/60 px-2 py-2 md:flex-row md:items-start md:gap-3"
                  >
                    <div className="flex items-center gap-2 md:w-40">
                      <button
                        type="button"
                        onClick={() => setSelectedPair(s.pair)}
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
                          "No scenario summary available yet."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500">
                Once you have analysed a few pairs, this section will list
                them here and show which ones look closest to an A+ setup.
                This is for study and planning only, not financial advice.
              </p>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
