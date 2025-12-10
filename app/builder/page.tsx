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

  // AI Coach
  const [coachMode, setCoachMode] = useState<"explain" | "improve" | "examples">(
    "explain",
  );
  const [coachText, setCoachText] = useState<string | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);

  // Create model from YouTube video
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [creatingFromVideo, setCreatingFromVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Select first model by default
  useEffect(() => {
    if (!selectedModelId && models.length > 0) {
      setSelectedModelId(models[0].id);
    }
  }, [models, selectedModelId]);

  const selectedModel = models.find((m) => m.id === selectedModelId) || null;

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
      setCoachText(null);
      setVideoUrlInput("");
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
    setCoachText(null);
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
    setCoachText(null);
  };

  const handleDeleteModel = (id: string) => {
    setModels((prev) => prev.filter((m) => m.id !== id));
    if (selectedModelId === id) {
      setSelectedModelId(null);
      setQuiz(null);
      setCoachText(null);
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

  const handleAskCoach = async () => {
    if (!selectedModel) return;

    setLoadingCoach(true);
    setCoachError(null);

    try {
      const res = await fetch("/api/explain-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: coachMode,
          model: selectedModel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCoachError(data.error || "Something went wrong.");
        setCoachText(null);
        return;
      }

      setCoachText(data.text || "");
    } catch (err) {
      console.error(err);
      setCoachError("Failed to talk to AI coach.");
      setCoachText(null);
    } finally {
      setLoadingCoach(false);
    }
  };

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
                  setCoachText(null);
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

        {/* Right: Editor + AI */}
        <main className="flex-1 space-y-4">
          {!selectedModel ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">
              Select or create a model to start editing.
            </div>
          ) : (
            <>
              {/* Model Editor */}
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
                          updateModel(selectedModel.id, { style: e.target.value })
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
                          updateModel(selectedModel.id, { rules: e.target.value })
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

              {/* AI Zone: Quiz + Coach */}
              <section className="grid gap-4 md:grid-cols-2">
                {/* Quiz Card */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-lg">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-zinc-100">
                      🧠 Quiz Yourself
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
                        Click{" "}
                        <span className="font-medium text-zinc-300">
                          Generate Quiz
                        </span>{" "}
                        to test yourself on this model&apos;s rules, checklist and
                        risk management.
                      </p>
                    )}
                  </div>
                </div>

                {/* AI Coach Panel */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-lg">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-zinc-100">
                      🧑‍🏫 AI Coach
                    </h2>

                    <select
                      value={coachMode}
                      onChange={(e) =>
                        setCoachMode(
                          e.target.value as "explain" | "improve" | "examples",
                        )
                      }
                      className="rounded-md border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-100 outline-none"
                    >
                      <option value="explain">Explain this model</option>
                      <option value="improve">Suggest improvements</option>
                      <option value="examples">Example trade scenarios</option>
                    </select>
                  </div>

                  <button
                    onClick={handleAskCoach}
                    disabled={loadingCoach}
                    className="mb-3 w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-black disabled:cursor-not-allowed disabled:bg-emerald-900"
                  >
                    {loadingCoach ? "Thinking..." : "Ask AI Coach"}
                  </button>

                  {coachError && (
                    <p className="mb-2 text-xs text-red-400">{coachError}</p>
                  )}

                  <div className="max-h-64 overflow-auto rounded-md border border-zinc-800 bg-black/40 p-3 text-xs leading-relaxed text-zinc-100">
                    {coachText ? (
                      <pre className="whitespace-pre-wrap text-[11px]">
                        {coachText}
                      </pre>
                    ) : (
                      <p className="text-[11px] text-zinc-500">
                        Use{" "}
                        <span className="font-medium text-zinc-300">
                          Explain / Improve / Examples
                        </span>{" "}
                        to turn this model into a detailed study guide with
                        image references from the YouTube video.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
