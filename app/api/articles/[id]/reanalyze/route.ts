import { NextResponse } from "next/server";
import { analyzeArticleById } from "@/lib/gemini-analyzer";

export const runtime = "nodejs";

type RouteParams = {
  params: {
    id: string;
  };
};

export async function POST(_req: Request, { params }: RouteParams) {
  const idNum = Number(params.id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await analyzeArticleById(idNum);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error reanalyzing article", err);
    return NextResponse.json(
      { error: "Failed to reanalyze article" },
      { status: 500 }
    );
  }
}

