import { NextRequest, NextResponse } from "next/server";
import { addArticle } from "@/lib/db";
import { analyzeArticleWithGemini } from "@/lib/gemini-analyzer"; // Assure-toi que le chemin est correct

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

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
    url = json.url ?? "";
    title = json.title ?? "";
    secret = json.secret ?? "";
  }

  // 2. Vérification de sécurité (Important pour IOS)
  if (secret !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    // 3. Ajout de l'article en base (statut non lu par défaut)
    const newArticles = await addArticle({
      url,
      title: title || url,
      source: "iOS Share",
    });

    // 4. ANALYSE GEMINI : On lance l'analyse immédiatement
    if (newArticles && newArticles.length > 0) {
      const articleId = newArticles[0].id;
      
      // On ne met pas "await" ici pour que l'iPhone reçoive la confirmation 
      // tout de suite, pendant que Gemini travaille en arrière-plan.
      analyzeArticleWithGemini(articleId).catch((err) => 
        console.error("Erreur analyse Gemini iOS:", err)
      );
    }

    // 5. Réponse pour le Raccourci iOS
    return NextResponse.json({ 
      success: true, 
      message: "Lien ajouté. Analyse Gemini en cours..." 
    });

  } catch (error) {
    console.error("Erreur API Share:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}