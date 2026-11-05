import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import { decidirDestino, type SituacaoRevendedora } from "@/lib/destino";
import { FalhaLeitura, recursoAusente } from "@/lib/cargaLoja";

export { MOTIVOS_ACESSO, motivoDaUrl, decidirDestino, type MotivoAcesso, type SituacaoRevendedora } from "@/lib/destino";

/**
 * Situação do login atual como revendedora (com fallback p/ banco sem a 0042).
 * Lança FalhaLeitura se não deu para perguntar: "não sei" não é "não é revendedora".
 */
export async function situacaoRevendedora(): Promise<SituacaoRevendedora> {
  const sb = createClient();
  const { data, error } = await sb.rpc("revendedora_situacao");
  if (!error) return (data as SituacaoRevendedora) ?? null;
  if (!recursoAusente(error)) throw new FalhaLeitura();
  const { data: rev, error: erroMe } = await sb.rpc("revendedora_me");
  if (erroMe) throw new FalhaLeitura();
  return rev ? "ativa" : null;
}

// Para onde mandar o usuário logo depois de autenticar (login, redefinir senha,
// ou quem abre /login já logado). Lança FalhaLeitura se a loja não carregou: quem chama
// oferece "tentar de novo" e nunca decide nada com dado que não chegou.
export async function destinoPosLogin(): Promise<string> {
  const situacao = await situacaoRevendedora();
  // revendedora (login self-service) vai direto pro painel dela
  if (situacao === "ativa") return "/revenda";

  await useStore.getState().hydrate();
  const { config, role, semOrg, superadmin, falhaEssencial } = useStore.getState();
  if (falhaEssencial) throw new FalhaLeitura();
  return decidirDestino({
    situacaoRevendedora: situacao,
    semOrg,
    role,
    onboardingCompleto: config.onboardingCompleto,
    superadmin,
  });
}
