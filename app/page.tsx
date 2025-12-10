"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type TeacherType = "channel" | "playlist" | "video";

type Project = {
  id: string;
  name: string;
  teacher_type: TeacherType;
  source_url: string;
};

type ModelProfile = {
  id: string;
  project_id: string;
  name: string;
  category: "swing" | "intraday" | "scalping";
  timeframes: string;
  duration: string;
  description: string | null;
};

type Video = {
  id: string;
  project_id: string;
  title: string;
  youtube_id: string;
  url: string;
  notes: string | null;
};

type LabelProps = { text: string; hint: string };

// Small label + "?" hint icon
function FieldLabel({ text, hint }: LabelProps) {
  return (
    <div className="flex items-center gap-1 text-xs text-slate-300">
      <span>{text}</span>
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 text-[10px] text-slate-400 cursor-help"
        title={hint}
      >
        ?
      </span>
    </div>
  );
}

// Extract YouTube video ID from pretty much any YouTube URL
const extractYouTubeId = (url: string): string | null => {
  try {
    const u = new URL(url.trim());

    // Standard watch URL: ?v=ID
    const vParam = u.searchParams.get("v");
    if (vParam) return vParam;

    // Short URL: youtu.be/ID
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "");
    }

    // Shorts or live: /shorts/ID /live/ID
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && (parts[0] === "shorts" || parts[0] === "live")) {
      return parts[1];
    }

    return null;
  } catch {
    return null;
  }
};

