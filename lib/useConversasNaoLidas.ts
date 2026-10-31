"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "./store";
import { createClient } from "./supabase/client";

const vistoKey = (id: string) => "aminbox_visto_" + id;

// Conta conversas com mensagem nova do cliente (não lidas), para o badge global.
// Mesma regra do inbox: ultima_cliente_em > "visto" guardado no localStorage.
export function useConversasNaoLidas(): number {
  const role = useStore((s) => s.role);
  const ready = useStore((s) => s.ready);
  const [count, setCount] = useState(0);
  const sb = useRef(createClient());

  useEffect(() => {
    if (!ready || role !== "owner") return;
    const client = sb.current;
    let ch: ReturnType<typeof client.channel> | null = null;
    let lista: { id: string; ultima_cliente_em: string | null }[] = [];

    function recompute() {
      if (typeof localStorage === "undefined") return;
      const n = lista.filter(
        (c) => c.ultima_cliente_em && new Date(c.ultima_cliente_em).getTime() > Number(localStorage.getItem(vistoKey(c.id)) || 0)
      ).length;
      setCount(n);
    }

    let cancelado = false;

    client
      .from("conversa")
      .select("id, ultima_cliente_em")
      .then(({ data }) => {
        lista = (data as any[]) || [];
        recompute();
      });

    // autentica o realtime ANTES de assinar (RLS): evita perder eventos na janela
    // entre o subscribe e a aplicação do token.
    client.auth.getSession().then(({ data }) => {
      if (cancelado) return;
      if (data.session) client.realtime.setAuth(data.session.access_token);

      ch = client
        .channel(`inbox-badge-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagem" }, (p) => {
          const m = p.new as any;
          if (m.autor_tipo !== "cliente") return;
          const c = lista.find((x) => x.id === m.conversa_id);
          if (c) c.ultima_cliente_em = m.criada_em;
          else lista = [...lista, { id: m.conversa_id, ultima_cliente_em: m.criada_em }];
          recompute();
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversa" }, (p) => {
          const c = p.new as any;
          if (!lista.some((x) => x.id === c.id)) lista = [...lista, { id: c.id, ultima_cliente_em: c.ultima_cliente_em ?? null }];
          recompute();
        })
        .subscribe();
    });

    // sincroniza quando uma conversa é marcada como vista (mesma aba ou outra aba)
    const onSync = () => recompute();
    window.addEventListener("aminbox-visto", onSync);
    window.addEventListener("storage", onSync);
    window.addEventListener("focus", onSync);

    return () => {
      cancelado = true;
      if (ch) client.removeChannel(ch);
      window.removeEventListener("aminbox-visto", onSync);
      window.removeEventListener("storage", onSync);
      window.removeEventListener("focus", onSync);
    };
  }, [ready, role]);

  return count;
}
