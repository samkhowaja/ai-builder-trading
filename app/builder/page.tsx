// app/builder/page.tsx
"use client";

import React, { useEffect, useState } from "react";

type EntryModel = {
  id: string;
  name: string;
  style: string; // Scalping / Intraday / Swing
  timeframe: string; // M1, M5, M15, H1, H4, etc.
  instrument: string; // EURUSD, NAS100, etc.
  session: string; // London, New York, Asia, etc.
  riskPerTrade: number; // %
  description: string;
  rules: string;
  checklist: string[];
  tags: string[];

  // YouTube reference for learning
  sourceVideoUrl?: string;
  sourceVideoTitle?: string;
  sourceTimestamps?: string; // e.g. "01:30 - HTF bias\n04:10 - Liquidity above high"
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

const initialModels: EntryModel[] = [
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
  },
];

export default function BuilderPage() {
  const [models, setModels] = useState<EntryModel[]>(initialModels);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  // Quiz
  const [quiz, setQuiz] = useState<QuizItem[] | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Create model from YouTube video
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [creatingFromVideo, setCreatingFromVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Learn view
  const [viewMode, setViewMode] = useState<"learn" | "edit">("learn");
  const [guide, setGuide] = useState<ModelGuide | null>(null);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);

  // Select first model by default
  useEffect(() => {
    if (!selectedModelId && models.length > 0) {
      setSelectedModelId(models[0].id);
    }
  }, [models, selectedModelId]);

  const selectedModel = models.find((m) => m.id === selectedModelId) || null;

  // Fetch learning guide whenever selected model changes
  useEffect(() => {
    if (!selectedModel) {
      setGuide(null);
      return;
    }
    fetchGuide(selectedModel);
  }, [selectedModelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchGuide = async (model: EntryModel) => {
    setLoadingGuide(true);
    setGuideError(null);
    setGuide(null);

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

      setGuide(data.guide as ModelGuide);
    } catch (err) {
      console.error(err);
      setGuideError("Failed to contact learning guide API.");
    } finally {
      setLoadingGuide(false);
    }
  };

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
      setGuide(null);
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
    };
    setModels((prev) => [...prev, newModel]);
    setSelectedModelId(newModel.id);
    setQuiz(null);
    setGuide(null);
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
    setGuide(null);
    setViewMode("learn");
  };

  const handleDeleteModel = (id: string) => {
    setModels((prev) => prev.filter((m) => m.id !== id));
    if (selectedModelId === id) {
      setSelectedModelId(null);
      setQuiz(null);
      setGuide(null);
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

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row">
        {/* Left: Models list + create from video */}
        <aside className="w-full md:w-72">
          {/* Create from YouTube */}
          <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
            <p className="mb-2 font-semibold text-zinc-100">
              📺 Create Entry Model From YouTube
            </p>
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                className="flex-1 rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
                placeholder="Paste YouTube video URL"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
              />
              <button
                onClick={handleCreateModelFromVideo}
                disabled={creatingFromVideo || !videoUrlInput}
                className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-medium text-black disabled:cursor-not-allowed disabled:bg-emerald-900"
              >
                {creatingFromVideo ? "Analyzing..." : "Generate Model"}
              </button>
            </div>
            {videoError && (
              <p className="mt-2 text-[11px] text-red-400">{videoError}</p>
            )}
            <p className="mt-2 text-[11px] text-zinc-400">
              Start with Waqar&apos;s strategy videos. This will invent one
              clean entry model based on that video. Later you can refine
              details and timestamps.
            </p>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-sm font-semibold">AI Entry Models</h1>
            <button
              onClick={handleAddModel}
              className="rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-medium text-black"
            >
              + New
            </button>
          </div>

          <div className="space-y-2">
            {models.map((model) => (
              <div
                key={model.id}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-xs transition ${
                  model.id === selectedModelId
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600"
                }`}
                onClick={() => {
                  setSelectedModelId(model.id);
                  setQuiz(null);
                  setViewMode("learn");
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium line-clamp-2">{model.name}</p>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">
                  {model.style} • {model.timeframe} • {model.instrument}
                </p>
                {model.sourceVideoUrl && (
                  <p className="mt-1 text-[10px] text-zinc-500">
                    From video:{" "}
                    {model.sourceVideoTitle
                      ? model.sourceVideoTitle
                      : model.sourceVideoUrl}
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

            {models.length === 0 && (
              <p className="text-xs text-zinc-500">
                No models yet. Paste a YouTube video or click{" "}
                <span className="text-emerald-400">New</span> to create your
                first entry model.
              </p>
            )}
          </div>
        </aside>

        {/* Right: Learn view + Quiz + optional Edit */}
        <main className="flex-1 space-y-4">
          {!selectedModel ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">
              Select or create a model to start learning.
            </div>
          ) : (
            <>
              {/* Header: model summary + view mode toggle */}
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
                  {selectedModel.sourceVideoUrl && (
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Source video:{" "}
                      {selectedModel.sourceVideoTitle ||
                        selectedModel.sourceVideoUrl}
                    </p>
                  )}
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
                    📘 Learn Mode
                  </button>
                  <button
                    onClick={() => setViewMode("edit")}
                    className={`rounded-full px-3 py-1 font-medium ${
                      viewMode === "edit"
                        ? "bg-zinc-100 text-black"
                        : "bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    ✏️ Edit Model
                  </button>
                </div>
              </div>

              {/* Progress bar for learn flow */}
              {viewMode === "learn" && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    {["Overview", "Price Story", "Checklist", "When Not To Trade", "Screenshot Ideas", "Practice"].map(
                      (label, idx) => (
                        <div key={label} className="flex flex-1 items-center">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-black">
                            {idx + 1}
                          </div>
                          <span className="ml-1 hidden md:inline">
                            {label}
                          </span>
                          {idx < 5 && (
                            <div className="mx-1 h-px flex-1 bg-zinc-700" />
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Learn or Edit */}
              {viewMode === "learn" ? (
                <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-lg">
                  {loadingGuide && (
                    <p className="text-xs text-zinc-400">
                      Building your study guide...
                    </p>
                  )}
                  {guideError && (
                    <p className="text-xs text-red-400">{guideError}</p>
                  )}
                  {!loadingGuide && guide && (
                    <>
                      {/* OVERVIEW */}
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                          1. Overview – What this model is about
                        </h3>
                        {renderParagraphs(guide.overview)}
                      </div>

                      {/* STORY */}
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                          2. Step-by-step price story
                        </h3>
                        {renderParagraphs(guide.story)}
                      </div>

                      {/* CHECKLIST */}
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                          3. Rules checklist (before you click Buy/Sell)
                        </h3>
                        <ul className="space-y-1 text-[13px] text-zinc-200">
                          {guide.rulesChecklist.map((item, idx) => (
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

                      {/* INVALIDATION */}
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                          4. When NOT to trade this model
                        </h3>
                        {renderParagraphs(guide.invalidation)}
                      </div>

                      {/* SCREENSHOT IDEAS */}
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                          5. Screenshot & image references
                        </h3>
                        <p className="mb-2 text-[11px] text-zinc-400">
                          Use these as a checklist while watching the YouTube
                          video or replaying the chart. For each card, pause the
                          video and take a screenshot or recreate it in
                          TradingView.
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          {guide.screenshotIdeas.map((img, idx) => (
                            <div
                              key={idx}
                              className="flex flex-col rounded-lg border border-zinc-800 bg-black/40 p-3 text-[12px]"
                            >
                              <div className="mb-2 flex-1 rounded-md border border-dashed border-zinc-700 bg-zinc-900/60 p-4 text-center text-[11px] text-zinc-500">
                                Image placeholder
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

                      {/* PRACTICE STEPS */}
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                          6. Practice drills
                        </h3>
                        <ul className="space-y-1 text-[13px] text-zinc-200">
                          {guide.practiceSteps.map((step, idx) => (
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
                /* EDITOR MODE – same fields you had before */
                <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-lg">
                  <h2 className="mb-3 text-sm font-semibold text-zinc-100">
                    Model Editor
                  </h2>

                  <div className="grid gap-3 md:grid-cols-2">
                    {/* Left column: basic fields */}
                    <div className="space-y-2">
                      <label className="block text-xs text-zinc-400">
                        Name
                        <input
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
                          value={selectedModel.name}
                          onChange={(e) =>
                            updateModel(selectedModel.id, { name: e.target.value })
                          }
                        />
                      </label>

                      <label className="block text-xs text-zinc-400">
                        Style
                        <select
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
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
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
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
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
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
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
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
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
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

                    {/* Right column: description & rules */}
                    <div className="space-y-2">
                      <label className="block text-xs text-zinc-400">
                        Description
                        <textarea
                          className="mt-1 h-20 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
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
                          className="mt-1 h-28 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
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
                        className="mt-1 h-24 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
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
                        className="mt-1 h-24 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
                        value={selectedModel.tags.join(", ")}
                        onChange={(e) =>
                          handleTagsChange(selectedModel.id, e.target.value)
                        }
                        placeholder="EURUSD, London, ICT, FVG"
                      />
                    </label>
                  </div>

                  {/* YouTube reference section */}
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-1">
                      <h3 className="text-xs font-semibold text-zinc-300">
                        YouTube Reference
                      </h3>
                      <label className="block text-xs text-zinc-400">
                        Video URL
                        <input
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
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
                        Video Title
                        <input
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
                          value={selectedModel.sourceVideoTitle ?? ""}
                          onChange={(e) =>
                            updateModel(selectedModel.id, {
                              sourceVideoTitle: e.target.value,
                            })
                          }
                          placeholder="e.g. London session liquidity sweep strategy"
                        />
                      </label>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs text-zinc-400">
                        Important Timestamps / Notes
                        <textarea
                          className="mt-1 h-24 w-full rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs outline-none"
                          value={selectedModel.sourceTimestamps ?? ""}
                          onChange={(e) =>
                            updateModel(selectedModel.id, {
                              sourceTimestamps: e.target.value,
                            })
                          }
                          placeholder={
                            "01:30 - HTF bias explanation\n" +
                            "04:10 - Liquidity above previous high\n" +
                            "06:30 - Fair Value Gap entry\n" +
                            "09:15 - TP at next high"
                          }
                        />
                      </label>
                    </div>
                  </div>
                </section>
              )}

              {/* Quiz card (works for both modes) */}
              <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-lg">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-zinc-100">
                    🧠 Step 7 – Quiz Yourself
                  </h2>
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={loadingQuiz}
                    className="rounded-md bg-sky-500 px-3 py-1 text-xs font-medium text-black disabled:cursor-not-allowed disabled:bg-sky-900"
                  >
                    {loadingQuiz ? "Generating..." : "Generate Quiz"}
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
                      After reading the learning flow above, use this quiz to
                      check if you remember the rules, invalidation and
                      risk-management of this model.
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
