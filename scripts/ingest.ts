import 'dotenv/config';
import Parser from 'rss-parser';
import { createClient } from '@supabase/supabase-js';

// --- Configuration Supabase ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const parser = new Parser();

// --- Fonction pour résoudre les liens Google News ---
// Elle simule un navigateur pour éviter la page "Consent" et récupérer la vraie URL
async function resolveGoogleNewsUrl(url: string): Promise<string> {
  // Si ce n'est pas un lien Google, on le retourne direct
  if (!url || !url.includes("news.google.com")) return url;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout de 5s max

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow', // On suit la redirection
      headers: {
        // On se fait passer pour Chrome sur Windows
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Si on tombe quand même sur la page de consentement, on abandonne et on garde l'original
    if (response.url.includes("consent.google.com")) {
      return url;
    }

    // Sinon, on retourne la vraie URL finale (ex: lequipe.fr/...)
    return response.url;

  } catch (error) {
    // En cas d'erreur (timeout ou autre), on ne plante pas, on garde l'URL Google
    return url;
  }
}

async function ingest() {
  console.log("🚀 Starting Ingestion...");

  // 1. Récupérer les flux actifs depuis Supabase
  const { data: feeds, error: feedsError } = await supabase
    .from('feeds')
    .select('*')
    .eq('active', true);

  if (feedsError || !feeds || feeds.length === 0) {
    console.error("❌ No active feeds found in DB or error:", feedsError);
    return;
  }

  // 2. Récupérer la Blacklist depuis Supabase
  const { data: blacklistData } = await supabase
    .from('blacklist')
    .select('keyword');
  
  // On crée un tableau simple de mots-clés en minuscules
  const blacklist = blacklistData?.map(b => b.keyword.toLowerCase()) || [];
  console.log(`📋 Loaded ${feeds.length} feeds and ${blacklist.length} blacklist keywords.`);

  // 3. Boucle sur chaque flux
  for (const source of feeds) {
    console.log(`\n📡 Fetching ${source.name} (${source.url})...`);

    try {
      const feed = await parser.parseURL(source.url);
      let newArticlesCount = 0;

      for (const item of feed.items) {
        const title = item.title;
        const rawUrl = item.link || item.guid;

        if (!title || !rawUrl) continue;

        // A. Vérification Blacklist
        const isBlacklisted = blacklist.some(keyword => 
          title.toLowerCase().includes(keyword)
        );

        if (isBlacklisted) {
          console.log(`   🚫 Skipped (Blacklist): "${title}"`);
          continue;
        }

        // B. Résolution de l'URL (pour Google News)
        const finalUrl = await resolveGoogleNewsUrl(rawUrl);

        // C. Insertion dans Supabase
        const { error } = await supabase.from('articles').insert([
          {
            title: title,
            url: finalUrl,
            source: source.name, // On garde le nom du flux (ex: "Google News - Arena")
            // On ne met pas de catégorie ici, Gemini le fera plus tard
            // On ne met pas de résumé, Gemini le fera plus tard
            published_at: item.isoDate || new Date().toISOString(),
            is_read: false
          }
        ]);

        if (error) {
          // Code 23505 = Violation de contrainte unique (l'URL existe déjà)
          if (error.code === '23505') {
            // C'est normal, on ignore silencieusement
            // process.stdout.write("."); // Optionnel : affiche un point pour dire "déjà vu"
          } else {
            console.error(`   ❌ Error inserting "${title}":`, error.message);
          }
        } else {
          console.log(`   ✅ Saved: "${title}"`);
          newArticlesCount++;
        }
      }

      if (newArticlesCount > 0) {
        console.log(`   -> Added ${newArticlesCount} new articles.`);
      } else {
        console.log(`   -> No new articles.`);
      }

    } catch (err) {
      console.error(`   ❌ Failed to parse feed: ${source.name}`, err);
    }
  }

  console.log("\n🏁 Ingestion complete.");
}

// Lancement du script
ingest();