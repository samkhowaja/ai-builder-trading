// app/builder/page.tsx
"use client";

import React, { useEffect, useState } from "react";

type EntryModel = {
  id: string;
  name: string;
  style: string;
  timeframe: string;
  instrument: string;
  session: string;
  riskPerTrade: number;
  description: string;
  rules: string;
  checklist: string[];
  tags: string[];
  sourceVideoUrl?: string;
  sourceVideoTitle?: string;
  sourceTimestamps?: string;
  sourceChannel?: string;
};

type QuizItem = {
  question: string;
  answer: string;
};

type ScreenshotIdea = {
  label: string;
  description: string;
};

type ModelGuide = {
  overview: string;
  story: string;
  rulesChecklist: string[];
  invalidation: string;
  screenshotIdeas: ScreenshotIdea[];
  practiceSteps: string[];
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const defaultModels: EntryModel[] = [
  {
    id: createId(),
    name: "EURUSD London Session Liquidity Sweep",
    style: "Intraday",
    timeframe: "M15",
    instrument: "EURUSD",
    session: "London",
    riskPerTrade: 1,
    description:
      "Fade liquidity grabs around previous day's high/low during London session using displacement and FVG entries.",
    rules:
      "- Define HTF bias on H4 / H1.\n" +
      "- Mark previous day high/low and Asia range.\n" +
      "- During London killzone, wait for price to run a key high/low (liquidity grab).\n" +
      "- Look for displacement and FVG in direction of HTF bias.\n" +
      "- Enter on FVG retrace or origin of impulse.\n" +
      "- SL beyond the liquidity grab, TP at next liquidity pool / HTF level.",
    checklist: [
      "HTF bias aligned (H4/H1)?",
      "Asia range marked?",
      "London session active?",
      "Clear external liquidity taken?",
      "Displacement + FVG visible?",
      "SL + TP defined before entry?",
    ],
    tags: ["EURUSD", "London", "ICT", "FVG", "Liquidity"],
    sourceVideoUrl: "",
    sourceVideoTitle: "",
    sourceTimestamps: "",
    sourceChannel: "Default",
  },
];

const MODELS_STORAGE_KEY = "ai-builder-models-v1";
const GUIDES_STORAGE_KEY = "ai-builder-guides-v1";

export default function BuilderPage() {
  const [models, setModels] = useState<EntryModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [creatingFromVideo, setCreatingFromVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [quiz, setQuiz] = useState<QuizItem[] | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"learn" | "edit">("learn");
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [guidesByModelId, setGuidesByModelId] = useState<
    Record<string, ModelGuide>
  >({});

  const [collapsedChannels, setCollapsedChannels] = useState<
    Record<string, boolean>
  >({});
  const [search, setSearch] = useState("");

  // ---------- LOAD ----------
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const rawModels = window.localStorage.getItem(MODELS_STORAGE_KEY);
      if (rawModels) {
        const parsed = JSON.parse(rawModels) as EntryModel[];
        if (parsed.length) {
          setModels(parsed);
          setSelectedModelId(parsed[parsed.length - 1].id);
        } else {
          setModels(defaultModels);
          setSelectedModelId(defaultModels[0].id);
        }
      } else {
        setModels(defaultModels);
        setSelectedModelId(defaultModels[0].id);
      }

      const rawGuides = window.localStorage.getItem(GUIDES_STORAGE_KEY);
      if (rawGuides) {
        setGuidesByModelId(JSON.parse(rawGuides) as Record<string, ModelGuide>);
      }
    } catch (e) {
      console.error("Failed to load builder data", e);
      setModels(defaultModels);
      setSelectedModelId(defaultModels[0].id);
    }
  }, []);

  // ---------- SAVE ----------
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          MODELS_STORAGE_KEY,
          JSON.stringify(models),
        );
      }
    } catch (e) {
      console.error("Failed to save models", e);
    }
  }, [models]);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          GUIDES_STORAGE_KEY,
          JSON.stringify(guidesByModelId),
        );
      }
    } catch (e) {
      console.error("Failed to save guides", e);
    }
  }, [guidesByModelId]);

  const selectedModel = models.find((m) => m.id === selectedModelId) || null;
  const currentGuide: ModelGuide | null = selectedModel
    ? guidesByModelId[selectedModel.id] || null
    : null;

  // ---------- GUIDE ----------
  const fetchGuideIfNeeded = async (model: EntryModel) => {
    if (guidesByModelId[model.id]) return;

    setLoadingGuide(true);
    setGuideError(null);

    try {
      const res = await fetch("/api/explain-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGuideError(data.error || "Failed to generate learning guide.");
        return;
      }

      const guide = data.guide as ModelGuide;
      setGuidesByModelId((prev) => ({ ...prev, [model.id]: guide }));
    } catch (err) {
      console.error(err);
      setGuideError("Failed to contact learning guide API.");
    } finally {
      setLoadingGuide(false);
    }
  };

  useEffect(() => {
    if (selectedModel) {
      setQuiz(null);
      setViewMode("learn");
      fetchGuideIfNeeded(selectedModel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModelId]);

  // ---------- CRUD ----------
  const handleCreateModelFromVideo = async () => {
    if (!videoUrlInput) return;

    setCreatingFromVideo(true);
    setVideoError(null);

    try {
      const res = await fetch("/api/video-to-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoUrlInput }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVideoError(data.error || "Failed to create model from video.");
        return;
      }

      const newModel: EntryModel = {
        id: createId(),
        ...data.model,
      };

      setModels((prev) => [...prev, newModel]);
      setSelectedModelId(newModel.id);
      setQuiz(null);
      setVideoUrlInput("");
      setViewMode("learn");
    } catch (err) {
      console.error(err);
      setVideoError("Could not contact video analyzer API.");
    } finally {
      setCreatingFromVideo(false);
    }
  };

  const handleAddModel = () => {
    const newModel: EntryModel = {
      id: createId(),
      name: "New Entry Model",
      style: "Intraday",
      timeframe: "M15",
      instrument: "EURUSD",
      session: "London",
      riskPerTrade: 1,
      description: "",
      rules: "",
      checklist: [],
      tags: [],
      sourceVideoUrl: "",
      sourceVideoTitle: "",
      sourceTimestamps: "",
      sourceChannel: "Ungrouped",
    };
    setModels((prev) => [...prev, newModel]);
    setSelectedModelId(newModel.id);
    setQuiz(null);
    setViewMode("learn");
  };

  const handleDuplicateModel = (id: string) => {
    const original = models.find((m) => m.id === id);
    if (!original) return;
    const copy: EntryModel = {
      ...original,
      id: createId(),
      name: original.name + " (Copy)",
    };
    setModels((prev) => [...prev, copy]);
    setSelectedModelId(copy.id);
    setQuiz(null);
    setViewMode("learn");
  };

  const handleDeleteModel = (id: string) => {
    setModels((prev) => prev.filter((m) => m.id !== id));
    setGuidesByModelId((prev) => {
      const clone = { ...prev };
      delete clone[id];
      return clone;
    });
    if (selectedModelId === id) {
      setSelectedModelId(null);
      setQuiz(null);
    }
  };

  const updateModel = (id: string, updates: Partial<EntryModel>) => {
    setModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    );
  };

  const handleChecklistChange = (id: string, value: string) => {
    const items = value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    updateModel(id, { checklist: items });
  };

  const handleTagsChange = (id: string, value: string) => {
    const items = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateModel(id, { tags: items });
  };

  // ---------- QUIZ ----------
  const handleGenerateQuiz = async () => {
    if (!selectedModel) return;

    setLoadingQuiz(true);
    setQuizError(null);

    try {
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel }),
      });

      const data = await res.json();

      if (!res.ok) {
        setQuizError(data.error || "Failed to generate quiz.");
        setQuiz(null);
        return;
      }

      setQuiz(data.quiz || null);
    } catch (err) {
      console.error(err);
      setQuizError("Failed to connect to quiz API.");
      setQuiz(null);
    } finally {
      setLoadingQuiz(false);
    }
  };

  const renderParagraphs = (text: string) =>
    text
      .split(/\n\s*\n/)
      .map((p, idx) => (
        <p key={idx} className="mb-2 text-[13px] leading-relaxed text-zinc-200">
          {p.trim()}
        </p>
      ));

  // ---------- GROUPING ----------
  const filteredModels = models.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.instrument.toLowerCase().includes(q) ||
      m.tags.join(" ").toLowerCase().includes(q) ||
      (m.sourceChannel || "").toLowerCase().includes(q)
    );
  });

  const groupedByChannel: Record<string, EntryModel[]> =
    filteredModels.reduce((acc, model) => {
      const channel = model.sourceChannel || "Ungrouped";
      if (!acc[channel]) acc[channel] = [];
      acc[channel].push(model);
      return acc;
    }, {} as Record<string, EntryModel[]>);

  const channelNames = Object.keys(groupedByChannel).sort();

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100">
      {/* NAV */}
      <header className="border-b border-zinc-800 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-xs font-black text-black">
              AI
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">
                Entry Model Library
              </p>
              <p className="text-[11px] text-zinc-500">
                Turn YouTube strategies into step-by-step playbooks
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            <a
              href="/"
              className="rounded-full px-3 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Analyzer
            </a>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-300">
              Models & Learning
            </span>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row">
        {/* LEFT – Library */}
        <aside className="w-full space-y-4 md:w-80">
          {/* Generate from YouTube */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 text-xs shadow-lg">
            <p className="mb-1 text-sm font-semibold text-zinc-100">
              📺 Create model from YouTube
            </p>
            <p className="mb-2 text-[11px] text-zinc-500">
              Paste a strategy video. The AI drafts one clean entry model you
              can refine later.
            </p>
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                className="flex-1 rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
              />
              <button
                onClick={handleCreateModelFromVideo}
                disabled={creatingFromVideo || !videoUrlInput}
                className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-medium text-black disabled:cursor-not-allowed disabled:bg-emerald-900"
              >
                {creatingFromVideo ? "Analyzing…" : "Generate"}
              </button>
            </div>
            {videoError && (
              <p className="mt-2 text-[11px] text-red-400">{videoError}</p>
            )}
          </section>

          {/* Search + New */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 text-xs shadow-lg">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">
                📚 My entry models
              </h2>
              <button
                onClick={handleAddModel}
                className="rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-medium text-black"
              >
                + New
              </button>
            </div>
            <input
              className="mb-2 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-[11px] outline-none focus:border-emerald-500"
              placeholder="Search by name, pair, tag, channel…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {/* Channel folders */}
            <div className="space-y-2">
              {channelNames.map((channel) => {
                const modelsInChannel = groupedByChannel[channel];
                const collapsed = collapsedChannels[channel] ?? false;
                return (
                  <div
                    key={channel}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/90"
                  >
                    <button
                      onClick={() =>
                        setCollapsedChannels((prev) => ({
                          ...prev,
                          [channel]: !collapsed,
                        }))
                      }
                      className="flex w-full items-center justify-between px-3 py-2 text-[11px]"
                    >
                      <span className="font-semibold text-zinc-100">
                        {channel}
                      </span>
                      <span className="flex items-center gap-2 text-[10px] text-zinc-400">
                        {modelsInChannel.length} models
                        <span>{collapsed ? "▶" : "▼"}</span>
                      </span>
                    </button>
                    {!collapsed && (
                      <div className="space-y-2 border-t border-zinc-800 px-3 py-2">
                        {modelsInChannel.map((model) => (
                          <div
                            key={model.id}
                            className={`cursor-pointer rounded-md border px-3 py-2 text-[11px] transition ${
                              model.id === selectedModelId
                                ? "border-emerald-500 bg-emerald-500/10"
                                : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
                            }`}
                            onClick={() => setSelectedModelId(model.id)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="line-clamp-2 font-medium">
                                {model.name}
                              </p>
                            </div>
                            <p className="mt-1 text-[10px] text-zinc-400">
                              {model.style} • {model.timeframe} •{" "}
                              {model.instrument}
                            </p>
                            {model.tags.length > 0 && (
                              <p className="mt-1 line-clamp-1 text-[10px] text-zinc-500">
                                {model.tags.join(" · ")}
                              </p>
                            )}
                            <div className="mt-2 flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDuplicateModel(model.id);
                                }}
                                className="rounded bg-zinc-800 px-2 py-0.5 text-[10px]"
                              >
                                Duplicate
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteModel(model.id);
                                }}
                                className="rounded bg-red-600/80 px-2 py-0.5 text-[10px]"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {!channelNames.length && (
                <p className="text-[11px] text-zinc-500">
                  No models yet. Generate from YouTube or create a new one.
                </p>
              )}
            </div>
          </section>
        </aside>

        {/* RIGHT – Selected model */}
        <main className="flex-1 space-y-4">
          {!selectedModel ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-sm text-zinc-400">
              Select or create a model on the left to start learning.
            </div>
          ) : (
            <>
              {/* Summary + mode toggle */}
              <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg">
                <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-100">
                      {selectedModel.name}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-400">
                      {selectedModel.style} • {selectedModel.timeframe} •{" "}
                      {selectedModel.instrument} • Session:{" "}
                      {selectedModel.session || "N/A"} • Risk:{" "}
                      {selectedModel.riskPerTrade}% per trade
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Channel: {selectedModel.sourceChannel || "—"}
                      {selectedModel.sourceVideoUrl && (
                        <>
                          {" · "}Video:{" "}
                          {selectedModel.sourceVideoTitle ||
                            selectedModel.sourceVideoUrl}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => setViewMode("learn")}
                      className={`rounded-full px-3 py-1 font-medium ${
                        viewMode === "learn"
                          ? "bg-emerald-500 text-black"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      📘 Learn
                    </button>
                    <button
                      onClick={() => setViewMode("edit")}
                      className={`rounded-full px-3 py-1 font-medium ${
                        viewMode === "edit"
                          ? "bg-zinc-100 text-black"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      ✏️ Edit
                    </button>
                  </div>
                </div>

                {/* step tracker */}
                {viewMode === "learn" && (
                  <div className="mt-3 rounded-xl border border-zinc-800 bg-black/40 p-3 text-[11px] text-zinc-400">
                    <div className="flex items-center justify-between">
                      {[
                        "Overview",
                        "Story",
                        "Checklist",
                        "Invalidation",
                        "Screenshots",
                        "Practice",
                      ].map((label, idx) => (
                        <div
                          key={label}
                          className="flex flex-1 items-center gap-1"
                        >
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-black">
                            {idx + 1}
                          </div>
                          <span className="hidden md:inline">{label}</span>
                          {idx < 5 && (
                            <div className="mx-1 h-px flex-1 bg-zinc-700" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Learn or Edit */}
              {viewMode === "learn" ? (
                <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg">
                  {loadingGuide && (
                    <p className="text-xs text-zinc-400">
                      Building your study guide…
                    </p>
                  )}
                  {guideError && (
                    <p className="text-xs text-red-400">{guideError}</p>
                  )}
                  {!loadingGuide && currentGuide && (
                    <>
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                          1. Overview – What this model is about
                        </h3>
                        {renderParagraphs(currentGuide.overview)}
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                          2. Step-by-step price story
                        </h3>
                        {renderParagraphs(currentGuide.story)}
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                          3. Rules checklist (before you click Buy/Sell)
                        </h3>
                        <ul className="space-y-1 text-[13px] text-zinc-200">
                          {currentGuide.rulesChecklist.map((item, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 leading-relaxed"
                            >
                              <span className="mt-[3px] inline-block h-3 w-3 rounded border border-emerald-500" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                          4. When NOT to trade this model
                        </h3>
                        {renderParagraphs(currentGuide.invalidation)}
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                          5. Screenshot & image references
                        </h3>
                        <p className="mb-2 text-[11px] text-zinc-500">
                          Use each card as a screenshot checklist while
                          watching the video or replaying charts. For now these
                          are placeholders – you can add your own images later.
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          {currentGuide.screenshotIdeas.map((img, idx) => (
                            <div
                              key={idx}
                              className="flex flex-col rounded-lg border border-zinc-800 bg-black/40 p-3 text-[12px]"
                            >
                              <div className="mb-2 flex-1 rounded-md border border-dashed border-zinc-700 bg-zinc-900/60 p-4 text-center text-[11px] text-zinc-500">
                                Image placeholder – capture this scene from the
                                chart
                              </div>
                              <p className="font-semibold text-zinc-100">
                                {img.label}
                              </p>
                              <p className="mt-1 text-[11px] text-zinc-300">
                                {img.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                          6. Practice drills
                        </h3>
                        <ul className="space-y-1 text-[13px] text-zinc-200">
                          {currentGuide.practiceSteps.map((step, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="mt-[2px] text-emerald-400">
                                ●
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </section>
              ) : (
                <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg">
                  <h2 className="mb-3 text-sm font-semibold text-zinc-100">
                    ✏️ Edit model details
                  </h2>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-xs text-zinc-400">
                        Name
                        <input
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                          value={selectedModel.name}
                          onChange={(e) =>
                            updateModel(selectedModel.id, { name: e.target.value })
                          }
                        />
                      </label>

                      <label className="block text-xs text-zinc-400">
                        Style
                        <select
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                          value={selectedModel.style}
                          onChange={(e) =>
                            updateModel(selectedModel.id, {
                              style: e.target.value,
                            })
                          }
                        >
                          <option>Scalping</option>
                          <option>Intraday</option>
                          <option>Swing</option>
                        </select>
                      </label>

                      <label className="block text-xs text-zinc-400">
                        Timeframe
                        <input
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                          value={selectedModel.timeframe}
                          onChange={(e) =>
                            updateModel(selectedModel.id, {
                              timeframe: e.target.value,
                            })
                          }
                          placeholder="e.g. M5, M15, H1"
                        />
                      </label>

                      <label className="block text-xs text-zinc-400">
                        Instrument
                        <input
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                          value={selectedModel.instrument}
                          onChange={(e) =>
                            updateModel(selectedModel.id, {
                              instrument: e.target.value,
                            })
                          }
                          placeholder="e.g. EURUSD, NAS100"
                        />
                      </label>

                      <label className="block text-xs text-zinc-400">
                        Session
                        <input
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                          value={selectedModel.session}
                          onChange={(e) =>
                            updateModel(selectedModel.id, {
                              session: e.target.value,
                            })
                          }
                          placeholder="London, New York, Asia"
                        />
                      </label>

                      <label className="block text-xs text-zinc-400">
                        Risk per trade (%)
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                          value={selectedModel.riskPerTrade}
                          onChange={(e) =>
                            updateModel(selectedModel.id, {
                              riskPerTrade: Number(e.target.value),
                            })
                          }
                          min={0}
                          max={5}
                          step={0.1}
                        />
                      </label>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs text-zinc-400">
                        Description
                        <textarea
                          className="mt-1 h-20 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                          value={selectedModel.description}
                          onChange={(e) =>
                            updateModel(selectedModel.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Short overview of what this model does..."
                        />
                      </label>

                      <label className="block text-xs text-zinc-400">
                        Rules
                        <textarea
                          className="mt-1 h-28 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                          value={selectedModel.rules}
                          onChange={(e) =>
                            updateModel(selectedModel.id, {
                              rules: e.target.value,
                            })
                          }
                          placeholder="- HTF bias\n- Liquidity sweep\n- FVG entry\n- SL, TP..."
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block text-xs text-zinc-400">
                      Checklist (one per line)
                      <textarea
                        className="mt-1 h-24 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                        value={selectedModel.checklist.join("\n")}
                        onChange={(e) =>
                          handleChecklistChange(selectedModel.id, e.target.value)
                        }
                        placeholder={
                          "HTF bias confirmed?\nAsia low taken?\nFVG present?\nNews checked?"
                        }
                      />
                    </label>

                    <label className="block text-xs text-zinc-400">
                      Tags (comma separated)
                      <textarea
                        className="mt-1 h-24 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                        value={selectedModel.tags.join(", ")}
                        onChange={(e) =>
                          handleTagsChange(selectedModel.id, e.target.value)
                        }
                        placeholder="EURUSD, London, ICT, FVG"
                      />
                    </label>
                  </div>

                  {/* Source info */}
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-1">
                      <h3 className="text-xs font-semibold text-zinc-300">
                        YouTube reference
                      </h3>
                      <label className="block text-xs text-zinc-400">
                        Channel name
                        <input
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                          value={selectedModel.sourceChannel ?? ""}
                          onChange={(e) =>
                            updateModel(selectedModel.id, {
                              sourceChannel: e.target.value,
                            })
                          }
                          placeholder="e.g. Waqar Asim"
                        />
                      </label>
                      <label className="block text-xs text-zinc-400">
                        Video URL
                        <input
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                          value={selectedModel.sourceVideoUrl ?? ""}
                          onChange={(e) =>
                            updateModel(selectedModel.id, {
                              sourceVideoUrl: e.target.value,
                            })
                          }
                          placeholder="https://www.youtube.com/watch?v=..."
                        />
                      </label>
                      <label className="block text-xs text-zinc-400">
                        Video title
                        <input
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                          value={selectedModel.sourceVideoTitle ?? ""}
                          onChange={(e) =>
                            updateModel(selectedModel.id, {
                              sourceVideoTitle: e.target.value,
                            })
                          }
                          placeholder="e.g. London session liquidity sweep"
                        />
                      </label>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs text-zinc-400">
                        Important timestamps / notes
                        <textarea
                          className="mt-1 h-24 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none focus:border-emerald-500"
                          value={selectedModel.sourceTimestamps ?? ""}
                          onChange={(e) =>
                            updateModel(selectedModel.id, {
                              sourceTimestamps: e.target.value,
                            })
                          }
                          placeholder={
                            "01:30 - HTF bias explanation\n" +
                            "04:10 - Liquidity above previous high\n" +
                            "06:30 - FVG entry\n" +
                            "09:15 - TP at next high"
                          }
                        />
                      </label>
                    </div>
                  </div>
                </section>
              )}

              {/* QUIZ */}
              <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100">
                      🧠 Quiz yourself on this model
                    </h2>
                    <p className="text-[11px] text-zinc-500">
                      Use this after reading the learning flow to test recall of
                      rules, invalidation and risk.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={loadingQuiz}
                    className="rounded-md bg-sky-500 px-3 py-1 text-xs font-medium text-black disabled:cursor-not-allowed disabled:bg-sky-900"
                  >
                    {loadingQuiz ? "Generating…" : "Generate quiz"}
                  </button>
                </div>

                {quizError && (
                  <p className="mb-2 text-xs text-red-400">{quizError}</p>
                )}

                <div className="max-h-64 overflow-auto rounded-md border border-zinc-800 bg-black/40 p-3 text-xs leading-relaxed text-zinc-100">
                  {quiz && quiz.length > 0 ? (
                    <ol className="space-y-2 text-[11px]">
                      {quiz.map((item, idx) => (
                        <li key={idx}>
                          <p className="font-medium">
                            Q{idx + 1}. {item.question}
                          </p>
                          <p className="mt-1 text-zinc-400">
                            <span className="font-semibold text-emerald-400">
                              Answer:
                            </span>{" "}
                            {item.answer}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-[11px] text-zinc-500">
                      No quiz yet. Click <span className="font-semibold">Generate
                      quiz</span> to create 5–8 targeted questions for this
                      specific model.
                    </p>
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
