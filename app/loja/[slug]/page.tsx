"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { aplicarCorMarca } from "@/lib/brand";
import { aplicarFavicon } from "@/lib/aparencia";
import { carregarFonte } from "@/lib/fontes";
import { waLink, igLink, fbLink, ttLink } from "@/lib/contato";
import { brl } from "@/lib/analytics";
import { Skeleton } from "@/components/Skeleton";
import { Aviso, EstadoVazio, iniciais } from "@/components/ui";
import Modal from "@/components/Modal";
import { linkPedido, loginAnonimoLigado, precoDaVariacao } from "@/lib/vitrine";
import {
  AlertCircle,
  ChevronRight,
  Facebook,
  Instagram,
  Loader2,
  Mail,
  MessageCircle,
  Music2,
  Phone,
  Search,
  Send,
  ShoppingBag,
  Store,
  WifiOff,
  X,
} from "lucide-react";

// A vitrine é da LOJA, não do AutoManager: fundo claro e neutro, sobre o qual a cor,
// a fonte e a logo do lojista aparecem. Não depende do tema salvo no navegador do cliente.
const TEMA_VITRINE = {
  "--bg": "#fafaf9",
  "--surface": "#ffffff",
  "--surface-alt": "#f1f0ee",
  "--text": "#1c1917",
  "--text-muted": "#6b6560",
  "--border": "#e7e5e1",
  "--accent": "var(--brand-700)",
  "--ok": "4 120 87",
  "--warn": "146 64 14",
  "--bad": "185 28 28",
  "--info": "29 78 216",
  "--hover": "rgb(28 25 23 / 0.04)",
  "--shadow-soft": "0 1px 2px rgb(28 25 23 / 0.04)",
  "--shadow-md": "0 4px 12px rgb(28 25 23 / 0.08)",
  "--shadow-pop": "0 12px 32px rgb(28 25 23 / 0.16)",
  colorScheme: "light",
} as React.CSSProperties;

function Vitrine({ fonte, children }: { fonte?: string; children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[var(--bg)] text-strong"
      style={fonte ? { ...TEMA_VITRINE, fontFamily: fonte } : TEMA_VITRINE}
    >
      {children}
    </div>
  );
}

// localStorage pode lançar (modo privado, cookies bloqueados): o chat segue sem ele
function lsLer(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function lsGravar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* ignora */
  }
}
const sufixo = () => Math.random().toString(36).slice(2, 8);

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

