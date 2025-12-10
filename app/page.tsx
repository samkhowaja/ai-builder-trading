"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type TeacherType = "channel" | "playlist" | "video";

interface Project {
  id: string;
  name: string;
  teacher_type: string | null;
  source_url: string | null;
  created_at: string;
}

interface Model {
  id: string;
  project_id: string;
  name: string;
  category: string | null;
  timeframes: string | null;
  duration: string | null;
  description: string | null;
  created_at: string;
}

interface Video {
  id: string;
  project_id: string;
  title: string;
  url: string;
  notes: string | null;
  created_at: string;
}

type ModelCategory = "swing" | "intraday" | "scalping";

export default function Home() {
  // Workspaces / projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Workspace form
  const [workspaceName, setWorkspaceName] = useState("");
  const [teacherType, setTeacherType] = useState<TeacherType>("channel");
  const [sourceUrl, setSourceUrl] = useState("");

  // Entry models
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const [newModel, setNewModel] = useState<{
    name: string;
    category: ModelCategory;
    timeframes: string;
    duration: string;
    description: string;
  }>({
    name: "",
    category: "scalping",
    timeframes: "",
    duration: "",
    description: "",
  });

  // Study videos
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  const [newVideo, setNewVideo] = useState<{
    title: string;
    url: string;
    notes: string;
  }>({
    title: "",
    url: "",
    notes: "",
  });

  // AI study plan
  const [aiPlan, setAiPlan] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  // AI suggest-model-from-video
  const [suggestingFromVideoId, setSuggestingFromVideoId] = useState<
    string | null
  >(null);

  // AI quiz for one model
  const [quizModelId, setQuizModelId] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<
    { question: string; answer: string }[] | null
  >(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  const currentProject =
    projects.find((p) => p.id === currentProjectId) || null;

  // ---------- helpers to load data ----------

  const loadModels = async (projectId: string) => {
    setLoadingModels(true);
    try {
      const { data, error } = await supabase
        .from("models")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("loadModels error:", error);
        setModels([]);
        return;
      }
      setModels(data || []);
    } finally {
      setLoadingModels(false);
    }
  };

  const loadVideos = async (projectId: string) => {
    setLoadingVideos(true);
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("loadVideos error:", error);
        setVideos([]);
        return;
      }
      setVideos(data || []);
    } finally {
      setLoadingVideos(false);
    }
  };

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("loadProjects error:", error);
        setProjects([]);
        return;
      }

      const list = data || [];
      setProjects(list);

      if (!currentProjectId && list.length > 0) {
        setCurrentProjectId(list[0].id);
      }
    } finally {
      setLoadingProjects(false);
    }
  };

  // ---------- effects ----------

  // Initial load of projects, then models/videos for first project
  useEffect(() => {
    const init = async () => {
      await loadProjects();
    };
    init();
  }, []);

  // When current project changes, sync form + load its models / videos
  useEffect(() => {
    if (!currentProjectId) {
      setWorkspaceName("");
      setSourceUrl("");
      setModels([]);
      setVideos([]);
      return;
    }

    const p = projects.find((x) => x.id === currentProjectId);
    if (p) {
      setWorkspaceName(p.name || "");
      setSourceUrl(p.source_url || "");
      const tt = (p.teacher_type || "channel") as TeacherType;
      setTeacherType(
        tt === "channel" || tt === "playlist" || tt === "video"
          ? tt
          : "channel"
      );
    }

    loadModels(currentProjectId);
    loadVideos(currentProjectId);
  }, [currentProjectId, projects]);

  // Default quiz model to first model
  useEffect(() => {
    if (!quizModelId && models.length > 0) {
      setQuizModelId(models[0].id);
    }
  }, [models, quizModelId]);

  // ---------- workspace actions ----------

  const handleProjectChange = (id: string) => {
    setCurrentProjectId(id || null);
    setAiPlan(null);
    setQuiz(null);
  };

  const handleSaveWorkspace = async () => {
    const trimmedName = workspaceName.trim();
    const trimmedUrl = sourceUrl.trim();

    if (!trimmedName) {
      alert("Workspace name is required.");
      return;
    }

    const payload = {
      name: trimmedName,
      teacher_type: teacherType,
      source_url: trimmedUrl || null,
    };

    try {
      if (currentProjectId) {
        const { data, error } = await supabase
          .from("projects")
          .update(payload)
          .eq("id", currentProjectId)
          .select()
          .single();

        if (error) {
          console.error("update project error:", error);
          alert("Failed to update workspace.");
          return;
        }

        setProjects((prev) =>
          prev.map((p) => (p.id === data.id ? (data as Project) : p))
        );
      } else {
        const { data, error } = await supabase
          .from("projects")
          .insert(payload)
          .select()
          .single();

        if (error || !data) {
          console.error("insert project error:", error);
          alert("Failed to create workspace.");
          return;
        }

        setProjects((prev) => [...prev, data as Project]);
        setCurrentProjectId(data.id);
      }

      alert("Workspace saved.");
    } catch (err) {
      console.error("save workspace exception:", err);
      alert("Unexpected error while saving workspace.");
    }
  };

  const handleCreateNewWorkspace = () => {
    setCurrentProjectId(null);
    setWorkspaceName("");
    setTeacherType("channel");
    setSourceUrl("");
    setModels([]);
    setVideos([]);
    setAiPlan(null);
    setQuiz(null);
  };

  // ---------- model actions ----------

  const handleAddModel = async () => {
    if (!currentProjectId) {
      alert("Select or create a workspace first.");
      return;
    }

    const name = newModel.name.trim();
    if (!name) {
      alert("Model name is required.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("models")
        .insert({
          project_id: currentProjectId,
          name,
          category: newModel.category,
          timeframes: newModel.timeframes.trim() || null,
          duration: newModel.duration.trim() || null,
          description: newModel.description.trim() || null,
        })
        .select()
        .single();

      if (error || !data) {
        console.error("insert model error:", error);
        alert("Failed to add entry model.");
        return;
      }

      setModels((prev) => [...prev, data as Model]);
      setNewModel({
        name: "",
        category: newModel.category,
        timeframes: "",
        duration: "",
        description: "",
      });
    } catch (err) {
      console.error("add model exception:", err);
      alert("Unexpected error while adding model.");
    }
  };

  const handleDeleteModel = async (id: string) => {
    if (!confirm("Delete this entry model?")) return;
    try {
      const { error } = await supabase.from("models").delete().eq("id", id);
      if (error) {
        console.error("delete model error:", error);
        alert("Failed to delete model.");
        return;
      }
      setModels((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("delete model exception:", err);
      alert("Unexpected error while deleting model.");
    }
  };

  // ---------- video actions ----------

  const handleAddVideo = async () => {
    if (!currentProjectId) {
      alert("Select or create a workspace first.");
      return;
    }

    const title = newVideo.title.trim();
    const url = newVideo.url.trim();

    if (!title || !url) {
      alert("Video title and URL are required.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("videos")
        .insert({
          project_id: currentProjectId,
          title,
          url,
          notes: newVideo.notes.trim() || null,
        })
        .select()
        .single();

      if (error || !data) {
        console.error("insert video error:", error);
        alert("Failed to add study video.");
        return;
      }

      setVideos((prev) => [...prev, data as Video]);
      setNewVideo({ title: "", url: "", notes: "" });
    } catch (err) {
      console.error("add video exception:", err);
      alert("Unexpected error while adding video.");
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm("Delete this study video?")) return;
    try {
      const { error } = await supabase.from("videos").delete().eq("id", id);
      if (error) {
        console.error("delete video error:", error);
        alert("Failed to delete video.");
        return;
      }
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      console.error("delete video exception:", err);
      alert("Unexpected error while deleting video.");
    }
  };

  // ---------- AI: study plan ----------

  const generateStudyPlan = async () => {
    if (!currentProjectId) {
      alert("Select a workspace first.");
      return;
    }

    setLoadingPlan(true);
    setAiPlan(null);

    try {
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: currentProjectId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("study plan error:", data);
        alert("Failed to generate study plan.");
        setLoadingPlan(false);
        return;
      }

      const data = await res.json();
      setAiPlan(data.plan || "");
    } catch (err) {
      console.error("study plan fetch error:", err);
      alert("Network error while generating study plan.");
    } finally {
      setLoadingPlan(false);
    }
  };

  // ---------- AI: suggest model from video ----------

  const suggestModelFromVideo = async (video: Video) => {
    if (!video.id) return;
    setSuggestingFromVideoId(video.id);

    try {
      const res = await fetch("/api/suggest-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Suggest model error:", data);
        alert("Failed to suggest model from this video.");
        setSuggestingFromVideoId(null);
        return;
      }

      const data = await res.json();
      const s = data.suggestion || {};

      const overview: string =
        s.overview ||
        s.description ||
        video.notes ||
        "Entry model derived from the study video.";

      const entryRules: string[] = Array.isArray(s.entry_rules)
        ? s.entry_rules
        : [];
      const stopRules: string[] = Array.isArray(s.stop_rules)
        ? s.stop_rules
        : [];
      const tpRules: string[] = Array.isArray(s.tp_rules) ? s.tp_rules : [];

      const lines: string[] = [];
      lines.push(overview.trim());

      if (entryRules.length > 0) {
        lines.push(
          "Entry checklist:",
          ...entryRules.map((r: string) => `- ${r.trim()}`)
        );
      }

      if (stopRules.length > 0) {
        lines.push(
          "Stop-loss rules:",
          ...stopRules.map((r: string) => `- ${r.trim()}`)
        );
      }

      if (tpRules.length > 0) {
        lines.push(
          "Take-profit rules:",
          ...tpRules.map((r: string) => `- ${r.trim()}`)
        );
      }

      const finalDescription = lines.join("\n\n");

      const category: ModelCategory =
        s.category === "swing" ||
        s.category === "intraday" ||
        s.category === "scalping"
          ? s.category
          : "scalping";

      setNewModel({
        name: s.name || video.title,
        category,
        timeframes: s.timeframes || "",
        duration: s.duration || "",
        description: finalDescription,
      });

      const formEl = document.getElementById("entry-model-form");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (err) {
      console.error("Suggest model fetch error:", err);
      alert("Network error while suggesting model.");
    } finally {
      setSuggestingFromVideoId(null);
    }
  };

  // ---------- AI: quiz for one model ----------

  const generateQuizForModel = async () => {
    if (!quizModelId) {
      alert("Select an entry model first.");
      return;
    }

    setLoadingQuiz(true);
    setQuiz(null);

    try {
      const res = await fetch("/api/quiz-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: quizModelId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Quiz error:", data);
        alert("Failed to generate quiz for this model.");
        setLoadingQuiz(false);
        return;
      }

      const data = await res.json();
      setQuiz(data.questions || []);
    } catch (err) {
      console.error("Quiz fetch error:", err);
      alert("Network error while generating quiz.");
    } finally {
      setLoadingQuiz(false);
    }
  };

  // ---------- render ----------

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold">
              AI Builder – Entry Model Lab
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              One workspace per mentor/strategy. Build clean entry models and
              study plans from their YouTube content.
            </p>
          </div>
          <button
            onClick={handleCreateNewWorkspace}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs hover:bg-slate-800"
          >
            + New workspace
          </button>
        </header>

        {/* WORKSPACE / TEACHER */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs text-slate-400">Workspace</span>
                <select
                  className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500 min-w-[200px]"
                  value={currentProjectId || ""}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  disabled={loadingProjects || projects.length === 0}
                >
                  {projects.length === 0 && (
                    <option value="">No workspaces yet</option>
                  )}
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-300">
                  Workspace name
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. Waqar Asim EURUSD Entry Models"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <span className="text-xs text-slate-300">Teacher type</span>
                <div className="inline-flex rounded-xl bg-slate-950 border border-slate-700 p-1 text-[11px]">
                  {(["channel", "playlist", "video"] as TeacherType[]).map(
                    (t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTeacherType(t)}
                        className={`px-3 py-1 rounded-lg ${
                          teacherType === t
                            ? "bg-emerald-500 text-slate-950"
                            : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        {t === "channel"
                          ? "YouTube channel"
                          : t === "playlist"
                          ? "Playlist"
                          : "Single video"}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-300 flex items-center gap-1">
                  YouTube source URL
                  <span className="text-[10px] text-slate-500">
                    (channel / playlist / video)
                  </span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="https://youtube.com/@waqarasim"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />
                <p className="text-[11px] text-slate-500">
                  Later we&apos;ll auto-pull videos from here. Right now it&apos;s
                  just metadata for this workspace.
                </p>
              </div>
            </div>

            <div className="w-full sm:w-48 flex sm:flex-col gap-2">
              <button
                onClick={handleSaveWorkspace}
                className="flex-1 rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold px-4 py-2 hover:bg-emerald-400 transition"
              >
                Save workspace
              </button>
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6 items-start">
          {/* ENTRY MODELS */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Entry models</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Each model is one repeatable setup you want to master.
                </p>
              </div>
            </div>

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {loadingModels && (
                <p className="text-xs text-slate-400">Loading entry models…</p>
              )}
              {!loadingModels && models.length === 0 && (
                <p className="text-xs text-slate-500">
                  No entry models yet. Use the form on the right or AI
                  suggestions from videos below.
                </p>
              )}
              {models.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold">{m.name}</h3>
                      <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-slate-400">
                        {m.category && (
                          <span className="rounded-full border border-slate-700 px-2 py-0.5">
                            {m.category.toUpperCase()}
                          </span>
                        )}
                        {m.timeframes && (
                          <span className="rounded-full bg-slate-900 px-2 py-0.5">
                            TF: {m.timeframes}
                          </span>
                        )}
                        {m.duration && (
                          <span className="rounded-full bg-slate-900 px-2 py-0.5">
                            Hold: {m.duration}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteModel(m.id)}
                      className="rounded-full bg-red-500/10 text-red-400 text-[10px] px-2 py-1 hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </div>
                  {m.description && (
                    <p className="text-[11px] text-slate-300 whitespace-pre-wrap mt-1">
                      {m.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ADD ENTRY MODEL FORM */}
          <section
            id="entry-model-form"
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-3"
          >
            <h2 className="text-lg font-semibold">Add entry model</h2>
            <p className="text-[11px] text-slate-400">
              You can type this manually or click &quot;Suggest model&quot; on a
              study video to auto-fill from AI.
            </p>

            <div className="space-y-2">
              <label className="text-xs text-slate-300">Model name</label>
              <input
                type="text"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="e.g. London range sweep + NY FVG"
                value={newModel.name}
                onChange={(e) =>
                  setNewModel((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs text-slate-300">Category</label>
                <select
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  value={newModel.category}
                  onChange={(e) =>
                    setNewModel((prev) => ({
                      ...prev,
                      category: e.target.value as ModelCategory,
                    }))
                  }
                >
                  <option value="swing">Swing</option>
                  <option value="intraday">Intraday</option>
                  <option value="scalping">Scalping</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-300">Timeframes</label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. H4, H1 or M15, M5"
                  value={newModel.timeframes}
                  onChange={(e) =>
                    setNewModel((prev) => ({
                      ...prev,
                      timeframes: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-300">Typical hold time</label>
              <input
                type="text"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="e.g. 1–3 days, 2–6 hours, 5–30 minutes…"
                value={newModel.duration}
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
                Description (overview + rules)
              </label>
              <textarea
                className="w-full min-h-[120px] rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Overview + entry checklist + SL/TP rules. AI will suggest this when you use “Suggest model”."
                value={newModel.description}
                onChange={(e) =>
                  setNewModel((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <button
              onClick={handleAddModel}
              disabled={!currentProjectId}
              className="mt-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold px-4 py-2 hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Add entry model
            </button>
          </section>
        </div>

        {/* STUDY VIDEOS + AI COACH */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-6">
          {/* Study videos list + add form */}
          <div className="grid lg:grid-cols-2 gap-4 lg:gap-6 items-start">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Study videos</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Videos you want to study for this workspace. AI uses these
                    to suggest models and training plans.
                  </p>
                </div>
              </div>

              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {loadingVideos && (
                  <p className="text-xs text-slate-400">Loading videos…</p>
                )}
                {!loadingVideos && videos.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No study videos yet. Add one on the right.
                  </p>
                )}
                {videos.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold">{v.title}</h3>
                        <p className="text-[11px] text-slate-500 truncate">
                          {v.url}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 text-[10px]">
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700 text-center"
                        >
                          Open on YouTube
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteVideo(v.id)}
                          className="rounded-full bg-red-500/10 text-red-400 px-3 py-1 hover:bg-red-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {v.notes && (
                      <p className="text-[11px] text-slate-300">
                        {v.notes}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => suggestModelFromVideo(v)}
                      disabled={suggestingFromVideoId === v.id}
                      className="rounded-xl bg-sky-500 text-slate-950 text-[11px] font-semibold px-3 py-1.5 hover:bg-sky-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {suggestingFromVideoId === v.id
                        ? "Suggesting…"
                        : "Suggest model"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add study video form */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Add study video</h3>
              <div className="space-y-2">
                <label className="text-xs text-slate-300">Video title</label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. My exact 1-minute scalping strategy"
                  value={newVideo.title}
                  onChange={(e) =>
                    setNewVideo((prev) => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-300">YouTube URL</label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={newVideo.url}
                  onChange={(e) =>
                    setNewVideo((prev) => ({ ...prev, url: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-300">
                  Notes (what you want to learn)
                </label>
                <textarea
                  className="w-full min-h-[80px] rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. focus on how he builds bias on H4/H1 and executes on M1."
                  value={newVideo.notes}
                  onChange={(e) =>
                    setNewVideo((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>

              <button
                onClick={handleAddVideo}
                disabled={!currentProjectId}
                className="mt-1 rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold px-4 py-2 hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Add study video
              </button>
            </div>
          </div>

          {/* AI STUDY COACH + QUIZ */}
          <div className="space-y-4">
            {/* Study plan */}
            <section className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">AI study coach</h2>
                  <p className="text-[11px] text-slate-400">
                    Let AI look at your current entry models and study videos
                    and suggest a short training plan.
                  </p>
                </div>
                <button
                  onClick={generateStudyPlan}
                  disabled={loadingPlan || !currentProjectId}
                  className="rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold px-4 py-1.5 hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingPlan ? "Thinking…" : "Generate study plan"}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 min-h-[100px]">
                {loadingPlan && (
                  <p className="text-xs text-slate-400">Talking to AI…</p>
                )}
                {!loadingPlan && !aiPlan && (
                  <p className="text-xs text-slate-500">
                    Click &quot;Generate study plan&quot; after you have at
                    least 1 entry model and 1 study video in this workspace.
                  </p>
                )}
                {!loadingPlan && aiPlan && (
                  <pre className="text-xs whitespace-pre-wrap font-mono text-slate-100">
                    {aiPlan}
                  </pre>
                )}
              </div>
            </section>

            {/* Quiz */}
            <section className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">
                    Practice mode – quiz on one entry model
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Pick a model and let AI ask you ICT/SMC questions so you
                    can test how well you really understand it.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500 min-w-[180px]"
                    value={quizModelId || ""}
                    onChange={(e) =>
                      setQuizModelId(e.target.value || null)
                    }
                    disabled={models.length === 0}
                  >
                    {models.length === 0 && (
                      <option value="">No models yet</option>
                    )}
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={generateQuizForModel}
                    disabled={loadingQuiz || models.length === 0 || !quizModelId}
                    className="rounded-xl bg-sky-500 text-slate-950 text-xs font-semibold px-4 py-2 hover:bg-sky-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loadingQuiz ? "Generating quiz…" : "Generate quiz"}
                  </button>
                </div>
              </div>

              <div className="mt-2 space-y-2">
                {loadingQuiz && (
                  <p className="text-xs text-slate-400">Asking questions…</p>
                )}

                {!loadingQuiz && !quiz && (
                  <p className="text-xs text-slate-500">
                    Select a model and generate a quiz to test yourself.
                  </p>
                )}

                {!loadingQuiz && quiz && quiz.length === 0 && (
                  <p className="text-xs text-slate-400">
                    No questions returned. Try again or pick another model.
                  </p>
                )}

                {!loadingQuiz && quiz && quiz.length > 0 && (
                  <ul className="space-y-3">
                    {quiz.map((q, idx) => (
                      <li
                        key={idx}
                        className="rounded-xl bg-slate-950 border border-slate-800 p-3"
                      >
                        <p className="text-xs font-semibold text-slate-100 mb-1">
                          Q{idx + 1}. {q.question}
                        </p>
                        <details className="text-xs text-slate-300">
                          <summary className="cursor-pointer text-slate-400">
                            Show answer
                          </summary>
                          <p className="mt-1 whitespace-pre-wrap">
                            {q.answer || "No answer provided."}
                          </p>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </section>

        <footer className="text-[10px] text-slate-500 text-center pb-6">
          Later steps: AI will auto-read this workspace, pull videos from
          YouTube, detect entry models automatically, and turn this into an
          interactive learning coach.
        </footer>
      </div>
    </main>
  );
}
