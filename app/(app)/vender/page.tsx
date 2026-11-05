"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { parseNumero } from "@/lib/csvProdutos";
import { apagarRascunho, chaveCarrinho, gravarRascunho, lerRascunho } from "@/lib/rascunho";
import { brl } from "@/lib/analytics";
import type { Canal, FormaPagamento } from "@/lib/types";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import { EstadoVazio, PageHeader, Selo } from "@/components/ui";
import {
  Minus,
  Plus,
  Check,
  ShoppingBag,
  Loader2,
  ChevronUp,
  ChevronDown,
  Search,
  Banknote,
  Zap,
  CreditCard,
  Landmark,
  Receipt,
  Clock,
  CheckCircle2,
  Package,
  ImageOff,
} from "lucide-react";

const FORMAS: { id: FormaPagamento; label: string; icon: typeof Banknote }[] = [
  { id: "dinheiro", label: "Dinheiro", icon: Banknote },
  { id: "pix", label: "Pix", icon: Zap },
  { id: "debito", label: "Débito", icon: Landmark },
  { id: "credito", label: "Crédito", icon: CreditCard },
  { id: "boleto", label: "Boleto", icon: Receipt },
];

export default function VenderPage() {
  return (
    <Guard>
      <Vender />
    </Guard>
  );
}

