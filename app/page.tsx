"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";

// Material UI
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import DashboardIcon from "@mui/icons-material/Dashboard";
import UploadIcon from "@mui/icons-material/UploadRounded";
import AssessmentIcon from "@mui/icons-material/Assessment";
import TimelineIcon from "@mui/icons-material/Timeline";
import HistoryIcon from "@mui/icons-material/History";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SelectAllIcon from "@mui/icons-material/SelectAll";

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
  tradeOutcome?: "hit" | "miss" | "pending";
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

type ViewMode = "dashboard" | "upload" | "analysis" | "predictions" | "history";

type OverlayConfig = {
  modelName: string;
  tfNote: string;
  longEntry: string;
  longSL: string;
  longTP1: string;
  longTP2: string;
  shortEntry: string;
  shortSL: string;
  shortTP1: string;
  shortTP2: string;
  demandLow: string;
  demandHigh: string;
  supplyLow: string;
  supplyHigh: string;
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
          In TradingView, copy a screenshot to clipboard, click this box, then
          press Ctrl+V or Cmd+V. The images stay attached to the current pair
          until you clear them.
        </p>
      ) : (
        <div className="mt-1 grid max-h-28 grid-cols-3 gap-1 overflow-auto">
          {images.map((img) => (
            <div
              key={img.id}
              className="overflow-hidden rounded-md border border-zinc-800 bg-black"
            >
              <Image
                src={img.previewUrl}
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

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function HomePage() {
  // Pairs / watchlist
  const [pairs, setPairs] = useState<string[]>([]);
  const [selectedPair, setSelectedPair] = useState<string>("");

  // Which main view is active
  const [view, setView] = useState<ViewMode>("dashboard");

  const [newPairInput, setNewPairInput] = useState("");
  const [isAddingPair, setIsAddingPair] = useState(false);

  // Sidebar selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
  const [openPairs, setOpenPairs] = useState<Record<string, boolean>>({});

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

  // Overlay helper
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>({
    modelName: "MySetup",
    tfNote: "H4,M15",
    longEntry: "",
    longSL: "",
    longTP1: "",
    longTP2: "",
    shortEntry: "",
    shortSL: "",
    shortTP1: "",
    shortTP2: "",
    demandLow: "",
    demandHigh: "",
    supplyLow: "",
    supplyHigh: "",
  });
  const [pineConfigString, setPineConfigString] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  // Clock for candle timers
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load pairs from server, but do NOT auto-select
  useEffect(() => {
    const loadPairs = async () => {
      try {
        const res = await fetch("/api/pairs");
        if (!res.ok) throw new Error("Failed to load pairs");
        const data: { pairs: string[] } = await res.json();
        const fromServer =
          data.pairs && data.pairs.length ? data.pairs : defaultPairs;
        setPairs(fromServer);
      } catch {
        setPairs(defaultPairs);
      }
    };
    loadPairs();
  }, []);

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
    if (!next.includes(selectedPair)) {
      setSelectedPair("");
      setView("dashboard");
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

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedForDelete([]);
  };

  const togglePairSelectionForDelete = (symbol: string) => {
    setSelectedForDelete((prev) =>
      prev.includes(symbol)
        ? prev.filter((p) => p !== symbol)
        : [...prev, symbol],
    );
  };

  const selectAllPairsForDelete = () => {
    if (selectedForDelete.length === pairs.length) {
      setSelectedForDelete([]);
    } else {
      setSelectedForDelete([...pairs]);
    }
  };

  const handleBulkDelete = () => {
    if (!selectedForDelete.length) return;
    const next = pairs.filter((p) => !selectedForDelete.includes(p));
    updatePairs(next);
    setSelectedForDelete([]);
    setSelectionMode(false);
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

  // Reset overlay config when pair or timeframes change
  useEffect(() => {
    setOverlayConfig((prev) => ({
      ...prev,
      modelName:
        analysis?.qualityLabel && analysis.qualityLabel.length
          ? `${analysis.qualityLabel} setup`
          : prev.modelName || "MySetup",
      tfNote: selectedTimeframes.join(","),
    }));
    setPineConfigString("");
    setCopyStatus("idle");
  }, [selectedPair, selectedTimeframes, analysis]);

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
      setError("Please select a trading pair from the sidebar.");
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
        setView("analysis");
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

  // Pine input generator
  const handleOverlayChange = (
    field: keyof OverlayConfig,
    value: string,
  ) => {
    setOverlayConfig((prev) => ({ ...prev, [field]: value }));
    setPineConfigString("");
    setCopyStatus("idle");
  };

  const generatePineInputString = () => {
    if (!selectedPair) return;

    const modelName =
      overlayConfig.modelName.trim() || "MySetup";
    const tfNote =
      overlayConfig.tfNote.trim() || selectedTimeframes.join(",");
    const biasLine =
      (analysis?.htfBias || "").split(/\n/)[0].slice(0, 120) ||
      (analysis?.overview || "").split(/\n/)[0].slice(0, 120) ||
      "";

    const numOrZero = (v: string) =>
      v.trim().length ? v.trim() : "0";

    const cfg =
      `MODEL=${modelName};` +
      `PAIR=${selectedPair};` +
      `TF=${tfNote};` +
      `BIAS=${biasLine};` +
      `LE=${numOrZero(overlayConfig.longEntry)};` +
      `LS=${numOrZero(overlayConfig.longSL)};` +
      `LT1=${numOrZero(overlayConfig.longTP1)};` +
      `LT2=${numOrZero(overlayConfig.longTP2)};` +
      `SE=${numOrZero(overlayConfig.shortEntry)};` +
      `SS=${numOrZero(overlayConfig.shortSL)};` +
      `ST1=${numOrZero(overlayConfig.shortTP1)};` +
      `ST2=${numOrZero(overlayConfig.shortTP2)};` +
      `DL=${numOrZero(overlayConfig.demandLow)};` +
      `DH=${numOrZero(overlayConfig.demandHigh)};` +
      `SL=${numOrZero(overlayConfig.supplyLow)};` +
      `SH=${numOrZero(overlayConfig.supplyHigh)};`;

    setPineConfigString(cfg);
    setCopyStatus("idle");
  };

  const handleCopyPineConfig = async () => {
    if (!pineConfigString) return;
    try {
      if (navigator && navigator.clipboard) {
        await navigator.clipboard.writeText(pineConfigString);
        setCopyStatus("copied");
      } else {
        setCopyStatus("error");
      }
    } catch {
      setCopyStatus("error");
    }
  };

  // Weekly stats for cards (based on selected pair)
  const nowMs = Date.now();
  const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const weeklyEntries = historyEntries.filter(
    (e) => Date.parse(e.createdAt) >= weekAgo,
  );
  const weeklyTotal = weeklyEntries.length;
  const weeklyHits = weeklyEntries.filter(
    (e) => e.analysis.tradeOutcome === "hit",
  ).length;
  const weeklyMiss = weeklyEntries.filter(
    (e) => e.analysis.tradeOutcome === "miss",
  ).length;
  const weeklyPending = weeklyTotal - weeklyHits - weeklyMiss;
  const weeklyHitRate =
    weeklyTotal > 0 ? Math.round((weeklyHits / weeklyTotal) * 100) : 0;

  const bestSetup = sortedAnalyzed[0] ?? null;

  // Pair card renderer (new sidebar style)
  const renderPairCard = (pair: string, summary?: SetupSummary) => {
    const isSelected = pair === selectedPair;
    const isMarkedForDelete = selectedForDelete.includes(pair);
    const isOpen = !!openPairs[pair];
    const hasAnalysis = !!summary;

    const handleCardClick = () => {
      if (selectionMode) {
        togglePairSelectionForDelete(pair);
      } else {
        setSelectedPair(pair);
        setView(hasAnalysis ? "analysis" : "upload");
        setOpenPairs((prev) => ({ ...prev, [pair]: !prev[pair] }));
      }
    };

    const handleArrowClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpenPairs((prev) => ({ ...prev, [pair]: !prev[pair] }));
    };

    return (
      <Box key={pair} sx={{ mb: 1 }}>
        <button
          type="button"
          onClick={handleCardClick}
          className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
            isSelected
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {selectionMode && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  togglePairSelectionForDelete(pair);
                }}
                className="flex h-5 w-5 items-center justify-center rounded-md border border-zinc-600 bg-black text-[11px]"
              >
                {isMarkedForDelete ? "✓" : ""}
              </div>
            )}
            <div className="flex flex-col">
              <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-zinc-100">
                {pair}
              </span>
              <span className="mt-0.5 text-[10px] text-zinc-500">
                {hasAnalysis
                  ? `${summary?.qualityLabel || "N/A"} ${
                      summary?.qualityScore
                        ? `(${summary.qualityScore.toFixed(0)})`
                        : ""
                    }`
                  : "Watchlist only"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {selectionMode && (
              <span className="text-[10px] text-zinc-500">
                tap to select
              </span>
            )}
            <IconButton
              size="small"
              onClick={handleArrowClick}
              sx={{ color: "#6b7280" }}
            >
              {isOpen ? (
                <ExpandLessIcon sx={{ fontSize: 18 }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </div>
        </button>

        {isOpen && (
          <div className="mt-1 flex flex-wrap gap-1.5 pl-2">
            {/* Upload is always visible */}
            <button
              type="button"
              onClick={() => {
                setSelectedPair(pair);
                setView("upload");
              }}
              className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                view === "upload" && pair === selectedPair
                  ? "bg-emerald-500 text-black"
                  : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              Upload
            </button>

            {/* Other actions only when there is at least one analysis */}
            {hasAnalysis && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPair(pair);
                    setView("analysis");
                  }}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                    view === "analysis" && pair === selectedPair
                      ? "bg-emerald-500 text-black"
                      : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  Analysis
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPair(pair);
                    setView("predictions");
                  }}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                    view === "predictions" && pair === selectedPair
                      ? "bg-emerald-500 text-black"
                      : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  Predictions
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPair(pair);
                    setView("history");
                  }}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                    view === "history" && pair === selectedPair
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
      </Box>
    );
  };

  // Sidebar top icons state
  const [nowTsSidebar] = useState(0); // just to avoid TS unused var (not used but harmless)

  return (
    <Box className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100">
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
        {/* Sidebar */}
        <Box sx={{ width: 280, flexShrink: 0 }}>
          <Paper
            elevation={3}
            sx={{
              backgroundColor: "#020617",
              borderRadius: 24,
              border: "1px solid #1f2937",
              padding: 1.5,
              color: "#e5e7eb",
            }}
          >
            {/* Workspace header + icons */}
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={1.5}
            >
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ fontSize: 13, fontWeight: 600 }}
                >
                  Workspace
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: 11, color: "#9ca3af" }}
                >
                  Choose dashboard or a pair.
                </Typography>
              </Box>

              <Box display="flex" alignItems="center" gap={0.5}>
                <Tooltip
                  title={
                    selectionMode
                      ? "Exit selection mode"
                      : "Enable selection mode"
                  }
                >
                  <IconButton
                    size="small"
                    onClick={toggleSelectionMode}
                    sx={{
                      color: selectionMode ? "#22c55e" : "#6b7280",
                    }}
                  >
                    {selectionMode ? (
                      <CheckBoxIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <CheckBoxOutlineBlankIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </Tooltip>

                {selectionMode && (
                  <>
                    <Tooltip title="Select all pairs">
                      <IconButton
                        size="small"
                        onClick={selectAllPairsForDelete}
                        sx={{ color: "#6b7280" }}
                      >
                        <SelectAllIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete selected pairs">
                      <span>
                        <IconButton
                          size="small"
                          onClick={handleBulkDelete}
                          disabled={!selectedForDelete.length}
                          sx={{
                            color: selectedForDelete.length
                              ? "#f97373"
                              : "#374151",
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </>
                )}

                <Tooltip title="Add pair">
                  <IconButton
                    size="small"
                    onClick={() => setIsAddingPair(true)}
                    sx={{ color: "#22c55e" }}
                  >
                    <AddIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Dashboard button */}
            <button
              type="button"
              onClick={() => {
                setView("dashboard");
                setSelectedPair("");
              }}
              className={`mb-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${
                view === "dashboard"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900"
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                <DashboardIcon sx={{ fontSize: 18 }} />
              </span>
              <span className="flex flex-col">
                <span className="text-[13px] font-semibold text-zinc-50">
                  Dashboard
                </span>
                <span className="text-[11px] text-zinc-500">
                  Weekly stats and radar
                </span>
              </span>
            </button>

            <Divider sx={{ my: 1.5, borderColor: "#1f2937" }} />

            {/* Analyzed section */}
            <div className="mb-2">
              <p className="mb-1 text-[11px] font-semibold text-zinc-500">
                Analyzed setups ({sortedAnalyzed.length})
              </p>
              {sortedAnalyzed.length ? (
                sortedAnalyzed.map((s) =>
                  renderPairCard(s.pair, s),
                )
              ) : (
                <p className="text-[11px] text-zinc-600">
                  Once you run analysis for a pair, it appears here with
                  quality grade.
                </p>
              )}
            </div>

            <Divider sx={{ my: 1.5, borderColor: "#1f2937" }} />

            {/* Watchlist section */}
            <div>
              <p className="mb-1 text-[11px] font-semibold text-zinc-500">
                Watchlist pairs ({normalPairs.length})
              </p>
              {normalPairs.length ? (
                normalPairs.map((p) => renderPairCard(p))
              ) : (
                <p className="text-[11px] text-zinc-600">
                  No watchlist-only pairs. Add more symbols or remove some
                  analyzed ones.
                </p>
              )}

              {/* Add pair input */}
              {isAddingPair && (
                <Box
                  sx={{
                    mt: 1,
                    borderRadius: 2,
                    border: "1px solid #1f2937",
                    backgroundColor: "#030712",
                    p: 1,
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <TextField
                      autoFocus
                      variant="standard"
                      placeholder="EURUSD"
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
                      InputProps={{
                        disableUnderline: true,
                        sx: {
                          fontSize: 12,
                          color: "#e5e7eb",
                          textTransform: "uppercase",
                          px: 1,
                          py: 0.5,
                        },
                      }}
                      sx={{
                        flexGrow: 1,
                        borderRadius: 1,
                        border: "1px solid #374151",
                        backgroundColor: "#020617",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddPair}
                      className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-black hover:bg-emerald-400"
                    >
                      Save
                    </button>
                  </Box>
                </Box>
              )}
            </div>
          </Paper>
        </Box>

        {/* Main area — everything below is unchanged from last version */}
        {/* (Cards row, dashboard, upload, analysis, predictions, history) */}
        {/* --- The rest of the file is identical to the previous answer --- */}

        {/* MAIN CONTENT (unchanged): weekly cards, views, etc. */}
        {/* To keep this message from exploding, I left the rest of the content
            exactly as in the previous full code you pasted, starting from:

            <main className="flex-1 space-y-4">
              ...
            </main>

            You can keep that part as-is and only replace the header + sidebar
            section with the version above.
        */}
      </div>
    </Box>
  );
}
