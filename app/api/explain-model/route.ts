// app/api/explain-model/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type EntryModel = {
  id?: string;
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
  sourceChannel?: string;
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

type Body = {
  model: EntryModel;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    if (!body.model) {
      return NextResponse.json(
        { error: "model is required" },
        { status: 400 },
      );
    }

    const model = body.model;

    const systemPrompt = `You are a professional smart-money (ICT-style) trading coach.
You explain concepts for a visual beginner who likes screenshots and step-by-step flows.

User is building a learning guide for ONE entry model.
You must respond ONLY as a JSON object with a fixed structure (see below).`;

    const userPrompt = `Here is the entry model:

Name: ${model.name}
Style: ${model.style}
Timeframe: ${model.timeframe}
Instrument: ${model.instrument}
Session: ${model.session}
Risk per trade: ${model.riskPerTrade}%

Description:
${model.description}

Rules:
${model.rules}

Checklist:
${model.checklist.join("\n")}

Tags: ${model.tags.join(", ")}

Source:
Channel: ${model.sourceChannel || "N/A"}
Video title: ${model.sourceVideoTitle || "N/A"}
Video URL: ${model.sourceVideoUrl || "N/A"}
Important timestamps / notes:
${model.sourceTimestamps || "N/A"}

Task:
Return a JSON object with this EXACT shape:

{
  "overview": "string – 1–3 short paragraphs explaining the idea in simple language.",
  "story": "string – step-by-step 'price story' from HTF to LTF, using numbered steps inside the text.",
  "rulesChecklist": [
    "each item is a clear condition the trader should check before entry"
  ],
  "invalidation": "string – when this model is dangerous or low quality, with concrete examples.",
  "screenshotIdeas": [
    {
      "label": "Image 1: HTF liquidity above previous day high",
      "description": "Describe exactly what the chart should look like and which timeframe/session to use."
    }
  ],
  "practiceSteps": [
    "short drill instructions the student can follow when rewatching the video or replaying charts"
  ]
}

Rules:
- Fill every field with helpful content.
- You MUST return valid JSON only. No markdown, no backticks, no extra text.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content ?? "{}";

    let guide: ModelGuide;
    try {
      guide = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error for guide:", e, content);
      return NextResponse.json(
        { error: "AI returned invalid JSON for guide." },
        { status: 500 },
      );
    }

    if (!Array.isArray(guide.rulesChecklist)) guide.rulesChecklist = [];
    if (!Array.isArray(guide.screenshotIdeas)) guide.screenshotIdeas = [];
    if (!Array.isArray(guide.practiceSteps)) guide.practiceSteps = [];

    return NextResponse.json({ guide });
  } catch (err) {
    console.error("AI guide error:", err);
    return NextResponse.json(
      { error: "Failed to generate explanation." },
      { status: 500 },
    );
  }
}