const CANAIS: { id: Canal; label: string }[] = [
  { id: "loja", label: "Loja" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
];

// chave de carrinho composta: produto + variação (vazio quando não há grade)
const keyOf = (pid: string, vid?: string | null) => `${pid}|${vid ?? ""}`;
const parseKey = (k: string) => {
  const [produtoId, vid] = k.split("|");
  return { produtoId, variacaoId: vid || null };
};

function Vender() {
  const { produtos, revendedoras, config, registrarVenda } = useStore();
  const { alerta } = useDialog();
  const orgId = useStore((s) => s.orgId);
  const usuarioId = useStore((s) => s.usuarioId);
  const chave = chaveCarrinho(orgId, usuarioId);
  // carrinho sobrevive ao refresh e ao login de novo (rascunho desta aba)
  const [cart, setCart] = useState<Record<string, number>>(() => lerRascunho<Record<string, number>>(chave) ?? {});
  useEffect(() => {
    if (Object.keys(cart).length > 0) gravarRascunho(chave, cart);
    else apagarRascunho(chave);
  }, [cart, chave]);
  const [canal, setCanal] = useState<Canal>(config.canais[0] || "whatsapp");
  const [revId, setRevId] = useState<string>("");
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [parcelas, setParcelas] = useState(1);
  const [descontoStr, setDescontoStr] = useState("");
  const [fiado, setFiado] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [busca, setBusca] = useState("");
  // celular: a barra de checkout fica recolhida (resumo + Registrar) e expande
  // para canal/pagamento/desconto; no desktop as opções ficam sempre visíveis
  const [opcoesAbertas, setOpcoesAbertas] = useState(false);

  const disponiveis = produtos.filter(
    (p) => p.ativo && p.nome.toLowerCase().includes(busca.toLowerCase())
  );

  // estoque disponível de uma linha (produto simples ou variação)
  function estoqueLinha(pid: string, vid?: string | null) {
    const prod = produtos.find((p) => p.id === pid);
    if (!prod) return 0;
    if (vid) return prod.variacoes.find((v) => v.id === vid)?.estoqueAtual ?? 0;
    return prod.estoqueAtual;
  }

  function add(pid: string, vid?: string | null) {
    const k = keyOf(pid, vid);
    setCart((c) => {
      const cur = c[k] || 0;
      if (cur >= estoqueLinha(pid, vid)) return c;
      return { ...c, [k]: cur + 1 };
    });
  }
  function sub(pid: string, vid?: string | null) {
    const k = keyOf(pid, vid);
    setCart((c) => {
      const cur = (c[k] || 0) - 1;
      const nc = { ...c };
      if (cur <= 0) delete nc[k];
      else nc[k] = cur;
      return nc;
    });
  }

  // produto que sumiu do estoque (desativado/excluído em outra aba) sai do carrinho
  const itens = Object.entries(cart)
    .map(([k, qtd]) => ({ ...parseKey(k), qtd }))
    .filter((it) => produtos.some((p) => p.id === it.produtoId && p.ativo));
  const centavos = (n: number) => Math.round(n * 100) / 100;
  const bruto = centavos(
    itens.reduce((a, it) => {
      const p = produtos.find((x) => x.id === it.produtoId)!;
      const v = it.variacaoId ? p.variacoes.find((x) => x.id === it.variacaoId) : null;
      return a + (p.precoVenda + (v ? v.precoAjuste : 0)) * it.qtd;
    }, 0)
  );
  const desconto = centavos(Math.min(Math.max(parseNumero(descontoStr) || 0, 0), bruto));
  const total = centavos(bruto - desconto);
  const rev = revendedoras.find((r) => r.id === revId);
  const comissao = rev ? centavos((total * rev.comissaoPercent) / 100) : 0;
  // canais ligados em Configurações (vazio = todos)
  const canaisLoja = CANAIS.filter((c) => config.canais.includes(c.id));
  const canaisVisiveis = canaisLoja.length > 0 ? canaisLoja : CANAIS;
  const qtdItens = itens.reduce((a, it) => a + it.qtd, 0);

  const timerSucesso = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timerSucesso.current) clearTimeout(timerSucesso.current);
  }, []);

  async function finalizar() {
    if (itens.length === 0 || registrando) return; // trava duplo clique
    setRegistrando(true);
    try {
      const { venda: v, erro } = await registrarVenda({
        itens,
        canal,
        revendedoraId: revId || null,
        formaPagamento: forma,
        parcelas: forma === "credito" ? parcelas : 1,
        desconto,
        fiado,
      });
      if (!v) {
        await alerta({
          titulo: "Não foi possível registrar a venda",
          mensagem: erro || "Verifique o estoque e tente novamente.",
        });
        return;
      }
      setSucesso(brl(v.total));
      setCart({});
      setRevId("");
      setDescontoStr("");
      setParcelas(1);
      setFiado(false);
      if (timerSucesso.current) clearTimeout(timerSucesso.current);
      timerSucesso.current = setTimeout(() => setSucesso(null), 2500);
    } finally {
      setRegistrando(false);
    }
  }

  if (produtos.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader titulo="Nova venda" />
        <div className="card p-0">
          <EstadoVazio
            icone={Package}
            titulo="Nenhum produto cadastrado"
            acao={
              <Link href="/produtos" className="btn-primary">
                Ir para o Estoque
              </Link>
            }
          >
            Cadastre um produto no Estoque antes de vender.
          </EstadoVazio>
        </div>
      </div>
    );
  }

  const formaLabel = FORMAS.find((f) => f.id === forma)?.label;

  return (
    <div className="space-y-4">
      <PageHeader titulo="Nova venda" />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-5 lg:items-start">
        {/* -------- catálogo -------- */}
        <div className="space-y-3 min-w-0">
          <div className="relative">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden />
            <input
              className="input pl-9"
              placeholder="Buscar produto…"
              aria-label="Buscar produto"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {disponiveis.length === 0 ? (
            <div className="card p-0">
              <EstadoVazio compacto icone={Search} titulo="Nenhum produto encontrado">
                {busca ? "Tente outro nome." : "Ative um produto no Estoque para vender."}
              </EstadoVazio>
            </div>
          ) : (
            <div className="card-list">
              {disponiveis.map((p) => {
                const temGrade = p.variacoes.length > 0;
                if (!temGrade) {
                  return (
                    <div key={p.id} className="row py-2.5">
                      <Miniatura url={p.imagens[0]} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{p.nome}</div>
                        <div className="text-sm flex items-center gap-2 flex-wrap">
                          <span className="tnum">{brl(p.precoVenda)}</span>
                          <Disponivel qtd={p.estoqueAtual} />
                        </div>
                      </div>
                      <Stepper
                        nome={p.nome}
                        qtd={cart[keyOf(p.id)] || 0}
                        max={p.estoqueAtual}
                        onAdd={() => add(p.id)}
                        onSub={() => sub(p.id)}
                      />
                    </div>
                  );
                }
                return (
                  <div key={p.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Miniatura url={p.imagens[0]} />
                      <div className="font-semibold truncate">{p.nome}</div>
                    </div>
                    <div className="mt-1 divide-y divide-[color:var(--border)] sm:pl-[3.25rem]">
                      {p.variacoes
                        .filter((v) => v.ativo)
                        .map((v) => (
                          <div key={v.id} className="flex items-center justify-between gap-3 py-1.5">
                            <div className="text-sm min-w-0">
                              <div className="font-medium truncate">{v.nome}</div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="tnum">{brl(p.precoVenda + v.precoAjuste)}</span>
                                <Disponivel qtd={v.estoqueAtual} />
                              </div>
                            </div>
                            <Stepper
                              nome={`${p.nome} ${v.nome}`}
                              qtd={cart[keyOf(p.id, v.id)] || 0}
                              max={v.estoqueAtual}
                              onAdd={() => add(p.id, v.id)}
                              onSub={() => sub(p.id, v.id)}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* espaço para a barra fixa não cobrir os últimos produtos */}
          {itens.length > 0 && (
            <div aria-hidden className={`${opcoesAbertas ? "h-[60vh]" : "h-28"} lg:hidden`} />
          )}
        </div>

        {/* -------- carrinho: painel lateral no desktop -------- */}
        {itens.length === 0 && (
          <aside aria-label="Resumo da venda" className="hidden lg:block lg:sticky lg:top-6">
            <div className="card p-0">
              <EstadoVazio compacto icone={ShoppingBag} titulo="Carrinho vazio">
                Adicione produtos para registrar a venda.
              </EstadoVazio>
            </div>
          </aside>
        )}

        {/* barra fixa no celular/tablet; coluna lateral no desktop */}
        {itens.length > 0 && (
          <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:bottom-6 inset-x-0 md:left-60 px-4 md:px-8 z-30 lg:px-0 lg:sticky lg:top-6 lg:bottom-auto lg:col-start-2 lg:row-start-1">
            <div className="card shadow-pop lg:shadow-none space-y-3 max-w-3xl lg:max-w-none mx-auto max-h-[70vh] lg:max-h-[calc(100vh-3rem)] overflow-auto">
              <h2 className="hidden lg:flex items-center justify-between section-title">
                Carrinho
                <span className="text-sm font-normal text-muted tnum">
                  {qtdItens} {qtdItens === 1 ? "item" : "itens"}
                </span>
              </h2>

              {/* resumo dos itens (desktop) */}
              <ul className="hidden lg:block space-y-1.5 text-sm">
                {itens.map((it) => {
                  const p = produtos.find((x) => x.id === it.produtoId)!;
                  const v = it.variacaoId ? p.variacoes.find((x) => x.id === it.variacaoId) : null;
                  return (
                    <li key={keyOf(it.produtoId, it.variacaoId)} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        <span className="text-muted tnum">{it.qtd}x</span> {p.nome}
                        {v ? ` (${v.nome})` : ""}
                      </span>
                      <span className="tnum shrink-0">{brl((p.precoVenda + (v ? v.precoAjuste : 0)) * it.qtd)}</span>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                onClick={() => setOpcoesAbertas((v) => !v)}
                aria-expanded={opcoesAbertas}
                aria-controls="vender-opcoes"
                className="lg:hidden w-full flex items-center justify-between gap-2 text-sm min-h-[44px] !-mt-1 -mb-1"
              >
                <span className="text-muted truncate">
                  {CANAIS.find((c) => c.id === canal)?.label} · {fiado ? "Fiado" : formaLabel}
                  {desconto > 0 && ` · desconto ${brl(desconto)}`}
                </span>
                <span className="shrink-0 flex items-center gap-1 font-semibold text-accent">
                  {opcoesAbertas ? "Ocultar" : "Opções"}
                  {opcoesAbertas ? <ChevronDown size={16} aria-hidden /> : <ChevronUp size={16} aria-hidden />}
                </span>
              </button>

              <div
                id="vender-opcoes"
                className={`${opcoesAbertas ? "" : "hidden"} lg:block space-y-3 lg:pt-3 lg:border-t lg:border-default`}
              >
                {/* canal */}
                <div>
                  <div className="eyebrow mb-1.5">Canal</div>
                  <div className="flex gap-2 flex-wrap" role="group" aria-label="Canal da venda">
                    {canaisVisiveis.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setCanal(c.id)}
                        aria-pressed={canal === c.id}
                        className="chip"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* forma de pagamento */}
                <div>
                  <div className="eyebrow mb-1.5">Pagamento</div>
                  <div className="flex gap-2 flex-wrap" role="group" aria-label="Forma de pagamento">
                    {FORMAS.map((f) => {
                      const Icone = f.icon;
                      return (
                        <button
                          type="button"
                          key={f.id}
                          onClick={() => setForma(f.id)}
                          aria-pressed={forma === f.id}
                          className="chip"
                        >
                          <Icone size={15} aria-hidden /> {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* parcelas (só no crédito) */}
                {forma === "credito" && (
                  <div>
                    <label className="label" htmlFor="venda-parcelas">Parcelas no cartão</label>
                    <select
                      id="venda-parcelas"
                      className="input"
                      value={parcelas}
                      onChange={(e) => setParcelas(Number(e.target.value))}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}x {n === 1 ? "(à vista)" : `de ${brl(total / n)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {config.usaRevendedoras && revendedoras.length > 0 && (
                  <select
                    className="input"
                    aria-label="Revendedora da venda"
                    value={revId}
                    onChange={(e) => setRevId(e.target.value)}
                  >
                    <option value="">Venda da loja (sem revendedora)</option>
                    {revendedoras.filter((r) => r.ativa || r.id === revId).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome} ({r.comissaoPercent.toLocaleString("pt-BR")}%)
                      </option>
                    ))}
                  </select>
                )}

                {/* desconto + fiado */}
                <div className="flex items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="label" htmlFor="venda-desconto">Desconto (R$)</label>
                    <input
                      id="venda-desconto"
                      className="input"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={descontoStr}
                      onChange={(e) => setDescontoStr(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiado((v) => !v)}
                    aria-pressed={fiado}
                    className="chip min-h-[44px]"
                  >
                    <Clock size={15} aria-hidden /> {fiado ? "Fiado (a receber)" : "Marcar fiado"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 lg:pt-3 lg:border-t lg:border-default">
                <div className="min-w-0">
                  {desconto > 0 && (
                    <div className="text-xs text-muted line-through tnum">{brl(bruto)}</div>
                  )}
                  <div className="figure">{brl(total)}</div>
                  <div className="text-xs text-muted truncate">
                    {comissao > 0 && <>comissão {brl(comissao)} · </>}
                    {fiado
                      ? "será registrada como a receber"
                      : `${formaLabel}${forma === "credito" && parcelas > 1 ? ` ${parcelas}x` : ""}`}
                  </div>
                </div>
                <button onClick={finalizar} disabled={registrando} className="btn-primary px-5 shrink-0">
                  {registrando ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Check size={18} aria-hidden />}
                  {registrando ? "Registrando…" : "Registrar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {sucesso && (
        <div
          onClick={() => setSucesso(null)}
          className="modal-backdrop fixed inset-0 z-50 grid place-items-center bg-black/55 px-5"
        >
          <div role="status" aria-live="polite" className="modal-panel surface shadow-pop rounded-2xl border border-default px-10 py-8 text-center">
            <CheckCircle2 size={44} className="text-ok mx-auto ob-anim-pop" aria-hidden />
            <div className="text-lg font-bold mt-3">Venda registrada!</div>
            <div className="figure mt-1">{sucesso}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Miniatura({ url }: { url?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />;
  }
  return (
    <span className="grid place-items-center h-10 w-10 rounded-lg surface-alt text-muted shrink-0" aria-hidden>
      <ImageOff size={16} />
    </span>
  );
}

function Disponivel({ qtd }: { qtd: number }) {
  if (qtd <= 0) return <Selo tom="bad">Sem estoque</Selo>;
  return <span className="text-xs text-muted tnum">{qtd} em estoque</span>;
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
      <button
        onClick={onAdd}
        disabled={max <= 0}
        aria-label={`Adicionar ${nome}`}
        className="btn-ghost h-11 w-11 min-h-0 p-0 shrink-0"
      >
        <Plus size={18} aria-hidden />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button onClick={onSub} aria-label={`Remover um ${nome}`} className="btn-ghost h-11 w-11 min-h-0 p-0">
        <Minus size={16} aria-hidden />
      </button>
      <span className="font-bold w-6 text-center tnum">{qtd}</span>
      <button
        onClick={onAdd}
        disabled={qtd >= max}
        aria-label={`Adicionar mais um ${nome}`}
        className="btn-primary h-11 w-11 min-h-0 p-0"
      >
        <Plus size={16} aria-hidden />
      </button>
    </div>
  );
}
