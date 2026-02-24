import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { addArticle, getBlacklist, getFeeds } from "@/lib/db";

export const runtime = "nodejs";

const parser = new Parser();

async function runIngestionOnce() {
  const [feeds, blacklist] = await Promise.all([getFeeds(), getBlacklist()]);

  const blacklistKeywords = blacklist.map((b) => b.keyword.toLowerCase());

  const isBlacklistedTitle = (title: string): boolean => {
    const lower = title.toLowerCase();
    return blacklistKeywords.some((kw) => lower.includes(kw));
  };

  for (const source of feeds) {
    try {
      const feed = await parser.parseURL(source.url);
      for (const item of feed.items) {
        const title = item.title ?? "";
        const link = item.link ?? "";

        if (!title || !link) continue;
        if (isBlacklistedTitle(title)) {
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        await addArticle({
          url: link,
          title,
          source: source.name
        });
      }
    } catch (err) {
      console.error(`Error ingesting feed ${source.name}`, err);
    }
  }
}

export async function GET() {
  try {
    await runIngestionOnce();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Cron ingestion failed", err);
    return NextResponse.json(
      { ok: false, error: "Cron ingestion failed" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}

