import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// A página da loja é client-side; este layout existe para que o link compartilhado
// (WhatsApp, Instagram…) mostre o nome, descrição e imagem da LOJA em vez da prévia
// genérica do AutoManager, e para que um slug inexistente responda 404 de verdade.

type LojaMeta = { nome: string; descricao: string | null; logo_url: string | null; capa_url: string | null };

// "nao_existe" só quando o banco respondeu que não há loja; erro de rede/servidor
// vira "falha" e a página client-side mostra "tentar de novo" em vez do 404.
type Resultado = { tipo: "ok"; loja: LojaMeta } | { tipo: "nao_existe" } | { tipo: "falha" };

// cache(): generateMetadata e o layout pedem a mesma loja numa única consulta por request
const buscarLoja = cache(async (slug: string): Promise<Resultado> => {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.rpc("loja_publica", { p_slug: slug });
    if (error) return { tipo: "falha" };
    if (!data) return { tipo: "nao_existe" };
    return { tipo: "ok", loja: data as LojaMeta };
  } catch {
    return { tipo: "falha" };
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await buscarLoja(slug);
  if (r.tipo === "nao_existe") return { title: "Loja não encontrada", robots: { index: false } };
  if (r.tipo === "falha") return {};
  const loja = r.loja;

  const descricao = loja.descricao || `Confira os produtos de ${loja.nome}.`;
  const imagem = loja.capa_url || loja.logo_url;
  // sem capa/logo: a imagem padrão do AutoManager (app/opengraph-image.tsx) — o
  // openGraph deste layout substitui o da raiz, então ela precisa vir explícita
  const imagemOg = imagem || "/opengraph-image";
  return {
    title: { absolute: loja.nome },
    description: descricao,
    alternates: { canonical: `/loja/${slug}` },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      title: loja.nome,
      description: descricao,
      url: `/loja/${slug}`,
      images: [{ url: imagemOg }],
    },
    twitter: {
      card: "summary_large_image",
      title: loja.nome,
      description: descricao,
      images: [imagemOg],
    },
  };
}

export default async function LojaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if ((await buscarLoja(slug)).tipo === "nao_existe") notFound();
  return children;
}
