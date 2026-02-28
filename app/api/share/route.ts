import { NextRequest, NextResponse } from "next/server";
import { addArticle, supabase } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let url = "";
  let title = "";

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await req.formData();
    url = ((formData.get("url") as string) ?? "").trim();
    title = ((formData.get("title") as string) ?? "").trim();
  } else {
    const json = await req.json().catch(() => ({}));
    url = (json.url ?? "").trim();
    title = (json.title ?? "").trim();
  }

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  if (!title) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" },
        signal: AbortSignal.timeout(5000),
      });
      const html = await res.text();
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (match) title = match[1].trim();
    } catch {
      title = url;
    }
  }

  try {
    await addArticle({
      url,
      title: title || url,
      source: "share-target",
    });

    await supabase
      .from("articles")
      .update({ relevance_score: 10, category: null })
      .eq("url", url);

    return NextResponse.redirect(new URL("/", req.url), 303);
  } catch (error) {
    console.error("Erreur API Share:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
