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

/** Registra uma vez quando a tela abre (ex.: "consultou reposição"). */
export function useMetricaAoAbrir(m: Metrica) {
  useEffect(() => {
    registrarMetrica(m);
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
