import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "../../../lib/supabaseClient";

// POST /api/suggest-model
// Body: { videoId: string }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { videoId } = body as { videoId?: string };

    if (!videoId) {
      return NextResponse.json(
        { error: "Missing videoId" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set on the server" },
        { status: 500 }
      );
    }

    // 1) Load the video from Supabase
    const { data: video, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .single();

    if (error || !video) {
      console.error("Supabase video error:", error);
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    const userInfo = {
      title: video.title,
      url: video.url,
      notes: video.notes,
    };

    // 2) Ask OpenAI to propose an entry model
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: `
You are a trading coach for ICT/SMC style EURUSD trading.

The user gives you ONE study video (title, notes, URL). 
Your job is to propose ONE trading entry model that could be learned from that video.

Return STRICT JSON ONLY with this exact shape:

{
  "name": "short, punchy model name",
  "category": "swing | intraday | scalping",
  "timeframes": "comma-separated timeframes, e.g. 'H4, H1' or 'M15, M5'",
  "duration": "typical hold time, e.g. '1–3 days' or '2–6 hours'",
  "description": "2–4 sentences describing the logic of the setup"
}

No markdown, no backticks, no extra text – ONLY that JSON object.
`,
        },
        {
          role: "user",
          content:
            "Here is the study video data as JSON:\n\n" +
            JSON.stringify(userInfo, null, 2),
        },
      ],
      max_output_tokens: 500,
    });

    const rawText = (response as any).output_text ?? "";
    let suggestion: any = null;

    try {
      suggestion = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("Failed to parse JSON from model:", parseErr, rawText);
      // Fallback: create a very simple suggestion from the title/notes
      suggestion = {
        name: userInfo.title,
        category: "scalping",
        timeframes: "",
        duration: "",
        description:
          userInfo.notes ||
          "Entry model derived from the study video. Add your own rules here.",
      };
    }

    // Basic cleanup / defaults
    if (!suggestion.name) suggestion.name = userInfo.title;
    if (
      suggestion.category !== "swing" &&
      suggestion.category !== "intraday" &&
      suggestion.category !== "scalping"
    ) {
      suggestion.category = "scalping";
    }

    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error("suggest-model route error:", err);
    return NextResponse.json(
      { error: "Unexpected error in suggest-model route" },
      { status: 500 }
    );
  }
}
