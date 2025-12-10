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
};

type Body = {
  mode: "explain" | "improve" | "examples";
  model: EntryModel;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    if (!body.model || !body.mode) {
      return NextResponse.json(
        { error: "model and mode are required" },
        { status: 400 },
      );
    }

    const { model, mode } = body;

    const systemPrompt = `You are a professional smart-money (ICT-style) trading coach.
You explain concepts as if teaching a visual learner who likes screenshots and diagrams.

User is building an "entry model" based on a YouTube video from a trader.
They want:
- Very detailed explanations
- Step-by-step story of price action
- And ideas for what screenshots/images to capture from the YouTube video.

Entry Model:
- Name: ${model.name}
- Style: ${model.style}
- Timeframe: ${model.timeframe}
- Instrument: ${model.instrument}
- Session: ${model.session}
- Risk per trade: ${model.riskPerTrade}%
- Description: ${model.description}
- Rules: ${model.rules}
- Checklist: ${model.checklist.join(" | ")}
- Tags: ${model.tags.join(", ")}

YouTube Source (if available):
- Video title: ${model.sourceVideoTitle || "N/A"}
- Video URL: ${model.sourceVideoUrl || "N/A"}
- Important timestamps / notes:
${model.sourceTimestamps || "N/A"}

Rules for formatting your answer:
- Use clear headings: "Overview", "Step-by-Step Story", "What To Screenshot", etc.
- Use bullet points.
- When you mention images, use a list like:
  Image 1: ...
  Image 2: ...
- Assume the user will pause the YouTube video and take screenshots at those moments.
- Keep language simple but not dumbed down.`;

    let userPrompt = "";

    if (mode === "explain") {
      userPrompt = `Explain this entry model in a very detailed, visual way for a student.

Your answer MUST have these sections:

1) OVERVIEW (1-2 short paragraphs)
   - What is the main idea of this model?
   - What is it trying to exploit (liquidity above highs, FVG, etc.)?

2) STEP-BY-STEP STORY
   - Describe the story of price from HTF to LTF.
   - Talk like: "First on H4 we see..., then on M15..., after London open..., then price grabs liquidity..., then displacement..."
   - Use numbered steps so it's easy to follow.

3) RULES AS CHECKLIST
   - Rewrite the rules as a super clear checklist the user could read while trading.
   - Each line should start with a checkbox style, like: "[ ] HTF bias: bullish on H4 and H1"

4) INVALIDATION / WHEN NOT TO USE IT
   - Explain when this model is dangerous or low quality.
   - Give concrete examples: "No clear external liquidity above the high", "Choppy HTF range", etc.

5) WHAT TO SCREENSHOT FROM THE VIDEO
   - Give 4-8 concrete "Image" descriptions tied to the YouTube content.
   - Example format:
     Image 1: H4 chart where he shows liquidity above the previous day's high (price sitting just below the high).
     Image 2: Right after London open when a big stop-hunt candle runs the high and wicks back.
     Image 3: Lower timeframe (M15) where a Fair Value Gap appears after the stop-hunt.
     Image 4: The exact candle he uses for entry, with SL and TP shown.
   - If timestamps were provided, mention them like: "around 04:10 in the video".

Answer as if you're building a study guide the user can re-open again and again.`;
    } else if (mode === "improve") {
      userPrompt = `Audit this entry model and suggest improvements.

Sections required:

1) COMMON MISTAKES USING THIS MODEL
   - List 5-8 mistakes a trader might make with this model.

2) BETTER FILTERS
   - Extra conditions to add so only high-quality setups pass.
   - Mention higher timeframe structure, true external liquidity, time of day, news, etc.

3) UPGRADED VERSION OF THE RULES
   - Rewrite the rules as "Version 2.0".
   - Use bullet points, grouped under:
     - HTF Framework
     - Liquidity & Levels
     - Entry Trigger
     - Risk Management

4) DRILL / PRACTICE SUGGESTIONS
   - How the user can re-watch the YouTube video and practice spotting the model.
   - Example: "Pause before London open and predict where liquidity sits..."`;
    } else if (mode === "examples") {
      userPrompt = `Give 2 very concrete trade examples using this model.

For EACH example, include:

1) HTF CONTEXT
   - Describe trend, important levels, and where liquidity is sitting.

2) LTF ENTRY
   - Exact trigger: what candle / pattern / FVG appears.
   - Describe it so the user can imagine the chart.

3) NUMBERS (PIPS & R)
   - Example entries like:
     - Entry: 1.0850
     - SL: 1.0840 (10 pips)
     - TP: 1.0880 (30 pips = 3R)

4) LAST-SECOND CANCEL CONDITIONS
   - What would make you cancel the trade idea even if it almost fits the model.

Make these examples feel like real replay situations.`;
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({ text });
  } catch (err) {
    console.error("AI coach error:", err);
    return NextResponse.json(
      { error: "Failed to generate explanation." },
      { status: 500 },
    );
  }
}
