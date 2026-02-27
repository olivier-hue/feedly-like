import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const parser = new Parser();

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
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // PART 1: INGESTION
    const { data: feeds } = await supabase.from('feeds').select('*').eq('active', true);
    const { data: blacklistData } = await supabase.from('blacklist').select('keyword');
    const blacklist = blacklistData?.map(b => b.keyword.toLowerCase()) || [];
    let ingested = 0;

    if (feeds) {
      for (const source of feeds) {
        try {
          const feed = await parser.parseURL(source.url);
          for (const item of feed.items) {
            if (!item.title || !item.link) continue;
            if (blacklist.some(k => item.title!.toLowerCase().includes(k))) continue;

            const finalUrl = await resolveGoogleNewsUrl(item.link);
            const { error } = await supabase.from('articles').upsert(
              [{
                title: item.title,
                url: finalUrl,
                source: source.name,
                is_read: false
              }],
              { onConflict: 'url', ignoreDuplicates: true }
            );
            if (error) console.error(`Upsert error for ${item.title}:`, error.message);
            else {
              console.log(`✓ Saved: ${item.title}`);
              ingested++;
            }
          }
        } catch (e) { console.error(`Error feed ${source.name}:`, e); }
        console.log(`✓ Feed processed: ${source.name}`);
      }
    }

    return NextResponse.json({ success: true, ingested });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}