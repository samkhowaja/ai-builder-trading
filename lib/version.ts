// app/api/version/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  const ref = process.env.VERCEL_GIT_COMMIT_REF || "local";
  const builtAt = new Date().toISOString();

  // Simple “auto increment”: each new commit has a new SHA, so version changes automatically
  const shortSha = sha.slice(0, 7);
  const version = `v1.0.${shortSha}`;

  return NextResponse.json(
    {
      version,
      sha: shortSha,
      branch: ref,
      builtAt,
    },
    { status: 200 }
  );
}
