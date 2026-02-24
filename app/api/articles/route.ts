import { NextRequest, NextResponse } from "next/server";
import { type ArticleRow, getArticles } from "@/lib/db";

export const runtime = "nodejs";

type ArticleApiRow = ArticleRow & {
  domain: string;
};

function domainFromUrl(url: string): string {
  try {
    const u = new URL(url);
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host;
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const minScoreParam = Number(searchParams.get("minScore") ?? "5");
  const includeRead = searchParams.get("includeRead") === "true";

  const minScore = Number.isFinite(minScoreParam) ? minScoreParam : 5;

  const rows = await getArticles({
    minScore,
    includeRead
  });

  const data: ArticleApiRow[] = rows.map((row) => ({
    ...row,
    domain: domainFromUrl(row.url)
  }));

  return NextResponse.json({ data });
}

