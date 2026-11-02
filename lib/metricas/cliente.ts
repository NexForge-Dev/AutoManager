import { useEffect } from "react";

// Sinais do navegador para o Painel NexForge. A rota /api/metricas valida tudo
// (sessão, loja, lista de recursos/etapas); aqui é só "dispara e esquece":
// uma falha nunca atrapalha o uso do app.

export type Recurso =
  | "produto_cadastrado"
  | "venda_registrada"
  | "revendedora_adicionada"
  | "venda_revendedora"
  | "loja_online_publicada"
  | "chat_vitrine_respondido"
  | "recebimento_confirmado"
  | "conta_a_pagar"
  | "reposicao_consultada"
  | "entrega_criada"
  | "analytics_visto"
  | "relatorio_exportado";

export type Etapa = "loja" | "segmento" | "plano" | "revendedoras" | "margem" | "contato";

export type Metrica =
  | { tipo: "recurso"; recurso: Recurso; quantidade?: number }
  | { tipo: "etapa"; etapa: Etapa }
  | { tipo: "onboarding" }
  | { tipo: "sessao" }
  | { tipo: "cadastro"; userId: string }
  | { tipo: "planos_vistos" };

export function registrarMetrica(m: Metrica) {
  try {
    void fetch("/api/metricas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(m),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* sem fetch (SSR): ignora */
  }
}

type Armazem = Pick<Storage, "getItem" | "setItem">;
const CHAVE_SESSAO = "am_metrica_sessao";

/**
 * session_started: no máximo uma vez por sessão do navegador e por usuário (EVENTS.md:
 * "login or return visit (max once per session)"). Vale para login com senha, para o
 * login automático depois de redefinir a senha e para quem volta já logado (Guard).
 * Devolve true quando deve enviar (e já marca como enviado).
 */
export function marcarSessao(armazem: Armazem | null | undefined, userId: string): boolean {
  if (!userId) return false;
  try {
    if (!armazem) return true;
    if (armazem.getItem(CHAVE_SESSAO) === userId) return false;
    armazem.setItem(CHAVE_SESSAO, userId);
    return true;
  } catch {
    return true; // sem armazenamento: melhor contar do que perder a sessão
  }
}

export function registrarSessao(userId: string | null | undefined) {
  if (!userId) return;
  let armazem: Armazem | null = null;
  try {
    armazem = typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    armazem = null;
  }
  if (marcarSessao(armazem, userId)) registrarMetrica({ tipo: "sessao" });
}

/** Registra uma vez quando a tela abre (ex.: "consultou reposição"). */
export function useMetricaAoAbrir(m: Metrica) {
  useEffect(() => {
    registrarMetrica(m);
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
