import type { MetadataRoute } from "next";
import { INDEXED_PATHS, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const built = new Date();
  return INDEXED_PATHS.map((path) => ({
    url: path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`,
    lastModified: built,
  }));
}
