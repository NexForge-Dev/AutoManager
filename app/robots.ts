import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/termos", "/privacidade", "/cancelamento", "/loja/"],
        disallow: [
          "/api/",
          "/admin",
          "/painel",
          "/onboarding",
          "/revenda",
          "/acesso",
          "/redefinir-senha",
          "/vender",
          "/produtos",
          "/revendedoras",
          "/reposicao",
          "/financeiro",
          "/recebimentos",
          "/relatorios",
          "/analytics",
          "/entregas",
          "/conversas",
          "/configuracoes",
          "/minha-loja",
          "/perfil",
          "/planos",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
