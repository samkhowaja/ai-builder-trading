// app/api/chart-analyses/route.ts
import { NextResponse } from "next/server";
import { dbQuery, hasDb } from "@/lib/db";

// Types should match what you use on the client
type ChartImage = { id: string; name: string; dataUrl: string };
type ChecklistState = { text: string; done: boolean };

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
  checklist: { text: string; satisfied: boolean }[];
  screenshotGuides: any[];
  learningQueries: any[];
  tradeOutcome?: "hit" | "miss" | "pending";
};

type ChartAnalysisEntry = {
  id: string;
  pair: string;
  timeframes: string[];
  notes: string;
  analysis: ChartAnalysis;
  candleEnds: Record<string, number>;
  checklistState: ChecklistState[];
  chartImages: ChartImage[];
  createdAt: string;
};

// ────────────────────────
// GET – latest or history
// ────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pair = searchParams.get("pair");
  const wantHistory = searchParams.get("history") === "1";

  if (!pair) {
    return NextResponse.json(
      { error: "Missing 'pair' query parameter" },
      { status: 400 }
    );
  }

  // No DB configured → just say there is no history
  if (!hasDb()) {
    if (wantHistory) {
      return NextResponse.json({ entries: [] as ChartAnalysisEntry[], source: "fallback" });
    }
    return NextResponse.json({ entry: null, source: "fallback" });
  }

  await dbQuery`
    CREATE TABLE IF NOT EXISTS chart_analyses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pair TEXT NOT NULL,
      timeframes TEXT[] NOT NULL,
      notes TEXT,
      analysis JSONB NOT NULL,
      candle_ends JSONB,
      checklist_state JSONB,
      chart_images JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  if (wantHistory) {
    const { rows } = await dbQuery<ChartAnalysisEntry>`
      SELECT id,
             pair,
             timeframes,
             notes,
             analysis,
             candle_ends AS "candleEnds",
             checklist_state AS "checklistState",
             chart_images AS "chartImages",
             created_at AS "createdAt"
      FROM chart_analyses
      WHERE pair = ${pair}
      ORDER BY created_at DESC
      LIMIT 50;
    `;
    return NextResponse.json({ entries: rows, source: "db" });
  }

  const { rows } = await dbQuery<ChartAnalysisEntry>`
    SELECT id,
           pair,
           timeframes,
           notes,
           analysis,
           candle_ends AS "candleEnds",
           checklist_state AS "checklistState",
           chart_images AS "chartImages",
           created_at AS "createdAt"
    FROM chart_analyses
    WHERE pair = ${pair}
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  return NextResponse.json(
    { entry: rows[0] ?? null, source: "db" },
    { status: 200 }
  );
}

// ────────────────────────
// POST – save snapshot
// ────────────────────────

export async function POST(req: Request) {
  const body = await req.json();

  const pair: string = body.pair;
  const timeframes: string[] = body.timeframes || [];
  const notes: string = body.notes || "";
  const analysis: ChartAnalysis = body.analysis;
  const candleEnds: Record<string, number> = body.candleEnds || {};
  const checklistState: ChecklistState[] = body.checklistState || [];
  const chartImages: ChartImage[] = body.chartImages || [];

  if (!pair || !analysis) {
    return NextResponse.json(
      { error: "Missing 'pair' or 'analysis' in request body" },
      { status: 400 }
    );
  }

  // No DB configured → pretend save worked and return ok.
  if (!hasDb()) {
    return NextResponse.json({ ok: true, source: "fallback" });
  }

  await dbQuery`
    CREATE TABLE IF NOT EXISTS chart_analyses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pair TEXT NOT NULL,
      timeframes TEXT[] NOT NULL,
      notes TEXT,
      analysis JSONB NOT NULL,
      candle_ends JSONB,
      checklist_state JSONB,
      chart_images JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await dbQuery`
    INSERT INTO chart_analyses (
      pair,
      timeframes,
      notes,
      analysis,
      candle_ends,
      checklist_state,
      chart_images
    )
    VALUES (
      ${pair},
      ${timeframes},
      ${notes},
      ${analysis},
      ${candleEnds},
      ${checklistState},
      ${chartImages}
    );
  `;

  return NextResponse.json({ ok: true, source: "db" });
}
