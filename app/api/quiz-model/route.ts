import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "../../../lib/supabaseClient";

// POST /api/quiz-model
// Body: { modelId: string }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { modelId } = body as { modelId?: string };

    if (!modelId) {
      return NextResponse.json({ error: "Missing modelId" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set on the server" },
        { status: 500 }
      );
    }

    // 1) Load entry model from Supabase
    const { data: model, error: modelError } = await supabase
      .from("models")
      .select("*")
      .eq("id", modelId)
      .single();

    if (modelError || !model) {
      console.error("Supabase model error:", modelError);
      return NextResponse.json(
        { error: "Model not found" },
        { status: 404 }
      );
    }

    // Optional: get project name + a few video titles for extra context
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", model.project_id)
      .single();

    const { data: videos } = await supabase
      .from("videos")
      .select("title, notes")
      .eq("project_id", model.project_id)
      .limit(3);

    const context = {
      projectName: project?.name ?? null,
      model: {
        name: model.name,
        category: model.category,
        timeframes: model.timeframes,
        duration: model.duration,
        description: model.description,
      },
      sampleVideos: videos ?? [],
    };

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: `
You are an ICT/SMC trading coach.

The user will give you ONE entry model (name, category, timeframes, duration, description) plus a few study videos.
Your job is to create a short QUIZ to test whether they really understand that setup.

Return STRICT JSON ONLY with this shape:

{
  "questions": [
    {
      "question": "Question 1 text here...",
      "answer": "Ideal answer in 2–6 bullet points or a short paragraph."
    },
    {
      "question": "Question 2 text here...",
      "answer": "..."
    }
  ]
}

Guidelines:
- Ask 4–7 questions (5 is ideal).
- Use ICT/SMC language (liquidity, inducement, FVG, OB, BOS, SSL, BSL, killzones, etc.) when appropriate.
- Mix:
  - scenario questions ("Price does X, Y, Z… where is the high-probability entry?")
  - rule questions ("List the confluences you need before entering.")
- Focus only on that model, not generic trading psychology or risk advice.
- The "answer" field should be the *ideal* checklist an experienced trader would give.
- DO NOT wrap in markdown/backticks. JSON only.
`,
        },
        {
          role: "user",
          content:
            "Here is the entry model and related context as JSON:\n\n" +
            JSON.stringify(context, null, 2),
        },
      ],
      max_output_tokens: 800,
    });

    const rawText = (response as any).output_text ?? "";
    let questions: { question: string; answer: string }[] = [];

    try {
      const parsed = JSON.parse(rawText);

      if (Array.isArray(parsed)) {
        questions = parsed as any;
      } else if (Array.isArray(parsed.questions)) {
        questions = parsed.questions as any;
      }
    } catch (parseErr) {
      console.error("Failed to parse quiz JSON:", parseErr, rawText);
      // Fallback: simple generic questions
      questions = [
        {
          question: `Describe the ideal market conditions to use the "${model.name}" setup.`,
          answer:
            "Explain higher timeframe bias, required structure (BOS/CHOCH), liquidity conditions and killzone/timing.",
        },
        {
          question: "List your exact entry checklist for this model.",
          answer:
            "Write the steps you must see before entering: liquidity grab, FVG/OB location, candle confirmation, etc.",
        },
      ];
    }

    // Basic cleanup
    questions = questions
      .filter((q) => q && q.question)
      .map((q) => ({
        question: String(q.question).trim(),
        answer: q.answer ? String(q.answer).trim() : "",
      }));

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("quiz-model route error:", err);
    return NextResponse.json(
      { error: "Unexpected error in quiz-model route" },
      { status: 500 }
    );
  }
}
