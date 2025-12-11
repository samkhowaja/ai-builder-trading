// app/api/chart-analyses/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

type ChecklistItemState = {
  text: string;
  done: boolean;
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
  checklist: { text: string; satisfied: boolean }[];
  screenshotGuides: ScreenshotGuide[];
  learningQueries: LearningResourceQuery[];
};

type ChartImage = {
  id: string;
  name: string;
  dataUrl: string;
};

type SaveBody = {
  pair: string;
  timeframes: string[];
  notes: string;
  analysis: ChartAnalysis;
  candleEnds: Record<string, number>;
  checklistState: ChecklistItemState[];
  chartImages: ChartImage[];
};

type ChartAnalysisEntry = {
  id: string;
  pair: string;
  timeframes: string[];
  notes: string;
  analysis: ChartAnalysis;
  candleEnds: Record<string, number>;
  checklistState: ChecklistItemState[];
  chartImages: ChartImage[];
  createdAt: string;
};

async function ensureChartTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS chart_analyses (
      id text PRIMARY KEY,
      pair text NOT NULL,
      timeframes jsonb NOT NULL,
      notes text,
      analysis_json jsonb NOT NULL,
      candle_ends_json jsonb,
      checklist_state_json jsonb,
      chart_images_json jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

// GET /api/chart-analyses?pair=EURUSD&history=1 -> last N analyses for that pair
// GET /api/chart-analyses?pair=EURUSD           -> latest only
// GET /api/chart-analyses                       -> latest per pair (for radar)
export async function GET(request: Request) {
  try {
    await ensureChartTable();
    const { searchParams } = new URL(request.url);
    const pair = searchParams.get("pair");
    const historyFlag = searchParams.get("history");
    const wantHistory =
      historyFlag === "1" ||
      historyFlag === "true" ||
      historyFlag === "yes";

    if (pair && wantHistory) {
      // full history for one pair (limited)
      const { rows } = await sql`
        SELECT
          id,
          pair,
          timeframes,
          notes,
          analysis_json,
          candle_ends_json,
          checklist_state_json,
          chart_images_json,
          created_at
        FROM chart_analyses
        WHERE pair = ${pair}
        ORDER BY created_at DESC
        LIMIT 20;
      `;

      const entries: ChartAnalysisEntry[] = rows.map((row) => ({
        id: row.id as string,
        pair: row.pair as string,
        timeframes: ((row.timeframes as any) ?? []) as string[],
        notes: (row.notes as string) || "",
        analysis: (row.analysis_json as any) as ChartAnalysis,
        candleEnds: ((row.candle_ends_json as any) ?? {}) as Record<
          string,
          number
        >,
        checklistState:
          ((row.checklist_state_json as any) ?? []) as ChecklistItemState[],
        chartImages:
          ((row.chart_images_json as any) ?? []) as ChartImage[],
        createdAt:
          (row.created_at as Date)?.toISOString?.() ??
          String(row.created_at),
      }));

      return NextResponse.json({ entries });
    }

    if (pair) {
      // latest only for that pair
      const { rows } = await sql`
        SELECT
          id,
          pair,
          timeframes,
          notes,
          analysis_json,
          candle_ends_json,
          checklist_state_json,
          chart_images_json,
          created_at
        FROM chart_analyses
        WHERE pair = ${pair}
        ORDER BY created_at DESC
        LIMIT 1;
      `;

      if (rows.length === 0) {
        return NextResponse.json({ entry: null });
      }

      const row = rows[0];
      const entry: ChartAnalysisEntry = {
        id: row.id as string,
        pair: row.pair as string,
        timeframes: ((row.timeframes as any) ?? []) as string[],
        notes: (row.notes as string) || "",
        analysis: (row.analysis_json as any) as ChartAnalysis,
        candleEnds: ((row.candle_ends_json as any) ?? {}) as Record<
          string,
          number
        >,
        checklistState:
          ((row.checklist_state_json as any) ?? []) as ChecklistItemState[],
        chartImages:
          ((row.chart_images_json as any) ?? []) as ChartImage[],
        createdAt:
          (row.created_at as Date)?.toISOString?.() ??
          String(row.created_at),
      };

      return NextResponse.json({ entry });
    }

    // Radar: latest per pair
    const { rows } = await sql`
      SELECT DISTINCT ON (pair)
        pair,
        analysis_json,
        created_at
      FROM chart_analyses
      ORDER BY pair, created_at DESC;
    `;

    const entries = rows.map((row) => ({
      pair: row.pair as string,
      analysis: (row.analysis_json as any) as ChartAnalysis,
      createdAt:
        (row.created_at as Date)?.toISOString?.() ?? String(row.created_at),
    }));

    return NextResponse.json({ entries });
  } catch (err: any) {
    console.error("chart-analyses GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load chart analyses." },
      { status: 500 },
    );
  }
}

// POST /api/chart-analyses  -> insert a snapshot (used for new analysis AND updates)
export async function POST(request: Request) {
  try {
    await ensureChartTable();
    const body = (await request.json()) as SaveBody;

    const {
      pair,
      timeframes,
      notes,
      analysis,
      candleEnds,
      checklistState,
      chartImages,
    } = body;

    if (!pair || !analysis) {
      return NextResponse.json(
        { error: "pair and analysis are required." },
        { status: 400 },
      );
    }

    const id = makeId();

    await sql`
      INSERT INTO chart_analyses (
        id,
        pair,
        timeframes,
        notes,
        analysis_json,
        candle_ends_json,
        checklist_state_json,
        chart_images_json
      )
      VALUES (
        ${id},
        ${pair},
        ${JSON.stringify(timeframes || [])}::jsonb,
        ${notes || ""},
        ${JSON.stringify(analysis)}::jsonb,
        ${JSON.stringify(candleEnds || {})}::jsonb,
        ${JSON.stringify(checklistState || [])}::jsonb,
        ${JSON.stringify(chartImages || [])}::jsonb
      );
    `;

    return NextResponse.json({ id });
  } catch (err: any) {
    console.error("chart-analyses POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to save chart analysis." },
      { status: 500 },
    );
  }
}
