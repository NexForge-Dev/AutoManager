"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { situacaoRevendedora } from "@/lib/destinoPosLogin";
import { falhaDeRedeAuth } from "@/lib/cargaLoja";
import { sairDaConta } from "@/lib/sair";
import { aplicarCorMarca } from "@/lib/brand";
import { brl } from "@/lib/analytics";
import { parseNumero } from "@/lib/csvProdutos";
import type { Canal } from "@/lib/types";
import { Skeleton } from "@/components/Skeleton";
import { Aviso, EstadoVazio, Segmentado, Selo, type Tom } from "@/components/ui";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Gem,
  ImageOff,
  Loader2,
  LogOut,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  WifiOff,
  X,
} from "lucide-react";

type Variacao = { id: string; nome: string; preco_ajuste: number; estoque_atual: number };
type Prod = {
  id: string;
  nome: string;
  marca: string | null;
  preco_venda: number;
  preco_comparativo: number | null;
  imagens: string[];
  estoque_atual: number;
  variacoes: Variacao[];
};
type Me = { revendedora_id: string; org_id: string; nome: string; comissao_percent: number; loja_nome: string; cor_marca: string | null; logo_url: string | null };
type ItemCarrinho = { produtoId: string; variacaoId: string | null; nome: string; preco: number; qtd: number; max: number };
type Forma = "dinheiro" | "pix" | "boleto" | "credito" | "debito";

// mesmos canais (e rótulos) da tela Vender do app, pra bater nos relatórios da loja
const CANAIS: { id: Canal; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "loja", label: "Loja" },
];

// chave estável do item no carrinho: produto + variação
const chaveItem = (produtoId: string, variacaoId: string | null) => `${produtoId}|${variacaoId ?? ""}`;

const FORMAS: { id: Forma; label: string }[] = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix", label: "Pix" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Crédito" },
  { id: "boleto", label: "Boleto" },
];

const ABAS = [
  ["vender", "Vender"],
  ["vendas", "Minhas vendas"],
] as const;

