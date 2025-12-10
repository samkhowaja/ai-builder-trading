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

    // 2) Ask OpenAI to propose an ICT/SMC-style entry model
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
From that, you must propose ONE trading entry model they can practice.

The user trades using ICT / Smart Money Concepts:
- Use vocabulary like liquidity, inducement, FVG, OB, BOS, SSL/BHL etc. when appropriate.
- Assume entries are usually built from HTF bias + LTF execution.

Return STRICT JSON ONLY with this exact shape:

{
  "name": "short, punchy model name",
  "category": "swing | intraday | scalping",
  "timeframes": "comma-separated timeframes, e.g. 'H4, H1' or 'M15, M5'",
  "duration": "typical hold time, e.g. '1–3 days' or '2–6 hours'",
  "overview": "2–3 sentences explaining the logic of the setup in ICT/SMC language.",
  "entry_rules": [
    "bullet-style entry rule 1",
    "bullet-style entry rule 2"
  ],
  "stop_rules": [
    "how to place SL, where to invalidate the idea"
  ],
  "tp_rules": [
    "how to take partials and final TP (liquidity levels, HTF POI, RR targets, etc.)"
  ]
}

Rules:
- category must be lowercase: "swing", "intraday", or "scalping".
- Use **concise** bullet rules that a trader can actually follow.
- Focus on technical rules only. Do NOT mention psychology, risk warning, or generic advice.
- Do NOT wrap the JSON in backticks or markdown. Respond with ONLY the JSON object.
`,
        },
        {
          role: "user",
          content:
            "Here is the study video data as JSON:\n\n" +
            JSON.stringify(userInfo, null, 2),
        },
      ],
      max_output_tokens: 600,
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
        overview:
          userInfo.notes ||
          "Entry model derived from the study video. Add your own rules here.",
        entry_rules: [],
        stop_rules: [],
        tp_rules: [],
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

    if (!Array.isArray(suggestion.entry_rules)) {
      suggestion.entry_rules = suggestion.entry_rules
        ? [String(suggestion.entry_rules)]
        : [];
    }
    if (!Array.isArray(suggestion.stop_rules)) {
      suggestion.stop_rules = suggestion.stop_rules
        ? [String(suggestion.stop_rules)]
        : [];
    }
    if (!Array.isArray(suggestion.tp_rules)) {
      suggestion.tp_rules = suggestion.tp_rules
        ? [String(suggestion.tp_rules)]
        : [];
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
