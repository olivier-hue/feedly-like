import "dotenv/config";
import { getUnanalyzedArticles } from "@/lib/db";
import { analyzeArticleRow } from "@/lib/gemini-analyzer";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const rows = await getUnanalyzedArticles(50);

  if (rows.length === 0) {
    console.log("No pending articles to analyze.");
    return;
  }

  console.log(`Found ${rows.length} articles to analyze with Gemini.`);

  for (const row of rows) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await analyzeArticleRow(row);
      console.log("Pausing for 10s to respect rate limits....");
      // eslint-disable-next-line no-await-in-loop
      await delay(10_000);
    } catch (err) {
      console.error(`Error analyzing article #${row.id}:`, err);
    }
  }

  console.log("Analysis complete.");
}

void main();