export default function LojaPage() {
  const { slug } = useParams<{ slug: string }>();
  const sb = useRef(createClient());
  const [loja, setLoja] = useState<Loja | null | undefined>(undefined);
  const [chat, setChat] = useState(false);
  const [fontStack, setFontStack] = useState("");
  const [filtroCat, setFiltroCat] = useState<string | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);
  const [detalhe, setDetalhe] = useState<ProdutoPub | null>(null);
  // sem login anônimo no Supabase o chat não funciona para visitante: em vez de um
  // botão que só falha depois de preencher o nome, ele nem aparece.
  // undefined = ainda verificando; a dúvida (rede) mantém o botão, e o chat explica
  const [chatLigado, setChatLigado] = useState<boolean | undefined>(undefined);
  const [aba, setAba] = useState<"inicio" | "sobre" | "contato">("inicio");
  const [falhaRede, setFalhaRede] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    setFalhaRede(false);
    sb.current.rpc("loja_publica", { p_slug: slug }).then(({ data, error }) => {
      // erro de rede/servidor não é "loja não existe": oferece tentar de novo
      if (error) {
        setFalhaRede(true);
        return;
      }
      const d = (data as Loja) ?? null;
      setLoja(d);
      if (d?.cor_marca) aplicarCorMarca(d.cor_marca);
      if (d?.fonte) setFontStack(carregarFonte(d.fonte));
      // ícone/título da aba = logo e nome da loja, sem gravar no cache: senão a landing e
      // as outras lojas abriam com o ícone da última vitrine visitada
      if (d) aplicarFavicon(d.logo_url, d.nome, false);
    });
  }, [slug, tentativa]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const ligado = await loginAnonimoLigado(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      // quem já tem sessão (conversa anterior, dono testando a loja) continua conversando
      const { data } = await sb.current.auth.getSession();
      if (ativo) setChatLigado(ligado !== false || !!data.session);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  // badge de não lidas: se o cliente já conversou aqui, conta mensagens da LOJA
  // chegadas depois da última vez que ele abriu o chat (mesmo com o chat fechado).
  useEffect(() => {
    if (!loja) return;
    const orgId = loja.org_id;
    const token = lsLer("amchat_" + orgId);
    if (!token || !chatLigado) return;
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
      const visto = Number(lsLer("amchat_visto_" + orgId) || 0);
      const novas = ((data.mensagens as any[]) || []).filter(
        (m) => m.autor_tipo === "loja" && new Date(m.criada_em).getTime() > visto
      ).length;
      setNaoLidas(novas);

      canal = client
        .channel(`badge-${data.id}-${sufixo()}`)
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
  }, [loja, chatLigado]);

  function abrirChat() {
    if (loja) lsGravar("amchat_visto_" + loja.org_id, String(Date.now()));
    setNaoLidas(0);
    setChat(true);
  }
  function fecharChat() {
    if (loja) lsGravar("amchat_visto_" + loja.org_id, String(Date.now()));
    setNaoLidas(0);
    setChat(false);
  }

  if (falhaRede)
    return (
      <Vitrine>
        <main className="min-h-screen grid place-items-center px-4">
          <EstadoVazio
            icone={WifiOff}
            titulo="Não foi possível carregar a loja"
            acao={
              <button onClick={() => setTentativa((t) => t + 1)} className="btn-primary">
                Tentar de novo
              </button>
            }
          >
            Confira sua conexão com a internet e tente de novo.
          </EstadoVazio>
        </main>
      </Vitrine>
    );

  if (loja === undefined)
    return (
      <Vitrine>
        <div role="status" aria-label="Carregando">
          <Skeleton className="h-24 md:h-36 w-full !rounded-none" />
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 space-y-5">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          </div>
        </div>
      </Vitrine>
    );

  if (loja === null)
    return (
      <Vitrine>
        <main className="min-h-screen grid place-items-center px-4">
          <EstadoVazio
            icone={Search}
            titulo="Loja não encontrada"
            acao={<Link href="/" className="btn-primary">Conhecer o AutoManager</Link>}
          >
            Este link pode estar incorreto ou a loja está fora do ar.
          </EstadoVazio>
        </main>
      </Vitrine>
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
    <Vitrine fonte={fontStack}>
      {/* cabeçalho da loja */}
      <header className="surface border-b border-default">
        {loja.capa_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={loja.capa_url} alt="" className="h-40 md:h-64 w-full object-cover" />
        ) : (
          <div className="h-20 md:h-32 bg-brand-500/15" aria-hidden />
        )}
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="-mt-10 md:-mt-12">
            {loja.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={loja.logo_url}
                alt={loja.nome}
                className="relative h-20 w-20 md:h-24 md:w-24 rounded-full object-cover border-4 border-[var(--surface)] bg-[var(--surface)]"
              />
            ) : (
              <div
                className="relative h-20 w-20 md:h-24 md:w-24 rounded-full bg-brand-600 grid place-items-center text-white text-2xl font-bold border-4 border-[var(--surface)]"
                aria-hidden
              >
                {iniciais(loja.nome)}
              </div>
            )}
            <h1 className="mt-2 text-2xl md:text-[2rem] font-bold leading-tight tracking-tight break-words">{loja.nome}</h1>
            {loja.descricao && abaAtual === "inicio" && (
              <p className="mt-1 text-muted max-w-2xl [overflow-wrap:anywhere]">{loja.descricao}</p>
            )}
          </div>

          {/* navegação */}
          {abas.length > 1 ? (
            <nav aria-label="Seções da loja" className="flex flex-wrap gap-x-6 mt-3 -mb-px">
              {abas.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAba(a.key)}
                  aria-current={abaAtual === a.key ? "page" : undefined}
                  className={`min-h-[44px] border-b-2 text-sm font-semibold transition-colors ${
                    abaAtual === a.key ? "border-brand-600 text-strong" : "border-transparent text-muted hover:text-strong"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </nav>
          ) : (
            <div className="h-4" />
          )}
        </div>
      </header>

      {/* INÍCIO: catálogo */}
      {abaAtual === "inicio" && (
        <main className="max-w-5xl mx-auto px-4 md:px-6 pt-5 pb-28">
          {loja.produtos.length === 0 ? (
            <EstadoVazio icone={Store} titulo="Catálogo em breve." />
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
                    <div
                      tabIndex={0}
                      className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap [scrollbar-width:none]"
                      role="group"
                      aria-label="Filtrar por categoria"
                    >
                      <button onClick={() => setFiltroCat(null)} aria-pressed={filtroCat === null} className="chip">
                        Tudo <span className="tnum">({loja.produtos.length})</span>
                      </button>
                      {categorias.map((c) => (
                        <button key={c} onClick={() => setFiltroCat(c)} aria-pressed={filtroCat === c} className="chip">
                          {c} <span className="tnum">({contagem.get(c) || 0})</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 md:gap-x-5 gap-y-6">
                    {lista.map((p) => (
                      <ProdutoCard key={p.id} p={p} onAbrir={() => setDetalhe(p)} />
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
        <main className="max-w-2xl mx-auto px-4 md:px-6 pt-6 pb-28">
          <h2 className="text-xl font-bold">Sobre {loja.nome}</h2>
          <p className="mt-2 leading-relaxed text-muted whitespace-pre-line [overflow-wrap:anywhere]">{loja.sobre}</p>
        </main>
      )}

      {/* CONTATO */}
      {abaAtual === "contato" && temContato && (
        <main className="max-w-2xl mx-auto px-4 md:px-6 pt-6 pb-28">
          <LojaContato loja={loja} />
        </main>
      )}

      {/* botão de chat; sem chat, o WhatsApp da loja ocupa o lugar */}
      <aside aria-label="Falar com a loja">
      {chatLigado ? (
        <button
          onClick={abrirChat}
          className="btn-primary fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 md:right-6 z-40 rounded-full px-5 min-h-[48px] shadow-pop"
        >
          <MessageCircle size={20} aria-hidden /> Falar com a loja
          {naoLidas > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full bg-bad text-white text-xs font-bold grid place-items-center border-2 border-[var(--bg)]">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </button>
      ) : (
        chatLigado === false &&
        loja.whatsapp && (
          <a
            href={waLink(loja.whatsapp)}
            target="_blank"
            rel="noreferrer"
            className="btn-primary fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 md:right-6 z-40 rounded-full px-5 min-h-[48px] shadow-pop"
          >
            <MessageCircle size={20} aria-hidden /> Falar no WhatsApp
          </a>
        )
      )}
      </aside>

      {chat && (
        <ChatWidget
          orgId={loja.org_id}
          sb={sb.current}
          nomeLoja={loja.nome}
          onClose={fecharChat}
          onIndisponivel={() => setChatLigado(false)}
        />
      )}
      {detalhe && <ProdutoDetalhe p={detalhe} whatsapp={loja.whatsapp} onClose={() => setDetalhe(null)} />}
    </Vitrine>
  );
}

function ProdutoCard({ p, onAbrir }: { p: ProdutoPub; onAbrir: () => void }) {
  const temDesconto = p.preco_comparativo != null && p.preco_comparativo > p.preco_venda;
  const esgotado = p.esgotado;
  return (
    <article className="min-w-0 flex flex-col">
      <button type="button" onClick={onAbrir} className="min-w-0 flex-1 flex flex-col text-left">
      <div className={`w-full aspect-square relative overflow-hidden ${p.imagens[0] ? "surface-alt" : "bg-brand-500/10"}`} style={{ borderRadius: "var(--r-card)" }}>
        {p.imagens[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.imagens[0]}
            alt=""
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover ${esgotado ? "opacity-60" : ""}`}
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-accent opacity-50" aria-hidden>
            <ShoppingBag size={28} />
          </div>
        )}
        {esgotado && (
          <span className="absolute top-2 left-2 badge bg-black/75 text-white">Esgotado</span>
        )}
      </div>
      <div className="pt-2.5 w-full min-w-0 flex-1 flex flex-col [overflow-wrap:anywhere]">
        <h2 className={`text-[0.9375rem] font-semibold leading-snug ${esgotado ? "text-muted" : ""}`}>{p.nome}</h2>
        {p.marca && <div className="text-xs text-muted mt-0.5">{p.marca}</div>}
        {p.descricao && <p className="text-xs text-muted mt-1 line-clamp-2 whitespace-pre-line">{p.descricao}</p>}
        <div className="mt-auto pt-1.5">
          {temDesconto && (
            <div className="text-xs text-muted line-through tnum">{brl(p.preco_comparativo!)}</div>
          )}
          <div className="font-bold tnum">{brl(p.preco_venda)}</div>
          {p.variacoes.length > 0 && (
            <div className="text-xs text-muted line-clamp-1">{p.variacoes.map((v) => v.nome).join(", ")}</div>
          )}
        </div>
      </div>
      </button>
    </article>
  );
}

