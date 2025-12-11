export async function POST(req: Request) {
  try {
    console.log("📥 /api/analyze-charts called");

    const form = await req.formData();

    const pair = form.get("pair") as string;
    const prompt = form.get("prompt") as string;
    const tf = form.get("timeframes") as string;

    console.log("pair:", pair);
    console.log("prompt length:", prompt?.length);
    console.log("timeframes:", tf);

    const images: File[] = [];
    form.forEach((value, key) => {
      if (key.startsWith("image_")) images.push(value as File);
    });
    console.log("images:", images.length);

    // ... continue logic
  } catch (err: any) {
    console.error("❌ analyze-charts error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
}
