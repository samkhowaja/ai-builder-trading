// app/api/analyze-charts/route.ts
import { NextResponse } from "next/server";
// If you already have an OpenAI client set up, import that instead
// import { openai } from "@/lib/openai";

type UploadImage = { name: string; dataUrl: string };

type ChecklistItem = { text: string; satisfied: boolean };

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
  tradeOutcome?: "hit" | "miss" | "pending";
};

export async function POST(req: Request) {
  const body = await req.json();
  const pair: string | undefined = body.pair;
  const timeframes: string[] = body.timeframes || [];
  const notes: string = body.notes || "";
  const images: UploadImage[] = body.images || [];

  if (!pair || !images.length) {
    return NextResponse.json(
      { error: "Missing 'pair' or 'images' in request body" },
      { status: 400 }
    );
  }

  try {
    // ─────────────────────────────
    // 1) Build a prompt for your AI
    // ─────────────────────────────
    // If you already have working OpenAI code,
    // plug it in here and set `analysis` from the model response.

    // TODO: replace this whole dummy block with your real OpenAI call.
    // For now we return a simple static analysis so the UI works.

    const analysis: ChartAnalysis = {
      overview: `Study note for ${pair} using ${timeframes.join(
        ", "
      ) || "your selected"} timeframes. This is a dummy analysis placeholder.`,
      htfBias:
        "Higher timeframe looks bullish in this placeholder. Replace with real AI output.",
      liquidityStory:
        "Describe where liquidity is resting above highs / below lows, and where it was grabbed.",
      entryPlan:
        "Example: Wait for price to revisit the fair value gap after liquidity sweep, then enter with stop beyond the extreme.",
      riskManagement:
        "Risk 1% per idea. Place stops beyond structure, avoid overlapping news events.",
      redFlags:
        "Skip the trade if structure breaks in the opposite direction or if multiple HTFs conflict.",
      nextMove:
        "If price holds above reclaimed liquidity and FVG, next target is previous high or opposing liquidity pool.",
      qualityScore: 80,
      qualityLabel: "A",
      qualityReason:
        "Clean HTF bias, clear liquidity story and entry, but this is demo-only.",
      checklist: [
        { text: "HTF bias clear and aligned?", satisfied: false },
        { text: "Liquidity grab confirmed?", satisfied: false },
        { text: "Clean entry zone with SL/TP planned?", satisfied: false },
      ],
      screenshotGuides: [
        {
          title: "HTF context",
          description:
            "Capture the H4 / H1 chart showing major swing structure and liquidity pools.",
          timeframeHint: "H4 / H1",
        },
        {
          title: "Entry timeframe",
          description:
            "Capture the M15 / M5 chart where you see the liquidity sweep and FVG.",
          timeframeHint: "M15 / M5",
        },
      ],
      learningQueries: [
        {
          concept: "ICT liquidity grab + FVG entry",
          query: "ICT liquidity grab FVG entry example",
          platforms: ["YouTube", "TikTok", "Images"],
        },
      ],
      tradeOutcome: "pending",
    };

    // ─────────────────────────────
    // 2) Return analysis for the UI
    // ─────────────────────────────
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("analyze-charts error:", err);
    return NextResponse.json(
      { error: "Failed to generate analysis." },
      { status: 500 }
    );
  }
}