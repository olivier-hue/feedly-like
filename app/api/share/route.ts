import { NextRequest, NextResponse } from "next/server";
import { addArticle } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  let url = "";
  let title = "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await req.formData();
    url = (formData.get("url") as string) ?? "";
    title = (formData.get("title") as string) ?? "";
  } else if (contentType.includes("application/json")) {
    const json = await req.json().catch(() => ({}));
    url = json.url ?? "";
    title = json.title ?? "";
  }

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  await addArticle({
    url,
    title: title || url,
    source: "share-target"
  });

  return NextResponse.redirect(new URL("/", req.url));
}

