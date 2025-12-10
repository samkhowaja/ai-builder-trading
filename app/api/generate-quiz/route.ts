// app/api/generate-quiz/route.ts
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
  model: EntryModel;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const model = body.model;

    if (!model) {
      return NextResponse.json({ error: "Model is required." }, { status: 400 });
    }

    const systemPrompt = `You are a strict but helpful trading coach.
Create quiz questions about an entry model.
Focus on rules, checklist, risk management, sessions, and invalidation.
Return 5-8 questions, each with a concise correct answer.`;

    const userPrompt = `Here is the entry model:

Name: ${model.name}
Style: ${model.style}
Timeframe: ${model.timeframe}
Instrument: ${model.instrument}
Session: ${model.session}
Risk per trade: ${model.riskPerTrade}%

Description:
${model.description}

Rules:
${model.rules}

Checklist:
${model.checklist.join("\n")}

Tags: ${model.tags.join(", ")}

Task:
Create 5-8 quiz items as JSON, with this exact shape:
[
  { "question": "string", "answer": "string" },
  ...
]
Questions should be concrete (e.g. "When do we avoid entering?", "What is max risk per trade?").
Do NOT add any extra text before or after the JSON.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
    });

    const content = completion.choices[0]?.message?.content ?? "[]";

    let quiz: { question: string; answer: string }[] = [];
    try {
      quiz = JSON.parse(content);
    } catch (e) {
      quiz = [
        {
          question: "Explain the main idea of this entry model.",
          answer: content.slice(0, 600),
        },
      ];
    }

    return NextResponse.json({ quiz });
  } catch (err) {
    console.error("Quiz error:", err);
    return NextResponse.json(
      { error: "Failed to generate quiz." },
      { status: 500 },
    );
  }
}
