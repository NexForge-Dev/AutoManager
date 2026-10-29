"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { aplicarCorMarca } from "@/lib/brand";
import { aplicarFavicon } from "@/lib/aparencia";
import { carregarFonte } from "@/lib/fontes";
import { waLink, igLink, fbLink, ttLink } from "@/lib/contato";
import { brl } from "@/lib/analytics";
import { MessageCircle, X, Send, Gem, Loader2, Phone, Mail, Instagram, Facebook, Music2 } from "lucide-react";

type Variacao = { id: string; nome: string; preco_ajuste: number; esgotado: boolean };
type ProdutoPub = {
  id: string;
  nome: string;
  categoria: string | null;
  marca: string | null;
  preco_venda: number;
  preco_comparativo: number | null;
  descricao: string | null;
  imagens: string[];
  esgotado: boolean;
  variacoes: Variacao[];
};
type Loja = {
  org_id: string;
  nome: string;
  descricao: string | null;
  logo_url: string | null;
  capa_url: string | null;
  cor_marca: string | null;
  fonte: string | null;
  sobre: string | null;
  email: string | null;
  whatsapp: string | null;
  telefone: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  produtos: ProdutoPub[];
};

export default function LojaPage({ params }: { params: { slug: string } }) {
  const sb = useRef(createClient());
  const [loja, setLoja] = useState<Loja | null | undefined>(undefined);
  const [chat, setChat] = useState(false);
  const [fontStack, setFontStack] = useState("");
  const [filtroCat, setFiltroCat] = useState<string | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);
  const [aba, setAba] = useState<"inicio" | "sobre" | "contato">("inicio");

  useEffect(() => {
    sb.current.rpc("loja_publica", { p_slug: params.slug }).then(({ data }) => {
      const d = (data as Loja) ?? null;
      setLoja(d);
      if (d?.cor_marca) aplicarCorMarca(d.cor_marca);
      if (d?.fonte) setFontStack(carregarFonte(d.fonte));
      if (d) aplicarFavicon(d.logo_url, d.nome); // ícone/título da aba = logo e nome da loja
    });
  }, [params.slug]);

  // badge de não lidas: se o cliente já conversou aqui, conta mensagens da LOJA
  // chegadas depois da última vez que ele abriu o chat (mesmo com o chat fechado).
  useEffect(() => {
    if (!loja) return;
    const orgId = loja.org_id;
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("amchat_" + orgId) : null;
    if (!token) return;
    const client = sb.current;
    let canceled = false;
    let canal: ReturnType<typeof client.channel> | null = null;

    (async () => {
      let {
        data: { user },
      } = await client.auth.getUser();
      if (!user) {
        const r = await client.auth.signInAnonymously();
        user = r.data.user;
      }
      if (!user || canceled) return;
      const {
        data: { session },
      } = await client.auth.getSession();
      if (session) client.realtime.setAuth(session.access_token);

      const { data } = await client.rpc("recuperar_conversa", { p_org: orgId, p_token: token });
      if (canceled || !data) return;
      const visto = Number(localStorage.getItem("amchat_visto_" + orgId) || 0);
      const novas = ((data.mensagens as any[]) || []).filter(
        (m) => m.autor_tipo === "loja" && new Date(m.criada_em).getTime() > visto
      ).length;
      setNaoLidas(novas);

      canal = client
        .channel("badge-" + data.id)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "mensagem", filter: `conversa_id=eq.${data.id}` },
          (p) => {
            if ((p.new as any).autor_tipo === "loja") setNaoLidas((n) => n + 1);
          }
        )
        .subscribe();
    })();

    return () => {
      canceled = true;
      if (canal) client.removeChannel(canal);
    };
  }, [loja]);

  function abrirChat() {
    if (loja) localStorage.setItem("amchat_visto_" + loja.org_id, String(Date.now()));
    setNaoLidas(0);
    setChat(true);
  }
  function fecharChat() {
    if (loja) localStorage.setItem("amchat_visto_" + loja.org_id, String(Date.now()));
    setNaoLidas(0);
    setChat(false);
  }

  if (loja === undefined)
    return (
      <div className="min-h-screen grid place-items-center text-brand-500">
        <Loader2 className="animate-spin" />
      </div>
    );

  if (loja === null)
    return (
      <div className="min-h-screen grid place-items-center text-center px-6">
        <div>
          <h1 className="text-2xl font-bold">Loja não encontrada</h1>
          <p className="text-muted mt-1">Este link pode estar incorreto ou a loja está fora do ar.</p>
          <Link href="/" className="btn-primary mt-6 inline-flex">Conhecer o AutoManager</Link>
        </div>
      </div>
    );

  const temSobre = !!loja.sobre;
  const temContato = !!(loja.whatsapp || loja.telefone || loja.email || loja.instagram || loja.facebook || loja.tiktok);
  const abas: { key: "inicio" | "sobre" | "contato"; label: string }[] = [
    { key: "inicio", label: "Início" },
    ...(temSobre ? [{ key: "sobre" as const, label: "Sobre" }] : []),
    ...(temContato ? [{ key: "contato" as const, label: "Contato" }] : []),
  ];
  const abaAtual = abas.some((a) => a.key === aba) ? aba : "inicio";

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24" style={fontStack ? { fontFamily: fontStack } : undefined}>
      {/* cabeçalho da loja */}
      <header className="surface border-b border-default">
        {loja.capa_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={loja.capa_url} alt="" className="h-36 md:h-52 w-full object-cover" />
        )}
        <div className="max-w-3xl mx-auto px-5">
          <div className={`flex items-center gap-4 ${loja.capa_url ? "-mt-10" : "py-6"}`}>
            {loja.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={loja.logo_url} alt={loja.nome} className="h-20 w-20 rounded-2xl object-cover border-4 border-[var(--surface)]" />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-brand-600 grid place-items-center text-white border-4 border-[var(--surface)]">
                <Gem size={30} />
              </div>
            )}
            <div className={`min-w-0 ${loja.capa_url ? "pt-10" : ""}`}>
              <h1 className="text-2xl font-bold truncate">{loja.nome}</h1>
            </div>
          </div>

          {/* navegação */}
          {abas.length > 1 && (
            <nav className="flex gap-2 pb-3 pt-1">
              {abas.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAba(a.key)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                    abaAtual === a.key ? "bg-brand-600 text-white" : "surface-alt text-muted hover:text-strong"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* INÍCIO: descrição + catálogo */}
      {abaAtual === "inicio" && (
        <main className="max-w-3xl mx-auto px-5 py-5">
          {loja.descricao && <p className="text-muted mb-4">{loja.descricao}</p>}
          {loja.produtos.length === 0 ? (
            <div className="card text-center text-muted">Catálogo em breve.</div>
          ) : (
            (() => {
              const categorias = Array.from(
                new Set(loja.produtos.map((p) => p.categoria).filter((c): c is string => !!c))
              );
              const contagem = new Map<string, number>();
              for (const p of loja.produtos)
                if (p.categoria) contagem.set(p.categoria, (contagem.get(p.categoria) || 0) + 1);
              const lista = filtroCat ? loja.produtos.filter((p) => p.categoria === filtroCat) : loja.produtos;
              return (
                <>
                  {categorias.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
                      <button
                        onClick={() => setFiltroCat(null)}
                        className={`chip whitespace-nowrap ${
                          filtroCat === null ? "bg-brand-600 text-white border-brand-600" : "border-default"
                        }`}
                      >
                        Tudo <span className="opacity-70">({loja.produtos.length})</span>
                      </button>
                      {categorias.map((c) => (
                        <button
                          key={c}
                          onClick={() => setFiltroCat(c)}
                          className={`chip whitespace-nowrap ${
                            filtroCat === c ? "bg-brand-600 text-white border-brand-600" : "border-default"
                          }`}
                        >
                          {c} <span className="opacity-70">({contagem.get(c) || 0})</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {lista.map((p) => (
                      <ProdutoCard key={p.id} p={p} />
                    ))}
                  </div>
                </>
              );
            })()
          )}
        </main>
      )}

      {/* SOBRE */}
      {abaAtual === "sobre" && temSobre && (
        <main className="max-w-3xl mx-auto px-5 py-5">
          <div className="card">
            <div className="font-semibold mb-2 text-lg">Sobre {loja.nome}</div>
            <p className="text-muted whitespace-pre-line">{loja.sobre}</p>
          </div>
        </main>
      )}

      {/* CONTATO */}
      {abaAtual === "contato" && temContato && (
        <main className="max-w-3xl mx-auto px-5 py-5">
          <LojaContato loja={loja} />
        </main>
      )}

      {/* botão de chat */}
      <button
        onClick={abrirChat}
        className="fixed bottom-5 right-5 z-40 bg-brand-600 text-white rounded-full shadow-lg shadow-brand-600/30 flex items-center gap-2 px-5 py-3.5 font-semibold"
      >
        <MessageCircle size={20} /> Falar com a loja
        {naoLidas > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-xs font-bold grid place-items-center border-2 border-[var(--bg)]">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {chat && <ChatWidget orgId={loja.org_id} sb={sb.current} nomeLoja={loja.nome} onClose={fecharChat} />}
    </div>
  );
}

function ProdutoCard({ p }: { p: ProdutoPub }) {
  const temDesconto = p.preco_comparativo != null && p.preco_comparativo > p.preco_venda;
  const esgotado = p.esgotado;
  return (
    <div className={`surface rounded-2xl border border-default overflow-hidden flex flex-col ${esgotado ? "opacity-70" : ""}`}>
      <div className="aspect-square surface-alt relative">
        {p.imagens[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imagens[0]} alt={p.nome} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center text-muted">
            <Gem size={28} />
          </div>
        )}
        {esgotado && (
          <span className="absolute top-2 left-2 rounded-full bg-red-500 text-white px-2 py-0.5 text-[11px] font-semibold">
            Esgotado
          </span>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="text-sm font-semibold leading-tight">{p.nome}</div>
        {p.marca && <div className="text-[11px] text-muted">{p.marca}</div>}
        <div className="mt-auto pt-2">
          {temDesconto && (
            <div className="text-[11px] text-muted line-through">{brl(p.preco_comparativo!)}</div>
          )}
          <div className="font-bold text-brand-500">{brl(p.preco_venda)}</div>
          {p.variacoes.length > 0 && (
            <div className="text-[11px] text-muted">{p.variacoes.length} opções</div>
          )}
        </div>
      </div>
    </div>
  );
}

function LojaContato({ loja }: { loja: Loja }) {
  const links = [
    loja.whatsapp && { href: waLink(loja.whatsapp), icon: <MessageCircle size={18} />, label: "WhatsApp" },
    loja.telefone && { href: `tel:${loja.telefone.replace(/[^\d+]/g, "")}`, icon: <Phone size={18} />, label: "Telefone" },
    loja.email && { href: `mailto:${loja.email}`, icon: <Mail size={18} />, label: "E-mail" },
    loja.instagram && { href: igLink(loja.instagram), icon: <Instagram size={18} />, label: "Instagram" },
    loja.facebook && { href: fbLink(loja.facebook), icon: <Facebook size={18} />, label: "Facebook" },
    loja.tiktok && { href: ttLink(loja.tiktok), icon: <Music2 size={18} />, label: "TikTok" },
  ].filter(Boolean) as { href: string; icon: React.ReactNode; label: string }[];

  if (links.length === 0) return null;

  return (
    <div className="card">
      <div className="font-semibold mb-3 text-lg">Fale com a gente</div>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full surface-alt hover:bg-brand-600 hover:text-white px-4 py-2 text-sm font-medium transition"
          >
            {l.icon} {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}

type Msg = { id: string; autor_tipo: string; texto: string };

function ChatWidget({
  orgId,
  sb,
  nomeLoja,
  onClose,
}: {
  orgId: string;
  sb: ReturnType<typeof createClient>;
  nomeLoja: string;
  onClose: () => void;
}) {
  const [nome, setNome] = useState("");
  const [iniciado, setIniciado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [restaurando, setRestaurando] = useState(true);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const meId = useRef<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<ReturnType<typeof sb.channel> | null>(null);

  const tokenKey = "amchat_" + orgId; // token estável deste cliente nesta loja

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // garante uma sessão (reaproveita a anônima salva nos cookies ou cria uma)
  async function garantirSessao(): Promise<string | null> {
    let {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      user = data.user;
    }
    meId.current = user?.id ?? null;
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (session) sb.realtime.setAuth(session.access_token); // realtime respeita a RLS
    return user?.id ?? null;
  }

  function assinarRealtime(convId: string) {
    chRef.current = sb
      .channel("conv-" + convId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagem", filter: `conversa_id=eq.${convId}` },
        (payload) => {
          const nova = payload.new as Msg;
          setMsgs((prev) => (prev.some((x) => x.id === nova.id) ? prev : [...prev, nova]));
        }
      )
      .subscribe();
  }

  // ao abrir, restaura automaticamente a conversa salva deste cliente (outra aba / retorno)
  useEffect(() => {
    (async () => {
      try {
        const token = typeof localStorage !== "undefined" ? localStorage.getItem(tokenKey) : null;
        if (!token) return; // nunca conversou neste navegador
        await garantirSessao();
        const { data } = await sb.rpc("recuperar_conversa", { p_org: orgId, p_token: token });
        if (data) {
          setConversaId(data.id);
          if (data.cliente_nome) setNome(data.cliente_nome);
          setMsgs((data.mensagens as Msg[]) || []);
          assinarRealtime(data.id);
          setIniciado(true);
        }
      } catch {
        /* segue para a tela inicial */
      } finally {
        setRestaurando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function iniciar() {
    setCarregando(true);
    try {
      const uid = await garantirSessao();
      if (!uid) throw new Error("sessão");
      let token = localStorage.getItem(tokenKey);
      if (!token) {
        token = crypto.randomUUID();
        localStorage.setItem(tokenKey, token);
      }

      // reaproveita a conversa do token, se já existir
      const { data: rec } = await sb.rpc("recuperar_conversa", { p_org: orgId, p_token: token });
      let convId: string;
      if (rec) {
        convId = rec.id;
        setMsgs((rec.mensagens as Msg[]) || []);
        if (nome && nome !== rec.cliente_nome) await sb.from("conversa").update({ cliente_nome: nome }).eq("id", convId);
      } else {
        convId = crypto.randomUUID();
        const { error } = await sb
          .from("conversa")
          .insert({ id: convId, org_id: orgId, cliente_id: uid, cliente_token: token, cliente_nome: nome || null });
        if (error) throw error;
        setMsgs([]);
      }
      setConversaId(convId);
      assinarRealtime(convId);
      setIniciado(true);
    } catch (e: any) {
      alert("Não foi possível iniciar o chat: " + (e?.message || e));
    } finally {
      setCarregando(false);
    }
  }

  async function enviar() {
    const t = texto.trim();
    if (!t || !conversaId || !meId.current) return;
    setTexto("");
    const { data, error } = await sb
      .from("mensagem")
      .insert({ conversa_id: conversaId, org_id: orgId, autor_id: meId.current, autor_tipo: "cliente", texto: t })
      .select("id, autor_tipo, texto")
      .single();
    if (error) {
      alert("Erro ao enviar: " + error.message);
      setTexto(t);
      return;
    }
    if (data) setMsgs((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Msg]));
  }

  useEffect(() => {
    return () => {
      if (chRef.current) sb.removeChannel(chRef.current); // remove só o canal do widget
    };
  }, [sb]);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
      <div className="surface w-full max-w-md md:rounded-3xl rounded-t-3xl flex flex-col h-[80vh] md:h-[600px]">
        <header className="flex items-center justify-between p-4 border-b border-default">
          <div className="font-semibold">{nomeLoja}</div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>

        {restaurando ? (
          <div className="flex-1 grid place-items-center text-brand-500">
            <Loader2 className="animate-spin" />
          </div>
        ) : !iniciado ? (
          <div className="flex-1 grid place-items-center p-6 text-center">
            <div className="space-y-3 w-full">
              <MessageCircle className="mx-auto text-brand-500" size={36} />
              <p className="text-sm text-muted">Mande uma mensagem direto para a loja.</p>
              <input
                className="input"
                placeholder="Seu nome (opcional)"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <button onClick={iniciar} disabled={carregando} className="btn-primary w-full disabled:opacity-60">
                {carregando ? <Loader2 className="animate-spin" size={18} /> : "Iniciar conversa"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {msgs.length === 0 && (
                <p className="text-center text-sm text-muted">Diga olá 👋</p>
              )}
              {msgs.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.autor_tipo === "cliente"
                      ? "bg-brand-600 text-white ml-auto"
                      : "surface-alt"
                  }`}
                >
                  {m.texto}
                </div>
              ))}
              <div ref={fimRef} />
            </div>
            <div className="p-3 border-t border-default flex gap-2">
              <input
                className="input flex-1"
                placeholder="Escreva uma mensagem…"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviar()}
              />
              <button onClick={enviar} className="btn-primary px-4">
                <Send size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
