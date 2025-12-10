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
  satisfied: boolean; // true = AI thinks this is already done on the chart
};

type ScreenshotGuide = {
  title: string;
  description: string;
  timeframeHint?: string; // e.g. "H4", "M15", "overall"
};

type ChartAnalysis = {
  overview: string;
  htfBias: string;
  liquidityStory: string;
  entryPlan: string;
  riskManagement: string;
  redFlags: string;
  checklist: ChecklistItem[];
  screenshotGuides: ScreenshotGuide[];
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
The user has uploaded multiple images that most likely correspond to these timeframes: ${tfText}.

User notes (if any):
${notes || "No extra notes."}

You must answer as a single JSON object with this exact shape:

{
  "overview": "high-level summary of the setup and market conditions",
  "htfBias": "clear explanation of higher timeframe bias and structure",
  "liquidityStory": "detailed narrative of liquidity grabs, inducement, stop hunts, and where liquidity is resting",
  "entryPlan": "step-by-step plan: which timeframe to execute on, what price behaviour to wait for, entry idea, and example SL/TP in R multiples",
  "riskManagement": "how to size, what to avoid, and how to manage if the trade runs or stalls",
  "redFlags": "when NOT to trade this setup: conditions, session issues, news, messy structure, etc.",
  "checklist": [
    {
      "text": "one clear condition that should be checked before entry",
      "satisfied": true or false
    }
  ],
  "screenshotGuides": [
    {
      "title": "very short label for the screenshot overlay idea",
      "description": "instructions like: draw a rectangle around this, mark this stop hunt, arrow from liquidity to FVG, label entry and stop, etc.",
      "timeframeHint": "optional higher timeframe label such as H4, H1, M15, or overall"
    }
  ]
}

Checklist rules:
- 6 to 12 items.
- Each item is a concrete visual condition: session, liquidity taken, structure, FVG, displacement, candle behaviour.
- Set "satisfied": true if you can clearly see that condition already fulfilled on the charts.
- Set "satisfied": false if the trader still needs to wait for, or confirm, that condition.

Screenshot guides:
- Give 3 to 6 guides.
- Think of them as drawing instructions that help a student see the idea on the screenshot.
- You do NOT need real coordinates, just explain in words what should be highlighted.

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