// Detalhe do produto: fotos, opções com preço e estoque, e como pedir.
function ProdutoDetalhe({ p, whatsapp, onClose }: { p: ProdutoPub; whatsapp: string | null; onClose: () => void }) {
  const disponiveis = p.variacoes.filter((v) => !v.esgotado);
  const [varId, setVarId] = useState<string | null>(disponiveis.length === 1 ? disponiveis[0].id : null);
  const variacao = p.variacoes.find((v) => v.id === varId) ?? null;
  const precisaEscolher = p.variacoes.length > 0 && !variacao;
  const esgotado = p.esgotado || (p.variacoes.length > 0 && disponiveis.length === 0);
  const pedido = linkPedido(whatsapp, p, variacao);
  return (
    <Modal onClose={onClose} titulo={<span className="[overflow-wrap:anywhere]">{p.nome}</span>} style={TEMA_VITRINE} className="space-y-4">
      {p.imagens.length > 0 && (
        <div tabIndex={0} role="group" aria-label="Fotos do produto" className="flex gap-2 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 [scrollbar-width:none]">
          {p.imagens.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={p.imagens.length > 1 ? `${p.nome}, foto ${i + 1}` : p.nome}
              loading="lazy"
              className="snap-center shrink-0 h-64 w-64 max-w-full rounded-xl object-cover surface-alt"
            />
          ))}
        </div>
      )}
      <div>
        <div className="text-xl font-bold tnum">{brl(precoDaVariacao(p, variacao))}</div>
        {p.marca && <div className="text-sm text-muted [overflow-wrap:anywhere]">{p.marca}</div>}
      </div>
      {p.descricao && <p className="text-sm text-muted whitespace-pre-line [overflow-wrap:anywhere]">{p.descricao}</p>}
      {p.variacoes.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-1.5">Opções</div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Escolha uma opção">
            {p.variacoes.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={v.esgotado}
                aria-pressed={varId === v.id}
                onClick={() => setVarId(v.id)}
                className="chip whitespace-normal [overflow-wrap:anywhere] disabled:opacity-50 disabled:line-through disabled:cursor-not-allowed"
              >
                {v.nome}
                {Number(v.preco_ajuste) !== 0 && <span className="tnum">{brl(precoDaVariacao(p, v))}</span>}
                {v.esgotado && <span>(esgotado)</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {esgotado ? (
        <Aviso tom="warn" icone={AlertCircle}>Este produto está esgotado no momento.</Aviso>
      ) : !whatsapp ? (
        <p className="text-sm text-muted">Para comprar, fale com a loja pelos contatos da página.</p>
      ) : precisaEscolher ? (
        <p className="text-sm text-muted">Escolha uma opção para pedir pelo WhatsApp.</p>
      ) : (
        <a href={pedido} target="_blank" rel="noreferrer" className="btn-primary w-full">
          <MessageCircle size={18} aria-hidden /> Pedir pelo WhatsApp
        </a>
      )}
    </Modal>
  );
}

function LojaContato({ loja }: { loja: Loja }) {
  const links = [
    loja.whatsapp && { href: waLink(loja.whatsapp), icon: <MessageCircle size={18} aria-hidden />, label: "WhatsApp" },
    loja.telefone && { href: `tel:${loja.telefone.replace(/[^\d+]/g, "")}`, icon: <Phone size={18} aria-hidden />, label: "Telefone" },
    loja.email && { href: `mailto:${loja.email}`, icon: <Mail size={18} aria-hidden />, label: "E-mail" },
    loja.instagram && { href: igLink(loja.instagram), icon: <Instagram size={18} aria-hidden />, label: "Instagram" },
    loja.facebook && { href: fbLink(loja.facebook), icon: <Facebook size={18} aria-hidden />, label: "Facebook" },
    loja.tiktok && { href: ttLink(loja.tiktok), icon: <Music2 size={18} aria-hidden />, label: "TikTok" },
  ].filter(Boolean) as { href: string; icon: React.ReactNode; label: string }[];

  if (links.length === 0) return null;

  return (
    <>
      <h2 className="text-xl font-bold mb-3">Fale com a gente</h2>
      <div className="card-list">
        {links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="row font-medium">
            <span className="text-accent">{l.icon}</span>
            <span className="flex-1">{l.label}</span>
            <ChevronRight size={17} className="text-muted" aria-hidden />
          </a>
        ))}
      </div>
    </>
  );
}

