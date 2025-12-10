import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type EntryModel = {
  id: string;
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

    const systemPrompt = `You are a professional price action / ICT-style trading coach.
You explain things simply but precisely. The user is building "entry models" for Forex / indices.

Model details:
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

Always answer in short sections with clear headings and bullet points.
Keep it practical, no fluff.`;

    let userPrompt = "";

    if (mode === "explain") {
      userPrompt = `Explain this entry model to a trader who knows basics but is still learning smart money concepts.

Include:
1) One-line summary
2) When to use this model (market conditions, sessions)
3) Step-by-step checklist from HTF to LTF
4) What invalidates the setup (when NOT to take it)
5) Risk management notes in very concrete terms`;
    } else if (mode === "improve") {
      userPrompt = `Audit this entry model and suggest improvements.

Include:
1) Weak points or missing rules
2) How to avoid overtrading / revenge trading with this model
3) Extra filters that would improve quality (e.g., HTF bias, sessions, news filters)
4) A "version 2.0" of the rules as bullet points`;
    } else if (mode === "examples") {
      userPrompt = `Give 2 example trade scenarios using this model.

For each example:
- HTF context (trend, liquidity, key levels)
- LTF entry trigger (what candle / pattern or FVG etc.)
- Example numbers for Entry, SL, TP in R-multiple (e.g. "SL is 10 pips, TP is 30 pips = 3R")
- What would make you skip this trade at the last second`;
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const text =
      response.output[0].type === "message"
        ? response.output[0].content
            .filter((c: any) => c.type === "output_text" || c.type === "text")
            .map((c: any) => c.text || c.output_text?.text || "")
            .join("\n")
        : "Unable to generate response.";

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("AI coach error:", err);
    return NextResponse.json(
      { error: "Failed to generate explanation." },
      { status: 500 },
    );
  }
}
