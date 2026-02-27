import { NextRequest, NextResponse } from "next/server";
import { addArticle } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  console.log("Share received - contentType:", contentType);

  let url = "";
  let title = "";
  let secret = "";

  // 1. Extraction des données (Support JSON et Formulaire iOS)
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await req.formData();
    url = (formData.get("url") as string) ?? "";
    title = (formData.get("title") as string) ?? "";
    secret = (formData.get("secret") as string) ?? "";
  } else {
    const json = await req.json().catch(() => ({}));
    url = (json.url ?? "").trim();
    title = (json.title ?? "").trim();
    secret = json.secret ?? "";
    // If url is empty but title looks like a URL, use it as url
    if (!url && title.startsWith("http")) {
      url = title;
      title = "";
    }
    // Remove any URL found inside the title
    title = title.replace(/\s*https?:\/\/[^\s]+/gi, "").trim();
  }

  console.log("Share received - body:", { url, title });

  // 2. Vérification de sécurité (Important pour IOS)
  if (secret !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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