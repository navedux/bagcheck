import type { MetadataRoute } from "next";
import { ANSWER_BOTS, CRAWL_BLOCKED, PREVIEW_BOTS, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // A shared check link still gets its card on X, Slack, Discord.
      { userAgent: [...PREVIEW_BOTS], allow: "/", disallow: "/api/" },
      // Everyone else, search and AI crawlers included: home, about, llms.txt.
      { userAgent: ["*", ...ANSWER_BOTS], allow: "/", disallow: [...CRAWL_BLOCKED] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
