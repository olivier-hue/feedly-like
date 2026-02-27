import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel max for hobby plan

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST() {
  const { data: unanalyzed } = await supabase
    .from('articles')
    .select('*')
    .is('analysis_json', null)
    .order('created_at', { ascending: false })
    .limit(5); // Keep low to stay within Vercel 60s timeout

  console.log(`Articles to analyze: ${unanalyzed?.length ?? 0}`);
  if (unanalyzed && unanalyzed.length > 0) {
    console.log(`First article:`, unanalyzed[0].id, unanalyzed[0].title);
  }

  if (!unanalyzed || unanalyzed.length === 0) {
    return NextResponse.json({ success: true, analyzed: 0, message: "Nothing to analyze" });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  let analyzed = 0;

  for (const article of unanalyzed) {
    try {
      const prompt = `You are a sports business analyst. Analyze this article and return ONLY a valid JSON object, no markdown, no explanation.

Article title: "${article.title}"
Article URL: "${article.url}"

Return this exact JSON structure:
{
  "relevance_score": <integer 0-10, how relevant this is to sports business/marketing/economics>,
  "category": "<one of: Activation, Basketball, Branding, Cyclisme, eSport, Football, Football US, Golf, Handball, Hockey-sur-Glace, Institutions, International, LA28, Marques & Entreprises, Médias, Merchandising, Milan Cortina 2026, MMA, Paris 2024, RSE, Rugby, Ski, Sponsoring, Stades & Arenas, Tennis / Padel, Tous les sports, Voile, Volleyball>",
  "summary": "<2-3 sentence summary in French>",
  "access": "<free or paywall>"
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, "").trim();
      const analysis = JSON.parse(text);

      await supabase.from('articles').update({
        analysis_json: JSON.stringify(analysis),
        relevance_score: analysis.relevance_score,
        category: analysis.category,
        summary: analysis.summary,
        access_status: analysis.access
      }).eq('id', article.id);

      analyzed++;
      if (analyzed < unanalyzed.length) await sleep(6000);
    } catch (e) {
      console.error(`Gemini error for article ${article.id}:`, e);
    }
  }

  return NextResponse.json({ success: true, analyzed });
}