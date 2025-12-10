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

// Simple helper to extract YouTube ID from common URL formats
const extractYouTubeId = (url: string): string | null => {
  try {
    const u = new URL(url.trim());

    // Standard watch URL ?v=ID
    const vParam = u.searchParams.get("v");
    if (vParam) return vParam;

    // youtu.be/ID
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "");
    }

    // youtube.com/shorts/ID or /live/ID etc.
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
  // All projects + which one is selected
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Form fields for the currently selected project
  const [projectName, setProjectName] = useState("");
  const [teacherType, setTeacherType] = useState<TeacherType>("channel");
  const [sourceUrl, setSourceUrl] = useState("");

  // Models for current project
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [savingModel, setSavingModel] = useState(false);

  // Videos for current project
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [savingVideo, setSavingVideo] = useState(false);

  // Project saving/deleting state
  const [savingProject, setSavingProject] = useState(false);

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

  const currentProject =
    projects.find((p) => p.id === currentProjectId) || null;

  // Helper: load models for a given project
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

  // Helper: load videos for a given project
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

  // Initial load: projects + models + videos for first project (or create default)
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

        // If no project exists, create the default Waqar one
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

  // Change selected project
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
  };

  // Create a brand new project
  const createProject = async () => {
    setSavingProject(true);
    const defaultName = `New Project ${projects.length + 1}`;
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
    setSavingProject(false);
  };

  // Save current project details
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

  // Delete current project (and its models + videos)
  const deleteCurrentProject = async () => {
    if (!currentProject) return;

    if (projects.length <= 1) {
      alert("You must have at least one project. Create another one first.");
      return;
    }

    const confirmed = confirm(
      `Delete project "${currentProject.name}" and all its models & videos?`
    );
    if (!confirmed) return;

    setSavingProject(true);

    // Models & videos will be deleted via foreign keys if you've set them up,
    // but we already ensured models delete earlier; videos table has ON DELETE CASCADE too.
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

    setSavingProject(false);
  };

  const addModel = async () => {
    if (!currentProject) {
      alert("Project not loaded yet. Please wait a moment and try again.");
      return;
    }

    if (!newModel.name || !newModel.timeframes || !newModel.duration) return;

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

  const addVideo = async () => {
    if (!currentProject) {
      alert("Project not loaded yet. Please wait a moment and try again.");
      return;
    }

    if (!newVideo.title.trim() || !newVideo.url.trim()) {
      alert("Please fill in title and video URL.");
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
    }

    setSavingVideo(false);
  };

  const deleteVideo = async (id: string) => {
    const confirmed = confirm("Delete this video from the project?");
    if (!confirmed) return;

    const { error } = await supabase.from("videos").delete().eq("id", id);

    if (error) {
      alert("Supabase video delete error:\n" + JSON.stringify(error, null, 2));
      console.error("Error deleting video:", error);
      return;
    }

    setVideos((prev) => prev.filter((v) => v.id !== id));
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
            v0.5 – Projects + Models + Videos
          </span>
        </header>

        {/* Project & Teacher */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold mb-1">Project &amp; Teacher</h2>

            {/* Project selector */}
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <span className="text-slate-400">Current project:</span>
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
              <button
                onClick={createProject}
                disabled={savingProject}
                className="rounded-xl border border-slate-700 px-3 py-2 text-xs bg-slate-950 hover:bg-slate-800 transition disabled:opacity-60"
              >
                {savingProject ? "Creating..." : "New project"}
              </button>
              <button
                onClick={deleteCurrentProject}
                disabled={savingProject || !currentProject || projects.length <= 1}
                className="rounded-xl border border-red-500/70 px-3 py-2 text-xs text-red-300 bg-slate-950 hover:bg-red-500/10 transition disabled:opacity-40"
              >
                Delete project
              </button>
            </div>
          </div>

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
            <div className="flex justify-end">
              <button
                onClick={saveProjectDetails}
                disabled={savingProject || !currentProject}
                className="mt-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold px-4 py-2 hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingProject ? "Saving..." : "Save project"}
              </button>
            </div>
          </div>
        </section>

        {/* Model Profiles */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-lg font-semibold">Model Profiles</h2>
            <span className="text-xs text-slate-400">
              Project: {currentProject ? currentProject.name : "Loading..."}
            </span>
          </div>

          <div className="grid md:grid-cols-[2fr,1.3fr] gap-4">
            {/* Existing models list */}
            <div className="space-y-3">
              {loadingModels ? (
                <p className="text-xs text-slate-400">Loading models...</p>
              ) : models.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No models yet for this project. Add one on the right.
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
                disabled={savingModel || !currentProject}
                className="w-full rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold py-2 mt-1 hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingModel ? "Saving..." : "Add model"}
              </button>
            </div>
          </div>
        </section>

        {/* Videos for this project */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-lg font-semibold">Videos for this project</h2>
            <span className="text-xs text-slate-400">
              Attach Waqar&apos;s videos (or other mentors) to this project.
            </span>
          </div>

          <div className="grid md:grid-cols-[2fr,1.3fr] gap-4">
            {/* Existing videos list */}
            <div className="space-y-3">
              {loadingVideos ? (
                <p className="text-xs text-slate-400">Loading videos...</p>
              ) : videos.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No videos yet for this project. Add one on the right.
                </p>
              ) : (
                videos.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium text-sm sm:text-base">
                        {v.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] px-2 py-1 rounded-full border border-emerald-500/70 text-emerald-300 hover:bg-emerald-500/10 transition"
                        >
                          Open on YouTube
                        </a>
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

            {/* Add new video form */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4 space-y-3">
              <h3 className="font-medium text-sm sm:text-base">
                Add new video
              </h3>

              <div className="space-y-2">
                <label className="text-xs text-slate-300">Title</label>
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
                <label className="text-xs text-slate-300">YouTube URL</label>
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
                <label className="text-xs text-slate-300">
                  Notes (optional) – what you want to learn from this video
                </label>
                <textarea
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500 min-h-[70px]"
                  placeholder="e.g. Focus on how he builds the bias on H4/H1 and where he actually enters."
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
                {savingVideo ? "Saving..." : "Add video"}
              </button>
            </div>
          </div>
        </section>

        <footer className="text-xs text-slate-500 text-center pb-4">
          Next steps: connect YouTube API to auto-import videos and later link
          specific clips to each entry model.
        </footer>
      </div>
    </main>
  );
}
