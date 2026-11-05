import { createBrowserClient } from "@supabase/ssr";
import { fetchComLimite } from "@/lib/fetchComLimite";

// Client de navegador - usa a chave pública (anon/publishable). Seguro no browser.
// Singleton: reaproveita a MESMA instância em todo o app, evitando múltiplos
// GoTrueClient/websockets de realtime (mais leve e sem corridas de sessão).
export const EVENTO_SEM_SESSAO = "am-sem-sessao";
const avisarSemSessao = () => window.dispatchEvent(new Event(EVENTO_SEM_SESSAO));

function novoClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: fetchComLimite(undefined, undefined, avisarSemSessao) } }
  );
}

// tipo derivado de uma função concreta (preserva a inferência do SupabaseClient)
let cliente: ReturnType<typeof novoClient> | undefined;

export function createClient() {
  if (!cliente) cliente = novoClient();
  return cliente;
}