type Msg = { id: string; autor_tipo: string; texto: string };

function ChatWidget({
  orgId,
  sb,
  nomeLoja,
  onClose,
  onIndisponivel,
}: {
  orgId: string;
  sb: ReturnType<typeof createClient>;
  nomeLoja: string;
  onClose: () => void;
  onIndisponivel: () => void;
}) {
  const [nome, setNome] = useState("");
  const [iniciado, setIniciado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [restaurando, setRestaurando] = useState(true);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const meId = useRef<string | null>(null);
  const montado = useRef(true);
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
    // widget fechou enquanto restaurava: não deixa canal órfão
    if (!montado.current) return;
    if (chRef.current) sb.removeChannel(chRef.current);
    // nome único: reabrir o chat não reaproveita um canal que ainda está sendo removido
    chRef.current = sb
      .channel(`conv-${convId}-${sufixo()}`)
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
        const token = lsLer(tokenKey);
        if (!token) return; // nunca conversou neste navegador
        await garantirSessao();
        const { data } = await sb.rpc("recuperar_conversa", { p_org: orgId, p_token: token });
        if (data && montado.current) {
          setConversaId(data.id);
          if (data.cliente_nome) setNome(data.cliente_nome);
          setMsgs((data.mensagens as Msg[]) || []);
          assinarRealtime(data.id);
          setIniciado(true);
        }
      } catch {
        /* segue para a tela inicial */
      } finally {
        if (montado.current) setRestaurando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function iniciar() {
    setErro(null);
    setCarregando(true);
    try {
      const uid = await garantirSessao();
      if (!uid) throw new Error("sessão");
      let token = lsLer(tokenKey);
      if (!token) {
        token = crypto.randomUUID();
        lsGravar(tokenKey, token);
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
      const msg = String(e?.message || e);
      // a checagem inicial não conseguiu saber: o botão sai ao fechar, sem insistir
      if (/anonymous sign-ins are disabled/i.test(msg)) onIndisponivel();
      setErro(
        /anonymous sign-ins are disabled/i.test(msg)
          ? "O chat desta loja está indisponível no momento. Tente pelo WhatsApp ou mais tarde."
          : /chat_limite/.test(msg)
            ? "Você abriu muitas conversas em pouco tempo. Aguarde um pouco e tente de novo."
            : /fetch|network/i.test(msg)
              ? "Sem conexão. Confira sua internet e tente de novo."
              : "Não foi possível iniciar o chat. Tente de novo em instantes."
      );
    } finally {
      setCarregando(false);
    }
  }

  async function enviar() {
    const t = texto.trim();
    // um envio por vez: Enter repetido (ou composição do teclado) não duplica a mensagem
    if (!t || !conversaId || !meId.current || enviando) return;
    setErro(null);
    setEnviando(true);
    setTexto("");
    const { data, error } = await sb
      .from("mensagem")
      .insert({ conversa_id: conversaId, org_id: orgId, autor_id: meId.current, autor_tipo: "cliente", texto: t })
      .select("id, autor_tipo, texto")
      .single();
    setEnviando(false);
    if (error) {
      setErro(
        /chat_limite/.test(error.message)
          ? "Muitas mensagens em pouco tempo. Aguarde um minuto e tente de novo."
          : "Não foi possível enviar a mensagem. Tente de novo."
      );
      setTexto(t);
      return;
    }
    if (data) setMsgs((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Msg]));
  }

  // ref: o pai recria onClose a cada render; o efeito abaixo não pode re-rodar
  // (a limpeza removeria o canal do realtime)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    montado.current = true;
    const fecharNoEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", fecharNoEsc);
    return () => {
      montado.current = false;
      window.removeEventListener("keydown", fecharNoEsc);
      if (chRef.current) sb.removeChannel(chRef.current); // remove só o canal do widget
      chRef.current = null;
    };
  }, [sb]);

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-titulo"
        className="sheet-panel surface w-full max-w-md md:rounded-2xl rounded-t-2xl flex flex-col h-[80dvh] md:h-[600px] shadow-pop"
      >
        <header className="flex items-center justify-between gap-3 pl-4 pr-3 py-2.5 border-b border-default">
          <div id="chat-titulo" className="font-semibold truncate">{nomeLoja}</div>
          <button onClick={onClose} aria-label="Fechar chat" className="icon-btn">
            <X size={20} aria-hidden />
          </button>
        </header>

        {restaurando ? (
          <div className="flex-1 grid place-items-center text-accent" role="status" aria-label="Carregando">
            <Loader2 className="animate-spin" aria-hidden />
          </div>
        ) : !iniciado ? (
          <div className="flex-1 grid place-items-center p-6 text-center">
            <div className="space-y-3 w-full">
              <span className="mx-auto grid place-items-center h-11 w-11 rounded-xl tone-brand" aria-hidden>
                <MessageCircle size={21} />
              </span>
              <p className="text-sm text-muted">Mande uma mensagem direto para a loja.</p>
              <input
                className="input"
                placeholder="Seu nome (opcional)"
                aria-label="Seu nome (opcional)"
                maxLength={120}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              {erro && (
                <div role="alert" className="text-left">
                  <Aviso tom="bad" icone={AlertCircle}>{erro}</Aviso>
                </div>
              )}
              <button onClick={iniciar} disabled={carregando} className="btn-primary w-full">
                {carregando ? <Loader2 className="animate-spin" size={18} aria-hidden /> : "Iniciar conversa"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {msgs.length === 0 && (
                <p className="text-center text-sm text-muted">Diga olá</p>
              )}
              {msgs.map((m) => (
                <div
                  key={m.id}
                  className={`w-fit max-w-[80%] rounded-2xl px-3 py-2 text-sm break-words ${
                    m.autor_tipo === "cliente"
                      ? "bg-brand-600 text-white ml-auto rounded-br-md"
                      : "surface-alt rounded-bl-md"
                  }`}
                >
                  {m.texto}
                </div>
              ))}
              <div ref={fimRef} />
            </div>
            {erro && <p role="alert" className="px-4 pt-2 text-sm text-bad">{erro}</p>}
            <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-default flex gap-2">
              <input
                className="input flex-1 min-w-0"
                placeholder="Escreva uma mensagem…"
                aria-label="Mensagem"
                maxLength={2000}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && enviar()}
              />
              <button onClick={enviar} disabled={enviando} aria-label="Enviar mensagem" className="btn-primary h-11 w-11 min-h-0 p-0 shrink-0">
                <Send size={18} aria-hidden />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
