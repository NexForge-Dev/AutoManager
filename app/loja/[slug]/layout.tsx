import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

// A página da loja é client-side; este layout só existe para que o link
// compartilhado (WhatsApp, Instagram…) mostre o nome, descrição e imagem da LOJA
// em vez da prévia genérica do AutoManager.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await sb.rpc("loja_publica", { p_slug: slug });
    const loja = data as { nome: string; descricao: string | null; logo_url: string | null; capa_url: string | null } | null;
    if (!loja) return { title: "Loja não encontrada", robots: { index: false } };

    const descricao = loja.descricao || `Confira os produtos de ${loja.nome}.`;
    const imagem = loja.capa_url || loja.logo_url;
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
        ...(imagem ? { images: [{ url: imagem }] } : {}),
      },
      twitter: {
        card: imagem ? "summary_large_image" : "summary",
        title: loja.nome,
        description: descricao,
        ...(imagem ? { images: [imagem] } : {}),
      },
    };
  } catch {
    return {};
  }
}

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
