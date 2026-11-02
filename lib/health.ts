import { createClient } from "@supabase/supabase-js";

// Checagem de saúde para monitor externo (UptimeRobot, Vercel, etc.).
// Só devolve booleanos: nada de versão, URL, mensagem de erro ou segredo.

export type Saude = { ok: boolean; database: boolean };

/** Faz a consulta mais barata possível como `anon` (a mesma que a vitrine pública usa). */
export async function bancoResponde(timeoutMs = 3000): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  try {
    const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    // slug que nunca existe (slugify não gera "_"): devolve null sem ler dados de loja
    const { error } = await sb
      .rpc("loja_publica", { p_slug: "__health__" })
      .abortSignal(AbortSignal.timeout(timeoutMs));
    return !error;
  } catch {
    return false;
  }
}

export async function verificarSaude(checarBanco: () => Promise<boolean> = bancoResponde): Promise<Saude> {
  const database = await checarBanco().catch(() => false);
  return { ok: database, database };
}
