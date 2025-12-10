"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type ModelProfile = {
  id: string;
  name: string;
  category: "swing" | "intraday" | "scalping";
  timeframes: string;
  duration: string;
  description: string | null;
};

export default function Home() {
  const [projectName, setProjectName] = useState(
    "Waqar Asim EURUSD Entry Models"
  );
  const [teacherType, setTeacherType] = useState<
    "channel" | "playlist" | "video"
  >("channel");
  const [sourceUrl, setSourceUrl] = useState("https://youtube.com/@waqarasim");

  const [models, setModels] = useState<ModelProfile[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [savingModel, setSavingModel] = useState(false);

  const [newModel, setNewModel] = useState<Partial<ModelProfile>>({
    category: "scalping",
  });

  // Load models from Supabase on first render
  useEffect(() => {
    const loadModels = async () => {
      setLoadingModels(true);
      const { data, error } = await supabase
        .from("models")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading models:", error);
      } else if (data) {
        setModels(
          data.map((row: any) => ({
            id: row.id,
            name: row.name,
            category: row.category,
            timeframes: row.timeframes,
            duration: row.duration,
            description: row.description,
          }))
        );
      }
      setLoadingModels(false);
    };

    loadModels();
  }, []);

  const addModel = async () => {
    if (!newModel.name || !newModel.timeframes || !newModel.duration) return;

    setSavingModel(true);

    const { data, error } = await supabase
      .from("models")
      .insert({
        name: newModel.name,
        category: newModel.category || "scalping",
        timeframes: newModel.timeframes,
        duration: newModel.duration,
        description: newModel.description ?? null,
      })
      .select()
      .single();

    if (error) {
      alert("Supabase insert error:\n" + JSON.stringify(error, null, 2));
      console.error("Error saving model:", error);
    } else if (data) {
      const saved: ModelProfile = {
        id: data.id,
        name: data.name,
        category: data.category,
        timeframes: data.timeframes,
        duration: data.duration,
        description: data.description,
      };
      setModels((prev) => [saved, ...prev]);
      setNewModel({ category: "scalping" });
    }

    setSavingModel(false);
  };

  const deleteModel = async (id: string) => {
    const confirmed = confirm("Delete this model?");
    if (!confirmed) return;

    const { error } = await supabase.from("models").delete().eq("id", id);

    if (error) {
      alert("Supabase delete error:\n" + JSON.stringify(error, null, 2));
      console.error("Error deleting model:", error);
      return;
    }

    setModels((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-semibold">
            AI Builder – Entry Model Lab
          </h1>
          <span className="text-xs sm:text-sm text-slate-400">
            v0.2 – Supabase connected
          </span>
        </header>

        {/* Project & Teacher */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold mb-1">Project &amp; Teacher</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Project name</label>
              <input
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-300">Teacher type</label>
              <div className="flex gap-2 text-xs sm:text-sm">
                <button
                  onClick={() => setTeacherType("channel")}
                  className={`flex-1 rounded-xl border px-2 py-2 ${
                    teacherType === "channel"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-950"
                  }`}
                >
                  YouTube Channel
                </button>
                <button
                  onClick={() => setTeacherType("playlist")}
                  className={`flex-1 rounded-xl border px-2 py-2 ${
                    teacherType === "playlist"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-950"
                  }`}
                >
                  Playlist
                </button>
                <button
                  onClick={() => setTeacherType("video")}
                  className={`flex-1 rounded-xl border px-2 py-2 ${
                    teacherType === "video"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-950"
                  }`}
                >
                  Single Video
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-300">
              {teacherType === "channel"
                ? "Channel URL"
                : teacherType === "playlist"
                ? "Playlist URL"
                : "Video URL"}
            </label>
            <input
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Later we&apos;ll connect this to YouTube API to fetch videos and
              detect entry models automatically.
            </p>
          </div>
        </section>

        {/* Model Profiles */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-lg font-semibold">Model Profiles</h2>
            <span className="text-xs text-slate-400">
              Stored in Supabase (shared across devices)
            </span>
          </div>

          <div className="grid md:grid-cols-[2fr,1.3fr] gap-4">
            {/* Existing models list */}
            <div className="space-y-3">
              {loadingModels ? (
                <p className="text-xs text-slate-400">Loading models...</p>
              ) : models.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No models yet. Add one on the right.
                </p>
              ) : (
                models.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm sm:text-base">
                          {m.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                          {m.category}
                        </span>
                        <button
                          onClick={() => deleteModel(m.id)}
                          className="text-[10px] px-2 py-1 rounded-full border border-red-500/60 text-red-300 hover:bg-red-500/10 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                      <span className="px-2 py-1 rounded-full bg-slate-900 border border-slate-800">
                        TF: {m.timeframes}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-900 border border-slate-800">
                        Hold: {m.duration}
                      </span>
                    </div>
                    {m.description && (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {m.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add new model form */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4 space-y-3">
              <h3 className="font-medium text-sm sm:text-base">
                Add new model
              </h3>

              <div className="space-y-2">
                <label className="text-xs text-slate-300">Name</label>
                <input
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. Asia range sweep + NY FVG"
                  value={newModel.name || ""}
                  onChange={(e) =>
                    setNewModel((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-300">Category</label>
                <select
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  value={newModel.category || "scalping"}
                  onChange={(e) =>
                    setNewModel((prev) => ({
                      ...prev,
                      category: e.target.value as
                        | "swing"
                        | "intraday"
                        | "scalping",
                    }))
                  }
                >
                  <option value="swing">Swing</option>
                  <option value="intraday">Intraday</option>
                  <option value="scalping">Scalping</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-300">
                  Timeframes (text)
                </label>
                <input
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="H4, H1 or M15, M5"
                  value={newModel.timeframes || ""}
                  onChange={(e) =>
                    setNewModel((prev) => ({
                      ...prev,
                      timeframes: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-300">
                  Typical duration
                </label>
                <input
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. 1–3 days, 2–6 hours…"
                  value={newModel.duration || ""}
                  onChange={(e) =>
                    setNewModel((prev) => ({
                      ...prev,
                      duration: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-300">
                  Description (optional)
                </label>
                <textarea
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500 min-h-[70px]"
                  placeholder="Summarize the entry logic in your own words"
                  value={newModel.description || ""}
                  onChange={(e) =>
                    setNewModel((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>

              <button
                onClick={addModel}
                disabled={savingModel}
                className="w-full rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold py-2 mt-1 hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingModel ? "Saving..." : "Add model"}
              </button>
            </div>
          </div>
        </section>

        <footer className="text-xs text-slate-500 text-center pb-4">
          Next steps: add projects table + YouTube ingestion.
        </footer>
      </div>
    </main>
  );
}
