import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date();
  return [
    { url: `${APP_URL}/`, lastModified: agora, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/login`, lastModified: agora, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/termos`, lastModified: agora, changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/privacidade`, lastModified: agora, changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/cancelamento`, lastModified: agora, changeFrequency: "yearly", priority: 0.3 },
  ];
}
