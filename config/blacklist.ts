export const BLACKLIST_KEYWORDS: string[] = [
  "betting",
  "casino",
  "highlights",
  "recap",
  "live blog"
];

export function isBlacklistedTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return BLACKLIST_KEYWORDS.some((kw) => lower.includes(kw));
}

