"use client";
import { useEffect, useRef } from "react";
import { useStore } from "./store";
import { createClient } from "./supabase/client";
import type { EntradaPendente, OrigemRecebimento } from "./types";
import { brl } from "./analytics";

function mapRow(r: any): EntradaPendente {
  return {
    id: r.id,
    valor: Number(r.valor ?? 0),
    origem: (r.origem ?? "manual") as OrigemRecebimento,
    descricao: r.descricao ?? null,
    pagador: r.pagador ?? null,
    formaPagamento: r.forma_pagamento ?? "pix",
    status: r.status ?? "pendente",
    vendaId: r.venda_id ?? null,
    recebidoEm: r.recebido_em ? new Date(r.recebido_em).getTime() : Date.now(),
    decididoEm: r.decidido_em ? new Date(r.decidido_em).getTime() : null,
  };
}

// Mantém a caixa de entrada de recebimentos viva em tempo real: quando o webhook
// de um provedor grava uma nova entrada, ela aparece na hora no store e dispara
// uma notificação do navegador (se o dono autorizou). Montado uma vez no AppShell.
// Retorna a contagem de pendentes para o badge da navegação.
export function useRecebimentosPendentes(): number {
  const role = useStore((s) => s.role);
  const ready = useStore((s) => s.ready);
  const orgId = useStore((s) => s.orgId);
  const count = useStore((s) => s.entradasPendentes.length);
  const sb = useRef(createClient());

  useEffect(() => {
    if (!ready || role !== "owner" || !orgId) return;
    const client = sb.current;
    let ch: ReturnType<typeof client.channel> | null = null;
    let cancelado = false;

    // autentica o realtime ANTES de assinar (a tabela tem RLS): evita perder
    // eventos que cheguem na janela entre o subscribe e a aplicação do token.
    (async () => {
      const { data } = await client.auth.getSession();
      if (cancelado) return;
      if (data.session) client.realtime.setAuth(data.session.access_token);

      ch = client
        .channel(`recebimentos-badge-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "entrada_pendente", filter: `org_id=eq.${orgId}` },
          (p) => {
            const row = p.new as any;
            if (row.status && row.status !== "pendente") return;
            const entrada = mapRow(row);
            useStore.setState((s) =>
              s.entradasPendentes.some((e) => e.id === entrada.id)
                ? s
                : { entradasPendentes: [entrada, ...s.entradasPendentes] }
            );
            notificar(entrada);
          }
        )
        // decidida (confirmada/recusada) em outro dispositivo: tira da caixa local
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "entrada_pendente", filter: `org_id=eq.${orgId}` },
          (p) => {
            const row = p.new as any;
            if (row.status && row.status !== "pendente")
              useStore.setState((s) => ({
                entradasPendentes: s.entradasPendentes.filter((e) => e.id !== row.id),
              }));
          }
        )
        .subscribe();
    })();

    return () => {
      cancelado = true;
      if (ch) client.removeChannel(ch);
    };
  }, [ready, role, orgId]);

  return count;
}

// Notificação do navegador (funciona com o app aberto). Pede permissão na 1ª vez.
function notificar(e: EntradaPendente) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("Recebeu " + brl(e.valor), {
      body: (e.descricao || "Foi venda da sua loja? Confirme no app.") + " · Toque para abrir.",
      tag: "recebimento-" + e.id,
    });
  } catch {
    // alguns navegadores exigem service worker para Notification; ignora silenciosamente
  }
}

// Pede a permissão de notificação ao dono (chamar num clique, ex.: na caixa de entrada).
export async function pedirPermissaoNotificacao(): Promise<NotificationPermission | "indisponivel"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "indisponivel";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}
