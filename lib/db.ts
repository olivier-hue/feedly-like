import "dotenv/config";

export type ArticleRow = {
  id: number;
  url: string;
  title: string;
  source: string | null;
  category: string | null;
  relevance_score: number;
  access_status: string | null;
  newsletter_snippet: string | null;
  is_read: number;
  created_at: string;
  raw_html: string | null;
  analysis_json: string | null;
  summary: string | null;
};

export type FeedRow = {
  id: string;
  name: string;
  url: string;
  category: string | null;
  active: boolean;
  created_at: string;
};

export type BlacklistRow = {
  id: string;
  keyword: string;
  created_at: string;
};

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase environment variables are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getArticles(options: {
  minScore: number;
  includeRead: boolean;
}): Promise<ArticleRow[]> {
  const { minScore, includeRead } = options;

  let query = supabase
    .from("articles")
    .select("*")
    .or(`relevance_score.gte.${minScore},relevance_score.is.null`)
    .order("created_at", { ascending: false });

  if (!includeRead) {
    query = query.eq("is_read", 0);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching articles from Supabase:", error);
    throw error;
  }

  return (data ?? []) as ArticleRow[];
}

export async function addArticle(input: {
  url: string;
  title: string;
  source: string;
}) {
  const { url, title, source } = input;

  const { error } = await supabase.from("articles").upsert(
    {
      url,
      title,
      source
    },
    {
      onConflict: "url"
    }
  );

  if (error) {
    console.error("Error upserting article into Supabase:", error);
    throw error;
  }
}

export async function markAsRead(id: number) {
  const { error, data } = await supabase
    .from("articles")
    .update({ is_read: 1 })
    .eq("id", id);

  if (error) {
    console.error("Error marking article as read:", error);
    throw error;
  }

  return data;
}

export async function getUnanalyzedArticles(limit: number): Promise<ArticleRow[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .is("analysis_json", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching unanalyzed articles from Supabase:", error);
    throw error;
  }

  return (data ?? []) as ArticleRow[];
}

export async function getArticleById(id: number): Promise<ArticleRow | null> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching article by id from Supabase:", error);
    throw error;
  }

  return (data as ArticleRow | null) ?? null;
}

export async function updateArticleAnalysis(args: {
  id: number;
  category: string;
  relevance_score: number;
  access_status: string;
  summary: string;
  analysis_json: string;
  raw_html: string;
}) {
  const { id, category, relevance_score, access_status, summary, analysis_json, raw_html } =
    args;

  const { error } = await supabase
    .from("articles")
    .update({
      category,
      relevance_score,
      access_status,
      summary,
      analysis_json,
      raw_html
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating article analysis in Supabase:", error);
    throw error;
  }
}

export async function getFeeds(): Promise<FeedRow[]> {
  const { data, error } = await supabase
    .from("feeds")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching feeds from Supabase:", error);
    throw error;
  }

  return (data ?? []) as FeedRow[];
}

export async function addFeed(input: {
  url: string;
  name: string;
  category?: string | null;
}) {
  const { url, name, category } = input;

  const { error } = await supabase.from("feeds").upsert(
    {
      url,
      name,
      category: category ?? null,
      active: true
    },
    {
      onConflict: "url"
    }
  );

  if (error) {
    console.error("Error upserting feed into Supabase:", error);
    throw error;
  }
}

export async function deleteFeed(id: string) {
  const { error } = await supabase
    .from("feeds")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    console.error("Error deactivating feed in Supabase:", error);
    throw error;
  }
}

export async function getBlacklist(): Promise<BlacklistRow[]> {
  const { data, error } = await supabase
    .from("blacklist")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching blacklist from Supabase:", error);
    throw error;
  }

  return (data ?? []) as BlacklistRow[];
}

export async function addBlacklistKeyword(word: string) {
  const { error } = await supabase.from("blacklist").insert({
    keyword: word
  });

  if (error) {
    console.error("Error inserting blacklist keyword into Supabase:", error);
    throw error;
  }
}

export async function deleteBlacklistKeyword(id: string) {
  const { error } = await supabase.from("blacklist").delete().eq("id", id);

  if (error) {
    console.error("Error deleting blacklist keyword from Supabase:", error);
    throw error;
  }
}

