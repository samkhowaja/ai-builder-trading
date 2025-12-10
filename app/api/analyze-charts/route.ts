// app/api/analyze-charts/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type UploadImage = {
  name: string;
  dataUrl: string; // data:image/png;base64,...
};

type Body = {
  pair: string;
  timeframes: string[];
  notes?: string;
  images: UploadImage[];
};

type ChecklistItem = {
  text: string;
  satisfied: boolean;
};

type ScreenshotGuide = {
  title: string;
  description: string;
  timeframeHint?: string;
};

type LearningResourceQuery = {
  concept: string;
  query: string;
  platforms: string[];
};

type ChartAnalysis = {
  overview: string;
  htfBias: string;
  liquidityStory: string;
  entryPlan: string;
  riskManagement: string;
  redFlags: string;
  nextMove: string;
  qualityScore: number;
  qualityLabel: string;
  qualityReason: string;
  checklist: ChecklistItem[];
  screenshotGuides: ScreenshotGuide[];
  learningQueries: LearningResourceQuery[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const { pair, timeframes, notes, images } = body;

    if (!pair || !images || images.length === 0) {
      return NextResponse.json(
        { error: "pair and at least one image are required." },
        { status: 400 },
      );
    }

    const tfText =
      timeframes && timeframes.length ? timeframes.join(", ") : "unknown";

    const userText = `
You are an experienced ICT and Smart Money trader and teacher.

You are analyzing chart screenshots for ${pair}.
The user has uploaded multiple images that most likely correspond to these timeframes: ${tfText}.

User notes (if any):
${notes || "No extra notes."}

You must answer as a single JSON object with this exact shape:

{
  "overview": "high level summary of the setup and market conditions",
  "htfBias": "clear explanation of higher timeframe bias and structure, including premium or discount, important zones, and session context",
  "liquidityStory": "detailed narrative of liquidity grabs, inducement, stop hunts, where liquidity is resting above or below price, and how this fits into the bias",
  "entryPlan": "step by step plan: which timeframe to execute on, what price behaviour to wait for, what qualifies the entry, and example SL and TP in risk multiples such as 1R, 2R",
  "riskManagement": "how to size, what to avoid, and how to manage if the trade runs or stalls. Do not give specific lot sizes or financial advice.",
  "redFlags": "when NOT to trade this setup: conditions, session issues, news, messy structure, conflicting signals, or low probability conditions.",
  "nextMove": "educational description of the next possible move in if or then scenarios. Explain likely bullish and bearish paths, where this idea is invalidated, and what confirmation is needed. Do not give financial advice.",
  "qualityScore": 0,
  "qualityLabel": "A+, A, B, C, or D",
  "qualityReason": "short justification of the quality label based on structure, liquidity, confluence, clarity of entry, and risk profile.",
  "checklist": [
    {
      "text": "one clear condition that should be checked before entry",
      "satisfied": true
    }
  ],
  "screenshotGuides": [
    {
      "title": "short label for the screenshot overlay idea",
      "description": "instructions like: draw a rectangle around this, mark this stop hunt, arrow from liquidity to fair value gap, label entry and stop.",
      "timeframeHint": "optional higher timeframe label such as H4, H1, M15, or overall"
    }
  ],
  "learningQueries": [
    {
      "concept": "short name such as valid bullish fair value gap or failed breakout",
      "query": "search phrase a trader can use to find examples of this concept online",
      "platforms": ["YouTube", "TikTok", "Instagram"]
    }
  ]
}

Checklist rules:
- 6 to 12 items.
- Each item is a concrete visual condition: session, liquidity taken, structure, fair value gap, displacement, candle behaviour.
- Set "satisfied": true if you can clearly see that condition already fulfilled on the charts.
- Set "satisfied": false if the trader still needs to wait for, or confirm, that condition.

Screenshot guides:
- Give 3 to 6 guides.
- Think of them as drawing instructions that help a student see the idea on the screenshot.
- You do not need real coordinates, just explain in words what should be highlighted.

Quality scoring:
- Use qualityScore on a scale from 0 to 100.
- Map roughly: 95 to 100 is A+, 85 to 94 is A, 70 to 84 is B, 55 to 69 is C, below 55 is D.
- Consider: alignment with higher timeframe bias, clean liquidity story, clear and simple execution, and absence of major red flags.

Learning queries:
- Focus on core ideas you used, such as valid or invalid fair value gaps, liquidity sweeps, breakouts and failed breakouts, order blocks, and entries you described.
- For each concept, give a search phrase that would lead to good examples on platforms like YouTube, TikTok or Instagram.
- Use at least 2 and at most 6 learningQueries.

Do NOT include any explanation outside the JSON.
`;

    const content: any[] = [{ type: "text", text: userText }];

    for (const img of images) {
      content.push({
        type: "image_url",
        image_url: { url: img.dataUrl },
      });
      content.push({
        type: "text",
        text: `Above image file name: ${img.name}`,
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a precise, honest trading assistant. You explain ideas for study only. You never give personalised financial advice.",
        },
        {
          role: "user",
          content,
        },
      ],
      temperature: 0.6,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: ChartAnalysis;

    try {
      parsed = JSON.parse(raw) as ChartAnalysis;
    } catch (e) {
      console.error("JSON parse error from OpenAI:", e, raw);
      return NextResponse.json(
        { error: "Failed to parse analysis JSON from model." },
        { status: 500 },
      );
    }

    return NextResponse.json({ analysis: parsed });
  } catch (err: any) {
    console.error("analyze-charts error:", err);

    const message =
      err?.response?.data?.error?.message ||
      err?.message ||
      "Failed to analyze charts.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