export default function RevendaPage() {
  const router = useRouter();
  const sb = useRef(createClient());
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [falha, setFalha] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [aba, setAba] = useState<"vender" | "vendas">("vender");
  const [catalogo, setCatalogo] = useState<Prod[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  // falha ao ler catálogo/vendas (sem isso a tela dizia "sem produtos")
  const [erroDados, setErroDados] = useState(false);
  const [recarregando, setRecarregando] = useState(false);

  async function carregar() {
    try {
      const [cat, vds] = await Promise.all([
        sb.current.rpc("revendedora_catalogo"),
        sb.current.rpc("revendedora_minhas_vendas"),
      ]);
      if (cat.error || vds.error) throw cat.error || vds.error;
      setCatalogo((cat.data as Prod[]) || []);
      setVendas((vds.data as any[]) || []);
      setErroDados(false);
    } catch {
      // mantém o que já estava na tela e mostra o aviso com "tentar de novo"
      setErroDados(true);
    }
  }

  async function recarregar() {
    setRecarregando(true);
    await carregar();
    setRecarregando(false);
  }

  useEffect(() => {
    setFalha(false);
    (async () => {
      try {
        const { data: { user }, error: erroSessao } = await sb.current.auth.getUser();
        if (!user) {
          // sem rede não é "sem sessão": mostra "tentar de novo" sem tirar ninguém daqui
          if (falhaDeRedeAuth(erroSessao)) throw erroSessao;
          router.replace("/acesso");
          return;
        }
        const { data, error } = await sb.current.rpc("revendedora_me");
        if (error) throw error;
        if (!data) {
          // vinculada mas bloqueada (plano/loja suspensa) -> /acesso explica o motivo
          const situacao = await situacaoRevendedora();
          router.replace(situacao === "suspensa" ? "/acesso?motivo=suspenso" : "/acesso");
          return;
        }
        const m = data as Me;
        setMe(m);
        if (m.cor_marca) aplicarCorMarca(m.cor_marca);
        await carregar();
      } catch {
        // sem rede: não deixa o spinner girando para sempre
        setFalha(true);
      }
    })();
  }, [router, tentativa]);

  async function sair() {
    // limpa os dados da sessão (e a cor da loja) antes de sair
    setCatalogo([]);
    setVendas([]);
    setMe(null);
    aplicarCorMarca(null);
    await sairDaConta("/acesso");
  }

  if (falha && me === undefined)
    return (
      <div className="min-h-screen grid place-items-center px-4 bg-[var(--bg)]">
        <EstadoVazio
          icone={WifiOff}
          titulo="Não foi possível carregar"
          acao={
            <button onClick={() => setTentativa((t) => t + 1)} className="btn-primary">
              Tentar de novo
            </button>
          }
        >
          Confira sua conexão com a internet e tente de novo.
        </EstadoVazio>
      </div>
    );

  if (!me)
    return (
      <div className="min-h-screen bg-[var(--bg)]" role="status" aria-label="Carregando">
        <div className="h-[3.75rem] surface border-b border-default" />
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-3">
          <Skeleton className="h-8 w-56" />
          <div className="card-list">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="row py-2.5">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="surface border-b border-default sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          {me?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.logo_url} alt={me.loja_nome} className="h-10 w-10 rounded-lg object-cover border border-default" />
          ) : (
            <span className="h-10 w-10 shrink-0 rounded-lg grid place-items-center tone-brand" aria-hidden>
              <Gem size={18} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-bold leading-tight truncate">{me?.loja_nome}</h1>
            <div className="text-xs text-muted truncate">
              {me?.nome} · comissão <span className="tnum">{me?.comissao_percent}%</span>
            </div>
          </div>
          <Segmentado
            rotulo="Área da revendedora"
            opcoes={ABAS}
            valor={aba}
            onChange={setAba}
            className="order-last w-full flex md:order-none md:w-auto [&>button]:flex-1"
          />
          <button type="button" onClick={sair} className="icon-btn -mr-2" aria-label="Sair da conta">
            <LogOut size={20} aria-hidden />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 md:py-5 space-y-4">
        {erroDados && (
          <div role="alert">
            <Aviso
              tom="bad"
              icone={AlertCircle}
              acao={
                <button type="button" onClick={recarregar} disabled={recarregando} className="btn-ghost btn-sm">
                  {recarregando ? <Loader2 className="animate-spin" size={14} aria-hidden /> : "Tentar de novo"}
                </button>
              }
            >
              Não foi possível carregar o catálogo e as vendas.
            </Aviso>
          </div>
        )}
        {aba === "vender" ? (
          <Vender me={me} catalogo={catalogo} erroDados={erroDados} sb={sb.current} onVendido={carregar} />
        ) : (
          <MinhasVendas vendas={vendas} erroDados={erroDados} />
        )}
      </main>
    </div>
  );
}

function Vender({
  me,
  catalogo,
  erroDados,
  sb,
  onVendido,
}: {
  me: Me;
  catalogo: Prod[];
  erroDados: boolean;
  sb: ReturnType<typeof createClient>;
  onVendido: () => Promise<void>;
}) {
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [forma, setForma] = useState<Forma>("pix");
  const [canal, setCanal] = useState<Canal>("whatsapp");
  const [parcelas, setParcelas] = useState(1);
  const [desconto, setDesconto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  // celular: o carrinho fica recolhido numa barra (senão cobria o catálogo e
  // "roubava" os toques nos produtos); expande para revisar e registrar
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);

  // a confirmação de venda some sozinha depois de alguns segundos
  useEffect(() => {
    if (!msg?.ok) return;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  function addItem(p: Prod, v: Variacao | null) {
    const variacaoId = v ? v.id : null;
    const max = v ? v.estoque_atual : p.estoque_atual;
    if (max <= 0) return;
    setMsg(null);
    setCarrinho((c) => {
      const i = c.findIndex((x) => x.produtoId === p.id && x.variacaoId === variacaoId);
      if (i >= 0) {
        if (c[i].qtd >= c[i].max) return c;
        const cp = [...c];
        cp[i] = { ...cp[i], qtd: cp[i].qtd + 1 };
        return cp;
      }
      return [
        ...c,
        { produtoId: p.id, variacaoId, nome: p.nome + (v ? ` · ${v.nome}` : ""), preco: p.preco_venda + (v ? v.preco_ajuste : 0), qtd: 1, max },
      ];
    });
  }

  function mudarQtd(chave: string, delta: number) {
    setMsg(null);
    setCarrinho((c) => {
      const idx = c.findIndex((x) => chaveItem(x.produtoId, x.variacaoId) === chave);
      if (idx < 0) return c;
      const cp = [...c];
      const nova = cp[idx].qtd + delta;
      if (nova <= 0) return cp.filter((_, i) => i !== idx);
      if (nova > cp[idx].max) return cp;
      cp[idx] = { ...cp[idx], qtd: nova };
      return cp;
    });
  }

  const bruto = useMemo(() => carrinho.reduce((a, i) => a + i.preco * i.qtd, 0), [carrinho]);
  const desc = Math.min(Math.max(parseNumero(desconto) || 0, 0), bruto);
  const total = bruto - desc;
  const comissao = (total * me.comissao_percent) / 100;

  async function registrar() {
    if (carrinho.length === 0 || enviando) return;
    setEnviando(true);
    setMsg(null);
    let data: unknown = null;
    let error: { message: string } | null = null;
    try {
      ({ data, error } = await sb.rpc("revendedora_registrar_venda", {
        p_itens: carrinho.map((i) => ({ produto_id: i.produtoId, variacao_id: i.variacaoId, qtd: i.qtd })),
        p_forma: forma,
        p_parcelas: forma === "credito" ? parcelas : 1,
        p_canal: canal,
        p_desconto: desc,
      }));
    } catch {
      error = { message: "rede" };
    }
    setEnviando(false);
    if (error) {
      setMsg({ ok: false, txt: traduz(error.message) });
      return;
    }
    setMsg({ ok: true, txt: `Venda registrada! Total ${brl((data as any)?.total ?? total)} · sua comissão ${brl((data as any)?.comissao ?? comissao)}.` });
    setCarrinho([]);
    setDesconto("");
    setParcelas(1);
    await onVendido();
  }

  const qtdItens = carrinho.reduce((a, i) => a + i.qtd, 0);
  const qtdNoCarrinho = (produtoId: string, variacaoId: string | null) =>
    carrinho.find((x) => x.produtoId === produtoId && x.variacaoId === variacaoId)?.qtd ?? 0;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-5 lg:items-start">
      {/* catálogo */}
      <div className="min-w-0">
        <h2 className="section-title mb-2">Catálogo</h2>
        {catalogo.length === 0 ? (
          erroDados ? null : (
            <div className="card p-0">
              <EstadoVazio icone={Package} titulo="A loja ainda não tem produtos disponíveis.">
                Quando a loja cadastrar produtos, eles aparecem aqui.
              </EstadoVazio>
            </div>
          )
        ) : (
          <div className="card-list">
            {catalogo.map((p) => (
              <ProdutoLinha key={p.id} p={p} qtdDe={qtdNoCarrinho} onAdd={addItem} onSub={mudarQtd} />
            ))}
          </div>
        )}
        {/* espaço para a barra fixa não cobrir os últimos produtos */}
        <div aria-hidden className={`${carrinho.length > 0 ? (carrinhoAberto ? "h-[70vh]" : "h-40") : "h-4"} lg:hidden`} />
      </div>

      {/* venda: barra fixa no celular/tablet, coluna lateral no desktop */}
      {carrinho.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 px-4 lg:px-0 lg:sticky lg:top-20 lg:bottom-auto">
          <div className="card shadow-pop lg:shadow-none space-y-3 max-w-3xl lg:max-w-none mx-auto max-h-[75dvh] lg:max-h-[calc(100vh-6rem)] overflow-auto">
            <button
              type="button"
              onClick={() => setCarrinhoAberto((v) => !v)}
              aria-expanded={carrinhoAberto}
              aria-controls="rev-carrinho"
              className="lg:hidden w-full flex items-center justify-between gap-2 min-h-[44px] -my-1 text-sm"
            >
              <span className="flex items-center gap-2 min-w-0 text-muted">
                <ShoppingBag size={16} className="text-accent shrink-0" aria-hidden />
                <span className="truncate tnum">
                  {qtdItens} {qtdItens === 1 ? "item" : "itens"} · {CANAIS.find((c) => c.id === canal)?.label} ·{" "}
                  {FORMAS.find((f) => f.id === forma)?.label}
                </span>
              </span>
              <span className="shrink-0 flex items-center gap-1 font-semibold text-accent">
                {carrinhoAberto ? "Ocultar" : "Ver venda"}
                {carrinhoAberto ? <ChevronDown size={16} aria-hidden /> : <ChevronUp size={16} aria-hidden />}
              </span>
            </button>

            <div id="rev-carrinho" className={`${carrinhoAberto ? "" : "hidden"} lg:block space-y-3`}>
              <div className="flex items-center justify-between">
                <h2 className="section-title">Venda</h2>
                <button onClick={() => setCarrinho([])} aria-label="Limpar venda" className="icon-btn -mr-2">
                  <X size={18} aria-hidden />
                </button>
              </div>
              <ul className="space-y-1 max-h-40 overflow-auto">
                {carrinho.map((i) => {
                  const chave = chaveItem(i.produtoId, i.variacaoId);
                  return (
                    <li key={chave} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 min-w-0 truncate">{i.nome}</span>
                      <Stepper
                        nome={i.nome}
                        qtd={i.qtd}
                        max={i.max}
                        onAdd={() => mudarQtd(chave, 1)}
                        onSub={() => mudarQtd(chave, -1)}
                      />
                      <span className="w-[4.5rem] shrink-0 text-right font-medium tnum">{brl(i.preco * i.qtd)}</span>
                    </li>
                  );
                })}
              </ul>

              {/* canal */}
              <div>
                <div className="eyebrow mb-1.5" id="rev-canal">Onde foi a venda?</div>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="rev-canal">
                  {CANAIS.map((c) => (
                    <button type="button" key={c.id} aria-pressed={canal === c.id} onClick={() => setCanal(c.id)} className="chip">
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* pagamento */}
              <div>
                <div className="eyebrow mb-1.5" id="rev-forma">Como foi o pagamento?</div>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="rev-forma">
                  {FORMAS.map((f) => (
                    <button type="button" key={f.id} aria-pressed={forma === f.id} onClick={() => setForma(f.id)} className="chip">
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              {forma === "credito" && (
                <div>
                  <label htmlFor="rev-parcelas" className="label">Parcelas no cartão</label>
                  <select id="rev-parcelas" className="input" value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}x {n === 1 ? "(à vista)" : `de ${brl(total / n)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="rev-desconto" className="label">Desconto (R$)</label>
                <input id="rev-desconto" className="input" inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" />
              </div>
            </div>

            {msg && (
              <div role={msg.ok ? "status" : "alert"}>
                <Aviso tom={msg.ok ? "ok" : "bad"} icone={msg.ok ? CheckCircle2 : AlertCircle}>{msg.txt}</Aviso>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 lg:pt-3 lg:border-t lg:border-default">
              <div className="min-w-0">
                <div className="figure">{brl(total)}</div>
                <div className="text-xs text-accent truncate tnum">comissão {brl(comissao)}</div>
              </div>
              <button type="button" onClick={registrar} disabled={enviando || carrinho.length === 0} className="btn-primary px-4 shrink-0">
                {enviando ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Check size={18} aria-hidden />}{" "}
                {enviando ? "Registrando…" : "Registrar venda"}
              </button>
            </div>
          </div>
        </div>
      )}

      {carrinho.length === 0 && (
        <aside className="fixed inset-x-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 space-y-3 lg:sticky lg:inset-x-0 lg:top-20 lg:bottom-auto">
          {msg?.ok && (
            <div role="status" className="surface shadow-pop lg:shadow-none" style={{ borderRadius: "var(--r-card)" }}>
              <Aviso tom="ok" icone={CheckCircle2}>{msg.txt}</Aviso>
            </div>
          )}
          <div className="card p-0 hidden lg:block">
            <EstadoVazio compacto icone={ShoppingBag} titulo="Nenhum item na venda">
              Adicione produtos do catálogo para registrar a venda.
            </EstadoVazio>
          </div>
        </aside>
      )}
    </div>
  );
}

function Miniatura({ url }: { url?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" decoding="async" className="h-10 w-10 rounded-lg object-cover shrink-0" />;
  }
  return (
    <span className="grid place-items-center h-10 w-10 rounded-lg surface-alt text-muted shrink-0" aria-hidden>
      <ImageOff size={16} />
    </span>
  );
}

function Disponivel({ qtd }: { qtd: number }) {
  if (qtd <= 0) return <Selo tom="bad">Esgotado</Selo>;
  return <span className="text-xs text-muted tnum">{qtd} un</span>;
}

function Stepper({
  nome,
  qtd,
  max,
  onAdd,
  onSub,
}: {
  nome: string;
  qtd: number;
  max: number;
  onAdd: () => void;
  onSub: () => void;
}) {
  if (qtd === 0) {
    return (
      <button type="button" onClick={onAdd} disabled={max <= 0} aria-label={`Adicionar ${nome}`} className="btn-ghost h-11 w-11 min-h-0 p-0 shrink-0">
        <Plus size={18} aria-hidden />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button type="button" onClick={onSub} aria-label={`Diminuir quantidade de ${nome}`} className="btn-ghost h-11 w-11 min-h-0 p-0">
        <Minus size={16} aria-hidden />
      </button>
      <span className="font-bold w-6 text-center tnum">{qtd}</span>
      <button type="button" onClick={onAdd} disabled={qtd >= max} aria-label={`Aumentar quantidade de ${nome}`} className="btn-primary h-11 w-11 min-h-0 p-0">
        <Plus size={16} aria-hidden />
      </button>
    </div>
  );
}

function ProdutoLinha({
  p,
  qtdDe,
  onAdd,
  onSub,
}: {
  p: Prod;
  qtdDe: (produtoId: string, variacaoId: string | null) => number;
  onAdd: (p: Prod, v: Variacao | null) => void;
  onSub: (chave: string, delta: number) => void;
}) {
  const esgotado = p.estoque_atual <= 0;
  if (p.variacoes.length === 0) {
    return (
      <div className="row py-2.5">
        <Miniatura url={p.imagens[0]} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{p.nome}</div>
          <div className="text-sm flex items-center gap-2 flex-wrap">
            <span className="tnum">{brl(p.preco_venda)}</span>
            <Disponivel qtd={p.estoque_atual} />
          </div>
        </div>
        <Stepper
          nome={p.nome}
          qtd={qtdDe(p.id, null)}
          max={p.estoque_atual}
          onAdd={() => onAdd(p, null)}
          onSub={() => onSub(chaveItem(p.id, null), -1)}
        />
      </div>
    );
  }
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Miniatura url={p.imagens[0]} />
        <div className="min-w-0">
          <div className="font-semibold truncate">{p.nome}</div>
          {esgotado && <Selo tom="bad">Esgotado</Selo>}
        </div>
      </div>
      <div className="mt-1 divide-y divide-[color:var(--border)] sm:pl-[3.25rem]">
        {p.variacoes.map((v) => (
          <div key={v.id} className="flex items-center justify-between gap-3 py-1.5">
            <div className="text-sm min-w-0">
              <div className="font-medium truncate">{v.nome}</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="tnum">{brl(p.preco_venda + Number(v.preco_ajuste || 0))}</span>
                <Disponivel qtd={v.estoque_atual} />
              </div>
            </div>
            <Stepper
              nome={`${p.nome} ${v.nome}`}
              qtd={qtdDe(p.id, v.id)}
              max={esgotado ? 0 : v.estoque_atual}
              onAdd={() => onAdd(p, v)}
              onSub={() => onSub(chaveItem(p.id, v.id), -1)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const FORMA_LABEL: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", boleto: "Boleto", credito: "Crédito", debito: "Débito" };

const STATUS_COMISSAO: Record<string, string> = { paga: "paga", pendente: "pendente", cancelada: "cancelada" };
const TOM_COMISSAO: Record<string, Tom> = { paga: "ok", pendente: "warn", cancelada: "neutral" };

function MinhasVendas({ vendas, erroDados }: { vendas: any[]; erroDados: boolean }) {
  if (vendas.length === 0)
    return erroDados ? null : (
      <div className="card p-0">
        <EstadoVazio icone={ClipboardList} titulo="Você ainda não registrou vendas.">
          As vendas que você registrar aparecem aqui, com a sua comissão.
        </EstadoVazio>
      </div>
    );
  const linhas = vendas.map((v) => {
    const d = new Date(v.data);
    return {
      id: v.id as string,
      total: brl(Number(v.total)),
      data: `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      itens: (v.itens || []).map((i: any) => `${i.qtd}× ${i.nome}${i.variacao_nome ? ` (${i.variacao_nome})` : ""}`).join(", "),
      pag: `${FORMA_LABEL[v.forma_pagamento] || v.forma_pagamento || ""}${v.forma_pagamento === "credito" && Number(v.parcelas) > 1 ? ` ${v.parcelas}x` : ""}`,
      comissao: brl(Number(v.comissao_total)),
      cancelada: v.status_comissao === "cancelada",
      status: STATUS_COMISSAO[v.status_comissao] ?? "pendente",
    };
  });
  return (
    <>
      {/* celular: linhas */}
      <div className="card-list md:hidden">
        {linhas.map((l) => (
          <div key={l.id} className="px-4 py-3 space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold tnum">{l.total}</span>
              <span className="text-xs text-muted tnum shrink-0">{l.data}</span>
            </div>
            <div className="text-sm text-muted">{l.itens}</div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">{l.pag}</span>
              <span className="flex items-center gap-2">
                <span className={`tnum ${l.cancelada ? "text-muted line-through" : ""}`}>{l.comissao}</span>
                <Selo tom={TOM_COMISSAO[l.status]}>{l.status}</Selo>
              </span>
            </div>
          </div>
        ))}
      </div>
      {/* desktop: tabela */}
      <div className="card p-0 overflow-hidden hidden md:block">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Itens</th>
                <th scope="col">Pagamento</th>
                <th scope="col" className="num">Total</th>
                <th scope="col" className="num">Comissão</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-muted tnum">{l.data}</td>
                  <td>{l.itens}</td>
                  <td className="whitespace-nowrap">{l.pag}</td>
                  <td className="num font-semibold">{l.total}</td>
                  <td className={`num ${l.cancelada ? "text-muted line-through" : ""}`}>{l.comissao}</td>
                  <td><Selo tom={TOM_COMISSAO[l.status]}>{l.status}</Selo></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function traduz(msg: string) {
  if (/sem_estoque/.test(msg)) return "Estoque insuficiente para um dos itens. Ajuste as quantidades.";
  if (/escolha_variacao/.test(msg)) return "Escolha a variação (tamanho/cor) de um dos produtos.";
  if (/sem_acesso/.test(msg)) return "Seu acesso à loja não está ativo. Saia e entre novamente.";
  if (/sem_itens/.test(msg)) return "Adicione ao menos um item.";
  if (/qtd_invalida/.test(msg)) return "Quantidade inválida em um dos itens.";
  if (/produto_invalido|variacao_invalida/.test(msg)) return "Um item não está mais disponível. Remova-o e tente de novo.";
  if (/canal_invalido/.test(msg)) return "Canal de venda inválido.";
  if (/rede|fetch|network/i.test(msg)) return "Sem conexão. Confira a internet e tente de novo.";
  return "Não foi possível registrar a venda. Tente de novo.";
}
