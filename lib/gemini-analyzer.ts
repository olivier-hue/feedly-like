import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";
import {
  type ArticleRow,
  getArticleById,
  updateArticleAnalysis
} from "@/lib/db";

const GEMINI_MODEL = "gemini-2.5-flash";

const VALID_CATEGORIES = [
  "Activation",
  "Alpes 2030",
  "Ambush",
  "Athlétisme",
  "Aviron",
  "Badminton",
  "Basketball",
  "Boxe",
  "Branding",
  "Campagne",
  "Catch",
  "Chiffre",
  "Cyclisme",
  "Emploi",
  "Equitation",
  "Escalade",
  "Escrime",
  "eSport",
  "Fitness",
  "Football",
  "Football US",
  "Golf",
  "Gymnastique",
  "Handball",
  "Hippisme",
  "Hockey-sur-Glace",
  "Hommes & Femmes",
  "Insolite",
  "Institutions",
  "International",
  "Judo",
  "Karate",
  "LA28",
  "Marques & Entreprises",
  "Médias",
  "Merchandising",
  "Milan Cortina 2026",
  "MMA",
  "Natation",
  "Paris 2024",
  "Patinage artistique",
  "Podcast",
  "RSE",
  "Rugby",
  "Ski",
  "Sponsoring",
  "Sports de combat",
  "Sports de glisse",
  "Sports mécaniques",
  "Stades & Arenas",
  "Sumo",
  "Tennis / Padel",
  "Tennis de table",
  "Tir",
  "Tous les sports",
  "Trail",
  "Triathlon",
  "Vidéo",
  "Voile",
  "Volleyball"
] as const;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Please create a .env file with GEMINI_API_KEY=your_key_here"
    );
  }
  return key;
}

const genAI = new GoogleGenerativeAI(getApiKey());
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

async function fetchArticleHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SportsEsportsBusinessCurator/1.0)"
      }
    });
    if (!res.ok) {
      console.error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      return null;
    }
    const html = await res.text();
    return html;
  } catch (err) {
    console.error(`Error fetching ${url}:`, err);
    return null;
  }
}

function extractMainText(html: string): string {
  const $ = cheerio.load(html);

  $("script, style, noscript, iframe").remove();

  const articleEl =
    $("article").first().text() ||
    $("main").first().text() ||
    $("body").first().text();

  const text = articleEl
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();

  return text;
}

type GeminiAnalysis = {
  category: string;
  relevance_score: number;
  access_status: "free" | "paywall" | "registration" | "video" | "audio";
  summary: string;
};

function normalizeAccessStatus(status: string): string {
  const s = status.toLowerCase();
  switch (s) {
    case "free":
      return "Free";
    case "paywall":
      return "Paywall";
    case "registration":
      return "Registration";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    default:
      return "Free";
  }
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 10) return 10;
  return Math.round(n);
}

function normalizeCategory(category: string): string {
  const raw = category.trim();
  if (!raw) return "Tous les sports";

  const match = VALID_CATEGORIES.find(
    (c) => c.toLowerCase() === raw.toLowerCase()
  );

  if (match) return match;

  return "Tous les sports";
}

function parseGeminiJson(text: string): GeminiAnalysis | null {
  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, "").replace(/```$/, "").trim();
  }

  try {
    const obj = JSON.parse(cleaned);
    if (
      typeof obj.category === "string" &&
      typeof obj.relevance_score === "number" &&
      typeof obj.access_status === "string" &&
      typeof obj.summary === "string"
    ) {
      return obj as GeminiAnalysis;
    }
  } catch {
    // fall through
  }

  console.error("Failed to parse Gemini JSON:", text);
  return null;
}

export async function analyzeArticleRow(article: ArticleRow): Promise<void> {
  console.log(`Analyzing article #${article.id}: ${article.title}`);

  const html = await fetchArticleHtml(article.url);
  if (!html) {
    return;
  }

  const contentText = extractMainText(html);

  const prompt = `
Analyze this article about Sports/Esports business.

Return ONLY a JSON object matching this schema:
{
  "category": "string",
  "relevance_score": number,
  "access_status": "free" | "paywall" | "registration" | "video" | "audio",
  "summary": "string"
}

Provide a concise 1-2 sentence summary in French in the "summary" field, focusing on the business/economic impact mentioned in the article.

You MUST categorize the article into exactly ONE of the following categories: ${VALID_CATEGORIES.join(
    ", "
  )}. Do not invent new categories. If the article fits multiple, choose the most specific one (for example choose "Milan Cortina 2026" over "Ski"). If unsure, use "Tous les sports".

Relevance 10 = pure business/economy. Relevance 0 = scores/match recaps.

Article title:
${article.title}

Article content:
${contentText}
`.trim();

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  const parsed = parseGeminiJson(responseText);
  if (!parsed) {
    return;
  }

  const category = normalizeCategory(parsed.category);
  const relevanceScore = clampScore(parsed.relevance_score);
  const accessStatus = normalizeAccessStatus(parsed.access_status);
  const summary = parsed.summary;

  await updateArticleAnalysis({
    id: article.id,
    category,
    relevance_score: relevanceScore,
    access_status: accessStatus,
    summary,
    analysis_json: JSON.stringify({
      ...parsed,
      category,
      model: GEMINI_MODEL,
      analyzed_at: new Date().toISOString()
    }),
    raw_html: html
  });

  console.log(
    `Updated article #${article.id} => category="${category}", score=${relevanceScore}, access=${accessStatus}`
  );
}

export async function analyzeArticleById(id: number): Promise<void> {
  const row = await getArticleById(id);

  if (!row) {
    throw new Error(`Article with id ${id} not found`);
  }

  await analyzeArticleRow(row);
}

