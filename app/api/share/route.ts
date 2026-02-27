import { NextRequest, NextResponse } from "next/server";
import { addArticle } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  console.log("Share received - contentType:", contentType);

  let url = "";
  let title = "";

  // 1. Extraction des données (Support JSON et Formulaire iOS)
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await req.formData();
    url = (formData.get("url") as string) ?? "";
    title = (formData.get("title") as string) ?? "";
  } else {
    const json = await req.json().catch(() => ({}));
    url = (json.url ?? "").trim();
    title = (json.title ?? "").trim();
    // Si url est vide mais title contient une URL après un saut de ligne
    if (!url && title) {
      const lines = title.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.startsWith("http")) {
          url = line;
          title = lines.filter((l) => l !== line).join(" ").trim();
          break;
        }
      }
    }
    // Si url est toujours vide, cherche une URL n'importe où dans title
    if (!url && title) {
      const urlMatch = title.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        url = urlMatch[0];
        title = title.replace(url, "").trim();
      }
    }
    // If url is empty but title looks like a URL, use it as url
    if (!url && title.startsWith("http")) {
      url = title;
      title = "";
    }
    // Remove any URL found inside the title
    title = title.replace(/\s*https?:\/\/[^\s]+/gi, "").trim();
  }

  console.log("Share received - body:", { url, title });

  if (url && !title) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" },
        signal: AbortSignal.timeout(5000),
      });
      const html = await res.text();
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (match) title = match[1].trim();
    } catch {
      title = url; // fallback
    }
  }

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    // 3. Ajout de l'article en base (statut non lu par défaut)
    await addArticle({
      url,
      title: title || url,
      source: "iOS Share",
    });

    return NextResponse.json({ success: true, message: "Lien ajouté." });

  } catch (error) {
    console.error("Erreur API Share:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}