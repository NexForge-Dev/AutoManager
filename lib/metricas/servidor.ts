// Métricas de produto para o Painel NexForge (uso interno da empresa). SÓ NO SERVIDOR.
//
// Sai daqui apenas: nome do evento, um id pseudônimo da LOJA (HMAC do org_id com
// NEXFORGE_PSEUDONYM_SECRET, que nunca sai deste servidor) e códigos fixos
// (plano, etapa, recurso). Nunca nomes, e-mails, telefones, produtos ou valores
// de vendas. Sem as três variáveis NEXFORGE_* tudo vira no-op.
import { createNexforge, type NexforgeClient, type NexforgeEvent } from "./nexforge-client.cjs";
import { PLANOS, type PlanoId } from "@/lib/plans";

let cliente: NexforgeClient | null = null;

function nf(): NexforgeClient {
  if (!cliente) {
    cliente = createNexforge({
      endpoint: process.env.NEXFORGE_ENDPOINT,
      ingestKey: process.env.NEXFORGE_INGEST_KEY,
      pseudonymSecret: process.env.NEXFORGE_PSEUDONYM_SECRET,
      enabled: process.env.NODE_ENV !== "test",
      timeoutMs: 2500,
      retries: 1,
      onError: (e) => console.warn("[nexforge]", e instanceof Error ? e.message : e),
    });
  }
  return cliente;
}

type Props = Record<string, string | number>;

/** `unico`: chave estável para eventos que só contam uma vez (o painel descarta repetidos). */
export function registrarEvento(evento: NexforgeEvent, orgId: string | null | undefined, props: Props = {}, unico?: string) {
  const c = nf();
  if (!c.enabled || !orgId) return;
  c.track(evento, {
    userId: orgId,
    properties: { platform: "web", ...props },
    eventId: unico ? c.onceId(unico, evento, orgId) : undefined,
  });
}

/**
 * Envia o que estiver na fila. Na Vercel a função congela após a resposta, por
 * isso as rotas esperam isto antes de responder — no máximo 1,5 s, mesmo com o
 * painel fora do ar.
 */
export async function enviarMetricas() {
  const c = nf();
  if (c.enabled) await c.flush(1500);
}

/** Propriedades de cobrança no formato do painel (preço em centavos de BRL). */
export function propsPlano(plano: PlanoId): Props {
  return { plan: plano, billing_period: "month", amount_cents: PLANOS[plano].precoCentavos, currency: "BRL" };
}
