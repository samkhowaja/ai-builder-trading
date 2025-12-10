// app/api/analyze-charts/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type UploadImage = {
  name: string;
  dataUrl: string;
};

type Body = {
  pair: string;
  timeframes: string[];
  notes?: string;
  images: UploadImage[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const { pair, timeframes, notes, images } = body;

    if (!pair || !images || !images.length) {
      return NextResponse.json(
        { error: "pair and at least one image are required." },
        { status: 400 },
      );
    }

    const tfText = timeframes && timeframes.length
      ? timeframes.join(", ")
      : "unknown timeframes";

    const userText = `
You are an experienced ICT / Smart Money trader and teacher.

You are analyzing chart screenshots for ${pair}.
The user has uploaded multiple images that (most likely) correspond to these timeframes: ${tfText}.

Some rules:
- Assume higher timeframes (like H4, H1) show structure and liquidity.
- Lower timeframes (like M15, M5, M1) show entry refinement.

User notes (if any):
${notes || "No extra notes."}

Your job:
1) Identify the higher-timeframe narrative.
   - Trend / range?
   - Key highs/lows, liquidity pools, obvious stops.
2) Using all images together, explain the liquidity story.
   - Which highs/lows are being engineered, which are being raided?
3) Find 1–2 possible high-probability entries.
   - Mention which timeframe you would execute on.
   - Give an example of entry, SL and TP (in R, not exact pips).
4) List red flags / reasons NOT to trade.
   - News, choppy structure, no clear external liquidity, etc.
5) Finish with a short checklist the user can re-use.

Keep it beginner-friendly, but still technically correct.
Do NOT guess exact prices; speak in terms of structure and behaviour.`;

    // Build content for multi-image vision request
    const content: any[] = [
      { type: "text", text: userText },
    ];

    for (const img of images) {
      content.push({
        type: "input_image",
        image_url: {
          url: img.dataUrl,
        },
      });
      // also add a tiny text tag so the model knows which file it saw
      content.push({
        type: "text",
        text: `Above image file name: ${img.name}`,
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You are a precise, honest trading assistant." },
        {
          role: "user",
          content,
        },
      ],
      temperature: 0.6,
    });

    const analysis =
      completion.choices[0]?.message?.content ??
      "No analysis was generated.";

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("analyze-charts error:", err);
    return NextResponse.json(
      { error: "Failed to analyze charts." },
      { status: 500 },
    );
  }
}
