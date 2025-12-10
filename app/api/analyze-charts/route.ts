// app/api/analyze-charts/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type UploadImage = {
  name: string;
  dataUrl: string; // data:image/png;base64,....
};

type Body = {
  pair: string;
  timeframes: string[];
  notes?: string;
  images: UploadImage[];
};

type ChartAnalysis = {
  overview: string;
  htfBias: string;
  liquidityStory: string;
  entryPlan: string;
  riskManagement: string;
  redFlags: string;
  checklist: string[];
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
You are an experienced ICT / Smart Money trader and teacher.

You are analyzing chart screenshots for ${pair}.
The user has uploaded multiple images that (most likely) correspond to these timeframes: ${tfText}.

User notes (if any):
${notes || "No extra notes."}

You MUST answer as a single JSON object with this exact shape (no extra keys):

{
  "overview": "high-level summary of the setup and market conditions",
  "htfBias": "clear explanation of higher timeframe bias and structure",
  "liquidityStory": "detailed narrative of liquidity grabs, inducement, stop hunts, and where money is resting",
  "entryPlan": "step-by-step plan: which timeframe to execute on, what price behaviour you need to see, where to enter, and example SL/TP in R multiples",
  "riskManagement": "how to size, what to avoid, how to manage if trade runs or stalls",
  "redFlags": "when NOT to trade this setup: conditions, session issues, news, messy structure, etc.",
  "checklist": [
    "short bullet rules that must be true BEFORE taking an entry",
    "each bullet is one clear condition to verify on the chart",
    "focus on things the trader can visually check (structure, liquidity, timing, FVG, etc.)"
  ]
}

Rules for the checklist:
- 6 to 12 items total.
- Very concrete (e.g. "Asia high/low taken" not "liquidity handled").
- Think of it as a pre-flight checklist before order execution.

Do NOT include any explanation outside the JSON.
`;

    // Build multimodal content: text + multiple images
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
            "You are a precise, honest trading assistant. Never hallucinate prices. Explain in clear, structured language.",
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
