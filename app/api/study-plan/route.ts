import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "../../../lib/supabaseClient";

// POST /api/study-plan
// Body: { projectId: "..." }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId } = body as { projectId?: string };

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400 }
      );
    }

    // Load models for this workspace
    const { data: models, error: modelsError } = await supabase
      .from("models")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (modelsError) {
      console.error("Supabase models error:", modelsError);
      return NextResponse.json(
        { error: "Failed to load models" },
        { status: 500 }
      );
    }

    // Load videos for this workspace
    const { data: videos, error: videosError } = await supabase
      .from("videos")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (videosError) {
      console.error("Supabase videos error:", videosError);
      return NextResponse.json(
        { error: "Failed to load videos" },
        { status: 500 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set on the server" },
        { status: 500 }
      );
    }

    // Prepare data for the model
    const userContent = {
      models: (models ?? []).map((m: any) => ({
        name: m.name,
        category: m.category,
        timeframes: m.timeframes,
        duration: m.duration,
        description: m.description,
      })),
      videos: (videos ?? []).map((v: any) => ({
        title: v.title,
        url: v.url,
        notes: v.notes,
      })),
    };

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are a trading mentor for ICT/SMC-style EURUSD trading. The user gives you a list of entry models and study videos. Create a short, concrete multi-day study plan.",
        },
        {
          role: "user",
          content:
            "Here is my current workspace data as JSON. Create a 3–7 day study plan. Focus on concrete actions: which video to watch, what to pause and observe, and which entry models to mark up on charts.\n\n" +
            JSON.stringify(userContent, null, 2),
        },
      ],
      max_output_tokens: 700,
    });

    // Simple text output helper provided by the SDK
    const plan = (response as any).output_text ?? "No plan returned.";

    return NextResponse.json({ plan });
  } catch (err) {
    console.error("study-plan route error:", err);
    return NextResponse.json(
      { error: "Unexpected error in study-plan route" },
      { status: 500 }
    );
  }
}
