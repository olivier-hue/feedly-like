import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import { GoogleGenerativeAI } from "@google/generative-ai";

// On force cette route à ne pas être mise en cache par Vercel
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const parser = new Parser();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// --- Fonctions utilitaires (Ingestion) ---
async function resolveGoogleNewsUrl(url: string): Promise<string> {
  if (!url.includes("news.google.com")) return url;
  try {
    const response = await fetch(url, { 
      method: 'GET', 
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0' },
      next: { revalidate: 0 } 
    });
    return response.url.includes("consent.google.com") ? url : response.url;
  } catch { return url; }
}

export async function GET(request: Request) {
  // Optionnel : Vérification d'une clé secrète dans les headers pour la sécurité
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    console.log("--- START CRON JOB ---");

    // PARTIE 1 : INGESTION
    const { data: feeds } = await supabase.from('feeds').select('*').eq('active', true);
    const { data: blacklistData } = await supabase.from('blacklist').select('keyword');
    const blacklist = blacklistData?.map(b => b.keyword.toLowerCase()) || [];

    if (feeds) {
      for (const source of feeds) {
        try {
          const feed = await parser.parseURL(source.url);
          for (const item of feed.items) {
            if (!item.title || !item.link) continue;
            if (blacklist.some(k => item.title!.toLowerCase().includes(k))) continue;

            const finalUrl = await resolveGoogleNewsUrl(item.link);
            await supabase.from('articles').insert([{
              title: item.title,
              url: finalUrl,
              source: source.name,
              published_at: item.isoDate || new Date().toISOString(),
              is_read: false
            }]);
          }
        } catch (e) { console.error(`Error feed ${source.name}:`, e); }
      }
    }

    // PARTIE 2 : ANALYSE GEMINI (On analyse les 5 derniers non-analysés pour éviter les timeouts)
    const { data: unanalyzed } = await supabase
      .from('articles')
      .select('*')
      .is('analysis_json', null)
      .limit(5);

    if (unanalyzed && unanalyzed.length > 0) {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      for (const article of unanalyzed) {
        try {
            const prompt = `Analyze this sports business article: Title: ${article.title}. 
            Return JSON only: { "relevance_score": 0-10, "category": "One from list", "summary": "Short fr", "access": "free/paywall" }`;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().replace(/```json|```/g, "").trim();
            const analysis = JSON.parse(text);

            await supabase.from('articles').update({
              analysis_json: analysis,
              relevance_score: analysis.relevance_score,
              category: analysis.category,
              summary: analysis.summary,
              access_status: analysis.access
            }).eq('id', article.id);
        } catch (e) { console.error("Gemini error:", e); }
      }
    }

    return NextResponse.json({ success: true, message: "Ingest and Analysis completed" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}