import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import { decidirDestino, type SituacaoRevendedora } from "@/lib/destino";

export { MOTIVOS_ACESSO, motivoDaUrl, decidirDestino, type MotivoAcesso, type SituacaoRevendedora } from "@/lib/destino";

/** Situação do login atual como revendedora (com fallback p/ banco sem a 0042). */
export async function situacaoRevendedora(): Promise<SituacaoRevendedora> {
  const sb = createClient();
  const { data, error } = await sb.rpc("revendedora_situacao");
  if (!error) return (data as SituacaoRevendedora) ?? null;
  const { data: rev } = await sb.rpc("revendedora_me");
  return rev ? "ativa" : null;
}

// Para onde mandar o usuário logo depois de autenticar (login, redefinir senha,
// ou quem abre /login já logado).
export async function destinoPosLogin(): Promise<string> {
  const situacao = await situacaoRevendedora();
  // revendedora (login self-service) vai direto pro painel dela
  if (situacao === "ativa") return "/revenda";

  await useStore.getState().hydrate();
  const { config, role, semOrg } = useStore.getState();
  return decidirDestino({
    situacaoRevendedora: situacao,
    semOrg,
    role,
    onboardingCompleto: config.onboardingCompleto,
  });
}
