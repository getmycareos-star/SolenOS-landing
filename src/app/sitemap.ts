import type { MetadataRoute } from "next";

const SITE_URL = "https://solenosai.netlify.app";

/**
 * Public, indexable SolenOS pages only.
 * Workspace and care-record URLs are intentionally excluded because they
 * contain private, session-scoped care information and are not public landing pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const publicPaths = [
    { path: "", priority: 1.0 },
    { path: "/how-it-works", priority: 0.8 },
    { path: "/about", priority: 0.6 },
    { path: "/privacy", priority: 0.4 },
    { path: "/terms", priority: 0.4 },
    { path: "/support", priority: 0.5 },
  ] as const;

  return publicPaths.map(({ path, priority }) => ({
    url: new URL(path || "/", SITE_URL).toString(),
    changeFrequency: "monthly",
    priority,
  }));
}
