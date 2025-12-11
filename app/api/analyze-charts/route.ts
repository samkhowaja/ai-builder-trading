// app/api/analyze-charts/route.ts

export const dynamic = "force-dynamic"; // make sure this route is always dynamic

type ChecklistItem = {
  label: string;
  done: boolean;
};

type AnalysisSection = {
  title: string;
  body: string;
  checklist?: ChecklistItem[];
};

type AnalysisPayload = {
  id: string;
  pair: string;
  createdAt: string;
  quality: "A+" | "A" | "B" | "C";
  sections: AnalysisSection[];
};

export async function POST(req: Request): Promise<Response> {
  try {
    console.log("📥 /api/analyze-charts called");

    const form = await req.formData();

    const pair = (form.get("pair") as string) ?? "UNKNOWN";
    const prompt = (form.get("prompt") as string) ?? "";
    const tfJson = (form.get("timeframes") as string) ?? "[]";

    let timeframes: string[] = [];
    try {
      timeframes = JSON.parse(tfJson);
    } catch {
      timeframes = [];
    }

    console.log("pair:", pair);
    console.log("prompt length:", prompt.length);
    console.log("timeframes:", timeframes);

    const images: File[] = [];
    form.forEach((value, key) => {
      if (key.startsWith("image_")) {
        images.push(value as File);
      }
    });

    console.log("images received:", images.length);

    // --------------------------------------------------
    // For now: return a MOCK analysis so the UI works.
    // Later we'll swap this for real OpenAI + DB logic.
    // --------------------------------------------------

    const id =
      (globalThis as any).crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const nowIso = new Date().toISOString();

    const analysis: AnalysisPayload = {
      id,
      pair,
      createdAt: nowIso,
      quality: "A",
      sections: [
        {
          title: "1. Higher timeframe bias & context",
          body:
            `• Pair: ${pair}\n` +
            `• Timeframes shared: ${timeframes.join(", ") || "not specified"}\n\n` +
            `This is a mock analysis so you can test the UI. ` +
            `The backend successfully parsed your form-data and returned a JSON payload.`,
          checklist: [
            {
              label: "HTF bias is clear and aligned",
              done: true,
            },
            {
              label: "Liquidity sweep / grab identified",
              done: false,
            },
          ],
        },
        {
          title: "2. Liquidity story & structure",
          body:
            "Imagine here the AI describes liquidity grabs, inducement, breaks of structure " +
            "and where smart money is likely accumulating or distributing.\n\n" +
            "Once we plug in the real OpenAI call, this section will be generated from your screenshots + prompt.",
          checklist: [
            {
              label: "Key swing highs / lows marked",
              done: true,
            },
            {
              label: "FVGs / imbalance zones identified",
              done: true,
            },
          ],
        },
        {
          title: "3. Entry model & SL / TP idea",
          body:
            "Here the tool will suggest an example entry model, including a preferred timeframe, " +
            "entry zone, invalidation (SL), and one or two targets (TP1 / TP2) based on liquidity pools.\n\n" +
            "For now this is dummy text so you can see how the ebook layout behaves.",
          checklist: [
            {
              label: "Entry aligned with HTF bias",
              done: false,
            },
            {
              label: "Logical SL beyond liquidity / structure",
              done: false,
            },
            {
              label: "At least 1:2 R:R to first target",
              done: false,
            },
          ],
        },
      ],
    };

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err: any) {
    console.error("❌ analyze-charts error:", err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message ?? "Unknown server error in /api/analyze-charts",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
