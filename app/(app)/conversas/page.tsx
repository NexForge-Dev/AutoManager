"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { registrarMetrica } from "@/lib/metricas/cliente";
import Guard from "@/components/Guard";
import { Skeleton } from "@/components/Skeleton";
import { Aviso, Avatar, EstadoVazio, PageHeader, Selo } from "@/components/ui";
import { AlertTriangle, MessageCircle, Send, ChevronLeft, Loader2, Store } from "lucide-react";

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
// última atividade na lista: hora se foi hoje; senão, a data
function quando(iso: string) {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return hora(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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
  const [erroLista, setErroLista] = useState(false);
  const [erroMsgs, setErroMsgs] = useState(false);
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
    try {
      localStorage.setItem(vistoKey(id), String(agora));
    } catch {
      /* armazenamento bloqueado: o "visto" vale só nesta aba */
    }
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
    let ativo = true;

    client
      .from("conversa")
      .select("id, cliente_nome, ultima_em, ultima_cliente_em")
      .order("ultima_em", { ascending: false })
      .then(({ data, error }) => {
        if (!ativo) return;
        setErroLista(!!error);
        const lista = (data as Conversa[]) || [];
        setConversas(lista);
        setCarregando(false);
        const seed: Record<string, number> = {};
        try {
          for (const c of lista) seed[c.id] = Number(localStorage.getItem(vistoKey(c.id)) || 0);
        } catch {
          /* sem armazenamento: tudo conta como não visto */
        }
        setVistos(seed);
      });

    // token no realtime (RLS) ANTES de assinar: assinado sem ele, os eventos
    // filtrados pela RLS não chegam até a próxima renovação do token
    client.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      if (data.session) client.realtime.setAuth(data.session.access_token);
      assinar();
    });

    // nome único: channel() devolve um canal homônimo que ainda está saindo
    // (removeChannel é assíncrono) e a nova assinatura morreria junto
    const assinar = () => {
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
    };

    return () => {
      ativo = false;
      if (ch) client.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sel) return;
    // troca de conversa: limpa a anterior e ignora respostas atrasadas (A -> B rápido
    // mostrava as mensagens de A com o cabeçalho de B)
    let ativo = true;
    setMsgs([]);
    setErroMsgs(false);
    setMsgsCarregando(true);
    sb.current
      .from("mensagem")
      .select("id, autor_tipo, texto, criada_em")
      .eq("conversa_id", sel)
      .order("criada_em")
      .then(({ data, error }) => {
        if (!ativo) return;
        setErroMsgs(!!error);
        setMsgs((data as Msg[]) || []);
        setMsgsCarregando(false);
      });
    return () => {
      ativo = false;
    };
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
      // ultima_em é atualizada pelo trigger trg_bump_conversa a cada mensagem
      // (0019); o cliente não grava mais essa coluna (0041, achado #19).
    } finally {
      setEnviando(false);
    }
  }

  // reenvia uma mensagem que falhou (só tira a bolha de erro se o reenvio começar)
  function reenviar(m: Msg) {
    if (enviando) return;
    setMsgs((prev) => prev.filter((x) => x.id !== m.id));
    enviar(m.texto);
  }

  const selConversa = conversas.find((c) => c.id === sel);
  const totalNaoLidas = conversas.filter(naoLida).length;

  // sem nenhuma conversa: um único bloco explicando, sem painel de chat vazio
  const semConversas = !carregando && !erroLista && conversas.length === 0;

  return (
    <div className="space-y-4 md:space-y-5">
      {/* no celular, com conversa aberta, o cabeçalho do chat assume o topo */}
      <div className={sel ? "hidden lg:block" : ""}>
        <PageHeader
          titulo={
            <span className="flex items-center gap-2">
              Conversas
              {totalNaoLidas > 0 && (
                <Selo tom="bad" className="tnum">
                  {totalNaoLidas > 99 ? "99+" : totalNaoLidas}
                </Selo>
              )}
            </span>
          }
          descricao="Mensagens dos clientes que entram em contato pela sua vitrine."
        />
      </div>

      {semConversas ? (
        <div className="card p-0">
          <EstadoVazio
            icone={MessageCircle}
            titulo="Nenhuma conversa ainda."
            acao={
              <Link href="/minha-loja" className="btn-primary">
                <Store size={17} aria-hidden /> Ir para Minha Loja
              </Link>
            }
          >
            Coloque a loja no ar em Minha Loja e compartilhe o link.
          </EstadoVazio>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:h-[calc(100dvh-9.5rem)] lg:min-h-[28rem]">
          {/* lista: no celular some quando há conversa aberta */}
          <aside
            className={`${sel ? "hidden lg:flex" : "flex"} flex-col min-h-0 lg:border-r lg:border-default`}
            aria-label="Lista de conversas"
          >
            {carregando && (
              <div className="divide-y divide-[var(--border)]">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-2/5" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!carregando && (
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--border)] stagger">
                {erroLista && (
                  <div role="alert" className="p-3">
                    <Aviso tom="bad" icone={AlertTriangle}>
                      Não foi possível carregar as conversas. Confira a conexão e abra a página de novo.
                    </Aviso>
                  </div>
                )}
                {conversas.map((c) => {
                  const nova = naoLida(c);
                  const aberta = sel === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => abrir(c.id)}
                      aria-current={aberta ? "true" : undefined}
                      className={`row ${aberta ? "bg-brand-500/10" : ""}`}
                    >
                      <span className="relative shrink-0">
                        <Avatar nome={c.cliente_nome || "Cliente"} />
                        {nova && (
                          <span
                            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-[var(--surface)]"
                            aria-hidden
                          />
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block truncate ${nova ? "font-bold" : "font-medium"}`}>
                          {c.cliente_nome || "Cliente"}
                        </span>
                        <span className="block text-xs text-muted tnum">{quando(c.ultima_em)}</span>
                      </span>
                      {nova && <Selo tom="brand">nova</Selo>}
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {/* conversa aberta */}
          {sel ? (
            <section className="flex flex-col min-h-0 min-w-0 h-[calc(100dvh-11rem)] lg:h-auto" aria-label="Conversa">
              <header className="flex items-center gap-2.5 pl-2 lg:pl-4 pr-4 py-2 min-h-[56px] border-b border-default">
                <button onClick={() => setSel(null)} aria-label="Voltar" className="icon-btn lg:hidden">
                  <ChevronLeft size={20} aria-hidden />
                </button>
                <Avatar nome={selConversa?.cliente_nome || "Cliente"} />
                <h2 className="section-title truncate min-w-0">{selConversa?.cliente_nome || "Cliente"}</h2>
              </header>
              <div ref={scrollRef} onScroll={aoRolar} className="flex-1 min-h-0 overflow-auto p-4 space-y-2">
                {msgsCarregando && msgs.length === 0 && (
                  <div className="space-y-2">
                    <div className="skeleton h-9 w-1/2 rounded-2xl" />
                    <div className="skeleton h-9 w-2/3 rounded-2xl ml-auto" />
                    <div className="skeleton h-9 w-2/5 rounded-2xl" />
                  </div>
                )}
                {!msgsCarregando && erroMsgs && (
                  <p role="alert" className="text-center text-sm text-bad">Não foi possível carregar as mensagens.</p>
                )}
                {!msgsCarregando && !erroMsgs && msgs.length === 0 && (
                  <p className="text-center text-sm text-muted">Sem mensagens ainda.</p>
                )}
                {msgs.map((m) => {
                  const daLoja = m.autor_tipo === "loja";
                  return (
                    <div key={m.id} className={`reveal flex flex-col ${daLoja ? "items-end" : "items-start"}`}>
                      <div
                        className={`max-w-[80%] lg:max-w-[65%] rounded-2xl px-3 py-2 text-sm break-words ${
                          daLoja ? "bg-brand-600 text-white" : "surface-alt"
                        } ${m.pendente ? "opacity-70" : ""} ${m.falhou ? "ring-1 ring-bad" : ""}`}
                      >
                        {m.texto}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5 px-1 flex items-center gap-1 tnum">
                        {m.falhou ? (
                          <button onClick={() => reenviar(m)} className="text-bad font-semibold py-1 hover:underline">
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
                  className="input flex-1 min-w-0"
                  placeholder="Responder…"
                  aria-label="Responder"
                  maxLength={2000}
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
                  className="btn-primary !px-0 w-11 shrink-0"
                  aria-label="Enviar"
                >
                  {enviando ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Send size={18} aria-hidden />}
                </button>
              </div>
            </section>
          ) : (
            <div className="hidden lg:grid place-items-center min-h-0">
              <EstadoVazio icone={MessageCircle} titulo="Escolha uma conversa">
                As mensagens do cliente aparecem aqui.
              </EstadoVazio>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