export default function Home() {
  // Workspaces (projects)
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Workspace form fields
  const [projectName, setProjectName] = useState("");
  const [teacherType, setTeacherType] = useState<TeacherType>("channel");
  const [sourceUrl, setSourceUrl] = useState("");

  // Models + videos
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(true);

  // Saving flags
  const [savingProject, setSavingProject] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [savingVideo, setSavingVideo] = useState(false);

  // New model form
  const [newModel, setNewModel] = useState<Partial<ModelProfile>>({
    category: "scalping",
  });

  // New video form
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

  const currentProject =
    projects.find((p) => p.id === currentProjectId) || null;

  // ---------- load helpers ----------

  const loadModelsForProject = async (projectId: string) => {
    setLoadingModels(true);
    const { data, error } = await supabase
      .from("models")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading models:", error);
      setModels([]);
    } else if (data) {
      setModels(
        data.map((row: any) => ({
          id: row.id,
          project_id: row.project_id,
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

  const loadVideosForProject = async (projectId: string) => {
    setLoadingVideos(true);
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading videos:", error);
      setVideos([]);
    } else if (data) {
      setVideos(
        data.map((row: any) => ({
          id: row.id,
          project_id: row.project_id,
          title: row.title,
          youtube_id: row.youtube_id,
          url: row.url,
          notes: row.notes,
        }))
      );
    }
    setLoadingVideos(false);
  };

  // ---------- initial load ----------

  useEffect(() => {
    const init = async () => {
      try {
        setLoadingModels(true);
        setLoadingVideos(true);

        const { data: projectsData, error: projError } = await supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: true });

        if (projError) {
          console.error("Error loading projects:", projError);
          return;
        }

        let list: Project[] = (projectsData as Project[]) || [];
        let current: Project | null = list[0] || null;

        // If no workspace yet, create default Waqar one
        if (!current) {
          const { data: inserted, error: insertError } = await supabase
            .from("projects")
            .insert({
              name: "Waqar Asim EURUSD Entry Models",
              teacher_type: "channel",
              source_url: "https://youtube.com/@waqarasim",
            })
            .select()
            .single();

          if (insertError) {
            console.error("Error creating default project:", insertError);
            return;
          }

          current = inserted as Project;
          list = [current];
        }

        setProjects(list);
        setCurrentProjectId(current.id);
        setProjectName(current.name);
        setTeacherType(current.teacher_type);
        setSourceUrl(current.source_url);

        await loadModelsForProject(current.id);
        await loadVideosForProject(current.id);
      } finally {
        setLoadingModels(false);
        setLoadingVideos(false);
      }
    };

    init();
  }, []);

  // ---------- workspace actions ----------

  const handleProjectChange = async (projectId: string) => {
    setCurrentProjectId(projectId);
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      setProjectName(proj.name);
      setTeacherType(proj.teacher_type);
      setSourceUrl(proj.source_url);
    }
    await loadModelsForProject(projectId);
    await loadVideosForProject(projectId);
    setAiPlan(null); // reset AI plan when switching
  };

  const createProject = async () => {
    setSavingProject(true);
    const defaultName = `New Teacher ${projects.length + 1}`;
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: defaultName,
        teacher_type: "channel",
        source_url: "",
      })
      .select()
      .single();

    if (error) {
      alert("Supabase project insert error:\n" + JSON.stringify(error, null, 2));
      console.error("Error creating project:", error);
      setSavingProject(false);
      return;
    }

    const inserted = data as Project;
    setProjects((prev) => [...prev, inserted]);
    setCurrentProjectId(inserted.id);
    setProjectName(inserted.name);
    setTeacherType(inserted.teacher_type);
    setSourceUrl(inserted.source_url);
    setModels([]);
    setVideos([]);
    setAiPlan(null);
    setSavingProject(false);
  };

  const saveProjectDetails = async () => {
    if (!currentProject) return;
    setSavingProject(true);

    const { data, error } = await supabase
      .from("projects")
      .update({
        name: projectName,
        teacher_type: teacherType,
        source_url: sourceUrl,
      })
      .eq("id", currentProject.id)
      .select()
      .single();

    if (error) {
      alert("Supabase project update error:\n" + JSON.stringify(error, null, 2));
      console.error("Error updating project:", error);
      setSavingProject(false);
      return;
    }

    const updated = data as Project;
    setProjects((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
    setSavingProject(false);
  };

  const deleteCurrentProject = async () => {
    if (!currentProject) return;

    if (projects.length <= 1) {
      alert("Keep at least one workspace. Create another one first.");
      return;
    }

    const confirmed = confirm(
      `Delete workspace "${currentProject.name}" and everything inside it?`
    );
    if (!confirmed) return;

    setSavingProject(true);

    const { error: projError } = await supabase
      .from("projects")
      .delete()
      .eq("id", currentProject.id);

    if (projError) {
      alert(
        "Supabase project delete error:\n" + JSON.stringify(projError, null, 2)
      );
      console.error("Error deleting project:", projError);
      setSavingProject(false);
      return;
    }

    const remaining = projects.filter((p) => p.id !== currentProject.id);
    setProjects(remaining);

    const next = remaining[0] || null;
    if (next) {
      setCurrentProjectId(next.id);
      setProjectName(next.name);
      setTeacherType(next.teacher_type);
      setSourceUrl(next.source_url);
      await loadModelsForProject(next.id);
      await loadVideosForProject(next.id);
    } else {
      setCurrentProjectId(null);
      setProjectName("");
      setTeacherType("channel");
      setSourceUrl("");
      setModels([]);
      setVideos([]);
    }

    setAiPlan(null);
    setSavingProject(false);
  };

  // ---------- model actions ----------

  const addModel = async () => {
    if (!currentProject) {
      alert("Workspace not loaded yet. Please wait and try again.");
      return;
    }

    if (!newModel.name || !newModel.timeframes || !newModel.duration) {
      alert("Fill in name, timeframes and duration for the model.");
      return;
    }

    setSavingModel(true);

    const { data, error } = await supabase
      .from("models")
      .insert({
        project_id: currentProject.id,
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
        project_id: data.project_id,
        name: data.name,
        category: data.category,
        timeframes: data.timeframes,
        duration: data.duration,
        description: data.description,
      };
      setModels((prev) => [saved, ...prev]);
      setNewModel({ category: "scalping" });
      setAiPlan(null);
    }

    setSavingModel(false);
  };

  const deleteModel = async (id: string) => {
    const confirmed = confirm("Delete this entry model?");
    if (!confirmed) return;

    const { error } = await supabase.from("models").delete().eq("id", id);

    if (error) {
      alert("Supabase delete error:\n" + JSON.stringify(error, null, 2));
      console.error("Error deleting model:", error);
      return;
    }

    setModels((prev) => prev.filter((m) => m.id !== id));
    setAiPlan(null);
  };

  // ---------- video actions ----------

  const addVideo = async () => {
    if (!currentProject) {
      alert("Workspace not loaded yet. Please wait and try again.");
      return;
    }

    if (!newVideo.title.trim() || !newVideo.url.trim()) {
      alert("Fill in title and YouTube URL.");
      return;
    }

    const youtubeId = extractYouTubeId(newVideo.url);
    if (!youtubeId) {
      alert("Could not detect YouTube video ID. Please check the URL.");
      return;
    }

    setSavingVideo(true);

    const { data, error } = await supabase
      .from("videos")
      .insert({
        project_id: currentProject.id,
        title: newVideo.title.trim(),
        youtube_id: youtubeId,
        url: newVideo.url.trim(),
        notes: newVideo.notes.trim() || null,
      })
      .select()
      .single();

    if (error) {
      alert("Supabase video insert error:\n" + JSON.stringify(error, null, 2));
      console.error("Error saving video:", error);
    } else if (data) {
      const saved: Video = {
        id: data.id,
        project_id: data.project_id,
        title: data.title,
        youtube_id: data.youtube_id,
        url: data.url,
        notes: data.notes,
      };
      setVideos((prev) => [saved, ...prev]);
      setNewVideo({ title: "", url: "", notes: "" });
      setAiPlan(null);
    }

    setSavingVideo(false);
  };

  const deleteVideo = async (id: string) => {
    const confirmed = confirm("Remove this video from the workspace?");
    if (!confirmed) return;

    const { error } = await supabase.from("videos").delete().eq("id", id);

    if (error) {
      alert("Supabase video delete error:\n" + JSON.stringify(error, null, 2));
      console.error("Error deleting video:", error);
      return;
    }

    setVideos((prev) => prev.filter((v) => v.id !== id));
    setAiPlan(null);
  };

  // ---------- AI: study plan ----------

  const generateStudyPlan = async () => {
    if (!currentProjectId) {
      alert("Workspace not loaded yet.");
      return;
    }

    if (models.length === 0 || videos.length === 0) {
      const ok = confirm(
        "You have no entry models or no videos. AI will still try, but the plan may be weak. Continue?"
      );
      if (!ok) return;
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
        console.error("Study plan error:", data);
        alert("Failed to generate study plan.");
        setLoadingPlan(false);
        return;
      }

      const data = await res.json();
      setAiPlan(data.plan || "No plan text returned.");
    } catch (err) {
      console.error("Study plan fetch error:", err);
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

      setNewModel({
        name: s.name || video.title,
        category:
          s.category === "swing" || s.category === "intraday" || s.category === "scalping"
            ? (s.category as "swing" | "intraday" | "scalping")
            : "scalping",
        timeframes: s.timeframes || "",
        duration: s.duration || "",
        description: s.description || video.notes || "",
      });

      // Scroll to entry model form (nice UX)
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

  // ---------- UI ----------

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* HEADER */}
        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold">
            AI Builder – Entry Model Lab
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            This is your control panel. Later, AI will auto-fill this from a
            YouTube channel. For now you can define your own workspace, entry
            models and study videos.
          </p>
        </header>

        {/* WORKSPACE / TEACHER */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Teacher workspace</h2>
              <p className="text-xs text-slate-400 mt-1">
                One workspace = one mentor or strategy (e.g. Waqar EURUSD).
              </p>
            </div>

            {/* Workspace selector + advanced options */}
            <div className="flex flex-col items-start sm:items-end gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Workspace:</span>
                <select
                  className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  value={currentProjectId || ""}
                  onChange={(e) => handleProjectChange(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <details className="text-[11px] text-slate-500">
                <summary className="cursor-pointer select-none">
                  Advanced workspace options
                </summary>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={createProject}
                    disabled={savingProject}
                    className="rounded-xl border border-slate-700 px-3 py-1 bg-slate-950 hover:bg-slate-800 transition disabled:opacity-60"
                  >
                    {savingProject ? "Creating…" : "New workspace"}
                  </button>
                  <button
                    onClick={deleteCurrentProject}
                    disabled={
                      savingProject || !currentProject || projects.length <= 1
                    }
                    className="rounded-xl border border-red-500/70 px-3 py-1 text-red-300 bg-slate-950 hover:bg-red-500/10 transition disabled:opacity-40"
                  >
                    Delete current
                  </button>
                </div>
              </details>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel
                text="Workspace name"
                hint="How you want to refer to this teacher or strategy, e.g. 'Waqar Asim EURUSD Entry Models'."
              />
              <input
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel
                text="Teacher type"
                hint="Are you learning from a full channel, a playlist, or a single video?"
              />
              <div className="flex gap-2 text-xs sm:text-sm">
                <button
                  onClick={() => setTeacherType("channel")}
                  className={`flex-1 rounded-xl border px-2 py-2 ${
                    teacherType === "channel"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-950"
                  }`}
                >
                  Channel
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
                  Single video
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel
              text={
                teacherType === "channel"
                  ? "YouTube channel URL"
                  : teacherType === "playlist"
                  ? "YouTube playlist URL"
                  : "YouTube video URL"
              }
              hint="Paste the main URL for this teacher or playlist. Later, AI will scan this and auto-build the library."
            />
            <input
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                onClick={saveProjectDetails}
                disabled={savingProject || !currentProject}
                className="mt-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold px-4 py-2 hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingProject ? "Saving…" : "Save workspace"}
              </button>
            </div>
          </div>
        </section>

        {/* ENTRY MODELS */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Entry models (playbook)</h2>
              <p className="text-xs text-slate-400 mt-1">
                Each entry model is one repeatable setup you want to master,
                like “H4/H1 liquidity grab + FVG”.
              </p>
            </div>
            <span className="text-xs text-slate-500">
              Workspace: {currentProject ? currentProject.name : "Loading…"}
            </span>
          </div>

          <div className="grid md:grid-cols-[2fr,1.3fr] gap-4">
            {/* list */}
            <div className="space-y-3">
              {loadingModels ? (
                <p className="text-xs text-slate-400">Loading entry models…</p>
              ) : models.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No entry models yet. Start by adding one on the right.
                </p>
              ) : (
                models.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-sm sm:text-base">
                          {m.name}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          TF: {m.timeframes} • Hold: {m.duration}
                        </p>
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
                    {m.description && (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {m.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* add form */}
            <div
              id="entry-model-form"
              className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4 space-y-3"
            >
              <h3 className="font-medium text-sm sm:text-base">
                Add entry model
              </h3>

              <div className="space-y-2">
                <FieldLabel
                  text="Model name"
                  hint="Give this setup a clear name, e.g. 'Swing – H4/H1 liquidity + FVG'."
                />
                <input
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. London range sweep + NY FVG"
                  value={newModel.name || ""}
                  onChange={(e) =>
                    setNewModel((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <FieldLabel
                  text="Category"
                  hint="Rough style of the trade: swing, intraday or scalping."
                />
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
                <FieldLabel
                  text="Timeframes"
                  hint="Write the timeframes you use for this setup, e.g. 'H4, H1' or 'M15, M5'."
                />
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
                <FieldLabel
                  text="Typical hold time"
                  hint="How long you usually stay in these trades, e.g. '1–3 days' or '2–6 hours'."
                />
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
                <FieldLabel
                  text="Description (optional)"
                  hint="In your own words: what’s the logic of this entry? What do you wait for?"
                />
                <textarea
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500 min-h-[70px]"
                  placeholder="Summarize the confluences and entry rules."
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
                disabled={savingModel || !currentProject}
                className="w-full rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold py-2 mt-1 hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingModel ? "Saving…" : "Add entry model"}
              </button>
            </div>
          </div>
        </section>

        {/* STUDY VIDEOS */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Study videos</h2>
              <p className="text-xs text-slate-400 mt-1">
                Videos from this teacher that you want to study. Later AI can
                auto-pull these from the channel; for now you can pick them
                manually.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-[2fr,1.3fr] gap-4">
            {/* list */}
            <div className="space-y-3">
              {loadingVideos ? (
                <p className="text-xs text-slate-400">Loading videos…</p>
              ) : videos.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No study videos yet. Add one from YouTube on the right.
                </p>
              ) : (
                videos.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4 space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <h3 className="font-medium text-sm sm:text-base">
                        {v.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] px-2 py-1 rounded-full border border-emerald-500/70 text-emerald-300 hover:bg-emerald-500/10 transition"
                        >
                          Open on YouTube
                        </a>
                        <button
                          onClick={() => suggestModelFromVideo(v)}
                          disabled={
                            suggestingFromVideoId === v.id || !currentProject
                          }
                          className="text-[10px] px-2 py-1 rounded-full border border-sky-500/70 text-sky-300 hover:bg-sky-500/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {suggestingFromVideoId === v.id
                            ? "Suggesting…"
                            : "Suggest model"}
                        </button>
                        <button
                          onClick={() => deleteVideo(v.id)}
                          className="text-[10px] px-2 py-1 rounded-full border border-red-500/60 text-red-300 hover:bg-red-500/10 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Video ID: {v.youtube_id}
                    </p>
                    {v.notes && (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {v.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* add form */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4 space-y-3">
              <h3 className="font-medium text-sm sm:text-base">
                Add study video
              </h3>

              <div className="space-y-2">
                <FieldLabel
                  text="Video title"
                  hint="A short name so you recognize this video in the list."
                />
                <input
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. EURUSD London killzone entries"
                  value={newVideo.title}
                  onChange={(e) =>
                    setNewVideo((prev) => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <FieldLabel
                  text="YouTube URL"
                  hint="Paste the full link to the video from YouTube."
                />
                <input
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={newVideo.url}
                  onChange={(e) =>
                    setNewVideo((prev) => ({ ...prev, url: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <FieldLabel
                  text="Notes (optional)"
                  hint="What is this video about or what do you want to focus on when watching?"
                />
                <textarea
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500 min-h-[70px]"
                  placeholder="e.g. Focus on how he builds bias on H4/H1 and where he actually enters."
                  value={newVideo.notes}
                  onChange={(e) =>
                    setNewVideo((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>

              <button
                onClick={addVideo}
                disabled={savingVideo || !currentProject}
                className="w-full rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold py-2 mt-1 hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingVideo ? "Saving…" : "Add study video"}
              </button>
            </div>
          </div>
        </section>

        {/* AI STUDY PLAN */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">AI study coach</h2>
              <p className="text-xs text-slate-400 mt-1">
                Let AI look at your current entry models and study videos and
                suggest a short training plan. Later this will be fully
                automatic using YouTube analysis.
              </p>
            </div>
            <button
              onClick={generateStudyPlan}
              disabled={loadingPlan || !currentProjectId}
              className="rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold px-4 py-2 hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingPlan ? "Thinking…" : "Generate study plan"}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 sm:p-4 min-h-[100px]">
            {loadingPlan && (
              <p className="text-xs text-slate-400">Talking to AI…</p>
            )}
            {!loadingPlan && !aiPlan && (
              <p className="text-xs text-slate-400">
                Click &quot;Generate study plan&quot; after you have at least 1
                entry model and 1 study video in this workspace.
              </p>
            )}
            {!loadingPlan && aiPlan && (
              <pre className="text-xs whitespace-pre-wrap font-mono text-slate-100">
                {aiPlan}
              </pre>
            )}
          </div>
        </section>

        <footer className="text-xs text-slate-500 text-center pb-4">
          Later steps: AI reads this workspace, pulls videos from YouTube,
          detects entry models automatically, and turns this into an interactive
          learning coach.
        </footer>
      </div>
    </main>
  );
}
