/**
 * Where the public app lives. Canonical links, the sitemap, robots.txt, and
 * share cards all point here, whichever domain served the request. A fork
 * deploying elsewhere changes this one line.
 */
export const SITE_URL = "https://getbagcheck.vercel.app";
export const SITE_NAME = "Bagcheck";
export const REPO_URL = "https://github.com/navedux/bagcheck";

/**
 * Pages worth finding in search and answer engines. Check (/t) and wallet (/w)
 * pages are left out: each visit can spend live Nansen credits, and the answer
 * is stale within a day.
 */
export const INDEXED_PATHS = ["/", "/about"] as const;

/** Link unfurlers fetch a shared page once, the way the person who shared it did. */
export const PREVIEW_BOTS = [
  "Twitterbot",
  "facebookexternalhit",
  "LinkedInBot",
  "Slackbot-LinkExpanding",
  "Discordbot",
  "TelegramBot",
] as const;

/** Search and answer engines, named so they are plainly welcome on the indexed pages. */
export const ANSWER_BOTS = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
] as const;

/** Paths no crawler needs: the API, and pages that call Nansen. */
export const CRAWL_BLOCKED = ["/api/", "/t/", "/w/"] as const;
