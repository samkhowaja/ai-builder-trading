// app/api/video-to-model/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type EntryModelCore = {
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
};

type Body = {
  videoUrl: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const { videoUrl } = body;

    if (!videoUrl) {
      return NextResponse.json(
        { error: "videoUrl is required." },
        { status: 400 },
      );
    }

    const systemPrompt = `You are a professional smart-money / ICT-style trading coach.
Given a YouTube video URL that likely teaches a trading strategy,
invent ONE realistic "entry model" a student could practice.

- Assume the video is about smart money, liquidity, FVG, order blocks, etc.
- Output a STRICT JSON object for a single entry model.
- Keep it realistic and consistent.`;

    const userPrompt = `YouTube video URL:
${videoUrl}

Task:
1) Imagine this video teaches one main entry model (for Forex or indices).
2) Extract and define that entry model in a structured JSON object with this exact shape:

{
  "name": "short model name",
  "style": "Scalping | Intraday | Swing",
  "timeframe": "e.g. M1, M5, M15, H1, H4",
  "instrument": "e.g. EURUSD, NAS100, XAUUSD (guess if needed)",
  "session": "e.g. London, New York, Asia",
  "riskPerTrade": 1.0,
  "description": "short paragraph summarizing the idea",
  "rules": "multi-line string with detailed rules (HTF, liquidity, entry, SL/TP)",
  "checklist": [
    "checkbox style items",
    "each covering an important condition"
  ],
  "tags": ["ICT", "liquidity", "FVG"],
  "sourceVideoTitle": "short guessed title like 'London liquidity sweep on EURUSD'",
  "sourceTimestamps": ""
}

3) RETURN ONLY the JSON object. No explanation, no extra text.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
    });

    const content = completion.choices[0]?.message?.content ?? "{}";

    let model: EntryModelCore;
    try {
      model = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error for video model:", e, content);
      return NextResponse.json(
        { error: "AI returned invalid JSON for model." },
        { status: 500 },
      );
    }

    model.sourceVideoUrl = videoUrl;

    if (!Array.isArray(model.checklist)) model.checklist = [];
    if (!Array.isArray(model.tags)) model.tags = [];

    return NextResponse.json({ model });
  } catch (err) {
    console.error("video-to-model error:", err);
    return NextResponse.json(
      { error: "Failed to create model from video." },
      { status: 500 },
    );
  }
}
