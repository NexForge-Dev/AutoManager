"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { registrarMetrica } from "@/lib/metricas/cliente";
import Guard from "@/components/Guard";
import { SkeletonList } from "@/components/Skeleton";
import { MessageCircle, Send, ChevronLeft, Loader2 } from "lucide-react";

export default function ConversasPage() {
  return (
    <Guard>
      <Conversas />
    </Guard>
  );
}

type Conversa = { id: string; cliente_nome: string | null; ultima_em: string; ultima_cliente_em: string | null };
type Msg = {
  id: string;
  autor_tipo: string;
  texto: string;
  criada_em?: string;
  pendente?: boolean; // otimista, ainda gravando
  falhou?: boolean; // falhou ao enviar
};

const vistoKey = (id: string) => "aminbox_visto_" + id;

function hora(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Conversas() {
  const orgId = useStore((s) => s.orgId);
  const meId = useStore((s) => s.usuarioId);
  const sb = useRef(createClient());
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [msgsCarregando, setMsgsCarregando] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [vistos, setVistos] = useState<Record<string, number>>({});
  const fimRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const deveColar = useRef(true); // só auto-scrolla se o usuário está perto do fim
  const primeira = useRef(true); // primeiro render da conversa = pula direto pro fim
  // conversa aberta lida pelo callback do realtime (o canal é assinado uma vez só)
  const selRef = useRef<string | null>(null);
  selRef.current = sel;

  function naoLida(c: Conversa) {
    if (!c.ultima_cliente_em) return false;
    return new Date(c.ultima_cliente_em).getTime() > (vistos[c.id] || 0);
  }
  function marcarVisto(id: string) {
    const agora = Date.now();
    if (typeof localStorage !== "undefined") localStorage.setItem(vistoKey(id), String(agora));
    setVistos((v) => ({ ...v, [id]: agora }));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("aminbox-visto")); // atualiza o badge do menu
  }
  function abrir(id: string) {
    marcarVisto(id);
    primeira.current = true;
    deveColar.current = true;
    setSel(id);
  }

  // detecta se o usuário está perto do fim (pra não puxar o scroll enquanto lê histórico)
  function aoRolar() {
    const el = scrollRef.current;
    if (!el) return;
    deveColar.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  // carrega conversas + realtime de novas mensagens da org
  useEffect(() => {
    const client = sb.current;
    let ch: ReturnType<typeof client.channel> | null = null;

    client
      .from("conversa")
      .select("id, cliente_nome, ultima_em, ultima_cliente_em")
      .order("ultima_em", { ascending: false })
      .then(({ data }) => {
        const lista = (data as Conversa[]) || [];
        setConversas(lista);
        setCarregando(false);
        if (typeof localStorage !== "undefined") {
          const seed: Record<string, number> = {};
          for (const c of lista) seed[c.id] = Number(localStorage.getItem(vistoKey(c.id)) || 0);
          setVistos(seed);
        }
      });

    // garante token no realtime (RLS) antes de assinar
    client.auth.getSession().then(({ data }) => {
      if (data.session) client.realtime.setAuth(data.session.access_token);
    });

    // nome único: channel() devolve um canal homônimo que ainda está saindo
    // (removeChannel é assíncrono) e a nova assinatura morreria junto
    ch = client
      .channel(`inbox-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversa" }, (p) => {
        const c = p.new as Conversa;
        setConversas((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagem" }, (p) => {
        const m = p.new as any;
        const doCliente = m.autor_tipo === "cliente";
        // reordena pro topo e atualiza a hora da última msg do cliente
        setConversas((prev) => {
          const found = prev.find((c) => c.id === m.conversa_id);
          if (!found) return prev;
          const atualizada: Conversa = {
            ...found,
            ultima_em: m.criada_em,
            ultima_cliente_em: doCliente ? m.criada_em : found.ultima_cliente_em,
          };
          return [atualizada, ...prev.filter((c) => c.id !== m.conversa_id)];
        });
        const aberta = selRef.current;
        if (aberta && m.conversa_id === aberta) {
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m as Msg]));
          if (doCliente) marcarVisto(aberta); // já está vendo -> não conta como não lida
        }
      })
      .subscribe();

    return () => {
      client.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sel) return;
    setMsgsCarregando(true);
    sb.current
      .from("mensagem")
      .select("id, autor_tipo, texto, criada_em")
      .eq("conversa_id", sel)
      .order("criada_em")
      .then(({ data }) => {
        setMsgs((data as Msg[]) || []);
        setMsgsCarregando(false);
      });
  }, [sel]);

  // scroll inteligente: pula direto no 1º render; depois só rola se está perto do fim
  useEffect(() => {
    if (primeira.current) {
      fimRef.current?.scrollIntoView({ behavior: "auto" });
      primeira.current = false;
      return;
    }
    if (deveColar.current) fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function enviar(textoParam?: string) {
    const t = (textoParam ?? texto).trim();
    if (!t || !sel || !meId || !orgId || enviando) return; // trava duplo envio
    setEnviando(true);
    const tmpId = "tmp-" + Date.now();
    // 1) mostra a bolha na hora (otimista) com estado "enviando"
    setMsgs((prev) => [
      ...prev,
      { id: tmpId, autor_tipo: "loja", texto: t, criada_em: new Date().toISOString(), pendente: true },
    ]);
    if (textoParam === undefined) setTexto("");
    deveColar.current = true; // ao enviar, sempre rola pro fim
    try {
      const { data, error } = await sb.current
        .from("mensagem")
        .insert({ conversa_id: sel, org_id: orgId, autor_id: meId, autor_tipo: "loja", texto: t })
        .select("id, autor_tipo, texto, criada_em")
        .single();
      if (error || !data) {
        // 2a) falhou: mantém a bolha marcada como erro (texto não se perde)
        setMsgs((prev) => prev.map((m) => (m.id === tmpId ? { ...m, pendente: false, falhou: true } : m)));
        return;
      }
      // 2b) ok: troca a bolha temporária pela real (evita duplicar com o realtime)
      setMsgs((prev) => {
        const semTmp = prev.filter((m) => m.id !== tmpId);
        return semTmp.some((x) => x.id === data.id) ? semTmp : [...semTmp, data as Msg];
      });
      registrarMetrica({ tipo: "recurso", recurso: "chat_vitrine_respondido" });
      await sb.current.from("conversa").update({ ultima_em: new Date().toISOString() }).eq("id", sel);
    } finally {
      setEnviando(false);
    }
  }

  // reenvia uma mensagem que falhou
  function reenviar(m: Msg) {
    setMsgs((prev) => prev.filter((x) => x.id !== m.id));
    enviar(m.texto);
  }

  const selConversa = conversas.find((c) => c.id === sel);
  const totalNaoLidas = conversas.filter(naoLida).length;

  return (
    <div className="space-y-3">
      <header className="flex items-center gap-2 pt-1">
        {sel && (
          <button
            onClick={() => setSel(null)}
            aria-label="Voltar"
            className="grid place-items-center h-9 w-9 -ml-1 rounded-full text-muted hover:bg-[var(--hover)] hover:text-strong active:scale-90 transition"
          >
            <ChevronLeft />
          </button>
        )}
        <MessageCircle className="text-brand-600" />
        <h1 className="text-2xl font-bold">{sel ? selConversa?.cliente_nome || "Cliente" : "Conversas"}</h1>
        {!sel && totalNaoLidas > 0 && (
          <span className="ml-1 text-xs font-bold text-white bg-red-500 rounded-full min-w-[20px] h-5 px-1.5 grid place-items-center">
            {totalNaoLidas > 99 ? "99+" : totalNaoLidas}
          </span>
        )}
      </header>

      {/* lista */}
      {!sel && carregando && <SkeletonList count={4} />}
      {!sel && !carregando && (
        <div className="space-y-2 stagger">
          {conversas.length === 0 && (
            <div className="card text-center text-muted">
              Nenhuma conversa ainda. Ative a mini-loja em Configurações e compartilhe o link.
            </div>
          )}
          {conversas.map((c) => {
            const nova = naoLida(c);
            return (
              <button
                key={c.id}
                onClick={() => abrir(c.id)}
                className={`card w-full text-left flex items-center gap-3 ${nova ? "border-brand-500/40" : ""}`}
              >
                <div className="relative h-10 w-10 rounded-full bg-brand-600/15 grid place-items-center text-brand-500 font-bold">
                  {(c.cliente_nome || "C").slice(0, 1).toUpperCase()}
                  {nova && (
                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-[var(--surface)]" />
                  )}
                </div>
                <div className={`flex-1 ${nova ? "font-bold" : "font-medium"}`}>{c.cliente_nome || "Cliente"}</div>
                {nova && (
                  <span className="text-[11px] font-semibold text-white bg-brand-600 rounded-full px-2 py-0.5">nova</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* chat */}
      {sel && (
        <div className="card flex flex-col h-[70vh] p-0 overflow-hidden">
          <div ref={scrollRef} onScroll={aoRolar} className="flex-1 overflow-auto p-4 space-y-2">
            {msgsCarregando && msgs.length === 0 && (
              <div className="space-y-2">
                <div className="skeleton h-9 w-1/2 rounded-2xl" />
                <div className="skeleton h-9 w-2/3 rounded-2xl ml-auto" />
                <div className="skeleton h-9 w-2/5 rounded-2xl" />
              </div>
            )}
            {!msgsCarregando && msgs.length === 0 && (
              <p className="text-center text-sm text-muted">Sem mensagens ainda.</p>
            )}
            {msgs.map((m) => {
              const daLoja = m.autor_tipo === "loja";
              return (
                <div key={m.id} className={`reveal flex flex-col ${daLoja ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      daLoja ? "bg-brand-600 text-white" : "surface-alt"
                    } ${m.pendente ? "opacity-70" : ""} ${m.falhou ? "ring-1 ring-red-500" : ""}`}
                  >
                    {m.texto}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5 px-1 flex items-center gap-1">
                    {m.falhou ? (
                      <button onClick={() => reenviar(m)} className="text-red-500 font-semibold hover:underline">
                        falhou · tocar para reenviar
                      </button>
                    ) : m.pendente ? (
                      "enviando…"
                    ) : (
                      hora(m.criada_em)
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={fimRef} />
          </div>
          <div className="p-3 border-t border-default flex gap-2">
            <input
              className="input flex-1"
              placeholder="Responder…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  enviar();
                }
              }}
            />
            <button
              onClick={() => enviar()}
              disabled={enviando || !texto.trim()}
              className="btn-primary px-4 disabled:opacity-50"
              aria-label="Enviar"
            >
              {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
