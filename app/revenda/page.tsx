"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { situacaoRevendedora } from "@/lib/destinoPosLogin";
import { aplicarCorMarca } from "@/lib/brand";
import { brl } from "@/lib/analytics";
import { parseNumero } from "@/lib/csvProdutos";
import type { Canal } from "@/lib/types";
import { Gem, Loader2, Plus, Minus, ShoppingBag, LogOut, ClipboardList, Check, X } from "lucide-react";

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
        const { data: { user } } = await sb.current.auth.getUser();
        if (!user) {
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
    try {
      await sb.current.auth.signOut();
    } catch {
      // sem rede: o signOut local já apagou a sessão do navegador
    }
    router.replace("/acesso");
  }

  if (falha && me === undefined)
    return (
      <div className="min-h-screen grid place-items-center text-center px-6">
        <div>
          <h1 className="text-xl font-bold">Não foi possível carregar</h1>
          <p className="text-muted mt-1">Confira sua conexão com a internet e tente de novo.</p>
          <button onClick={() => setTentativa((t) => t + 1)} className="btn-primary mt-6 inline-flex">
            Tentar de novo
          </button>
        </div>
      </div>
    );

  if (!me)
    return (
      <div className="min-h-screen grid place-items-center text-brand-500">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-28">
      <header className="surface border-b border-default sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {me?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.logo_url} alt={me.loja_nome} className="h-10 w-10 rounded-xl object-cover border border-default" />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-brand-600 grid place-items-center text-white">
              <Gem size={18} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-bold leading-tight truncate text-base">{me?.loja_nome}</h1>
            <div className="text-xs text-muted truncate">
              {me?.nome} · comissão {me?.comissao_percent}%
            </div>
          </div>
          <button
            type="button"
            onClick={sair}
            className="grid place-items-center h-11 w-11 -mr-2 rounded-full text-muted hover:bg-[var(--hover)] hover:text-strong"
            aria-label="Sair da conta"
          >
            <LogOut size={20} />
          </button>
        </div>
        <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-2">
          <Tab on={aba === "vender"} onClick={() => setAba("vender")} icon={<ShoppingBag size={16} />} txt="Vender" />
          <Tab on={aba === "vendas"} onClick={() => setAba("vendas")} icon={<ClipboardList size={16} />} txt="Minhas vendas" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {erroDados && (
          <div className="card mb-4 flex items-center justify-between gap-3 text-sm" role="alert">
            <span className="text-red-600">Não foi possível carregar o catálogo e as vendas.</span>
            <button
              type="button"
              onClick={recarregar}
              disabled={recarregando}
              className="btn-primary shrink-0 px-3 py-1.5 text-xs disabled:opacity-60"
            >
              {recarregando ? <Loader2 className="animate-spin" size={14} /> : "Tentar de novo"}
            </button>
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

function Tab({ on, onClick, icon, txt }: { on: boolean; onClick: () => void; icon: React.ReactNode; txt: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${on ? "bg-brand-600 text-white" : "surface-alt text-muted"}`}
    >
      {icon} {txt}
    </button>
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

  return (
    <div className="space-y-4">
      {/* catálogo */}
      <div>
        <div className="text-sm font-semibold mb-2">Catálogo</div>
        {catalogo.length === 0 ? (
          erroDados ? null : (
            <div className="card text-center text-muted text-sm">A loja ainda não tem produtos disponíveis.</div>
          )
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {catalogo.map((p) => (
              <ProdutoCard key={p.id} p={p} onAdd={addItem} />
            ))}
          </div>
        )}
      </div>

      {/* carrinho fixo */}
      {carrinho.length > 0 && (
        <div className="card space-y-3 sticky bottom-4 shadow-xl max-h-[75dvh] overflow-auto">
          <button
            type="button"
            onClick={() => setCarrinhoAberto((v) => !v)}
            aria-expanded={carrinhoAberto}
            aria-controls="rev-carrinho"
            className="md:hidden w-full flex items-center justify-between gap-2 min-h-[44px] -my-1 text-sm"
          >
            <span className="flex items-center gap-2 font-semibold">
              <ShoppingBag size={16} className="text-brand-500" />
              {carrinho.reduce((a, i) => a + i.qtd, 0)} item(ns) · {brl(total)}
            </span>
            <span className="font-semibold text-brand-500">{carrinhoAberto ? "Ocultar" : "Ver venda"}</span>
          </button>
          <div id="rev-carrinho" className={`${carrinhoAberto ? "" : "hidden"} md:block space-y-3`}>
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center gap-2"><ShoppingBag size={16} className="text-brand-500" /> Venda</span>
            <button onClick={() => setCarrinho([])} aria-label="Limpar venda" className="-mr-2 grid h-11 w-11 place-items-center text-muted"><X size={18} /></button>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-auto">
            {carrinho.map((i) => {
              const chave = chaveItem(i.produtoId, i.variacaoId);
              return (
              <div key={chave} className="flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0 truncate">{i.nome}</div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => mudarQtd(chave, -1)} aria-label={`Diminuir quantidade de ${i.nome}`} className="h-11 w-11 rounded-full surface-alt grid place-items-center"><Minus size={16} /></button>
                  <span className="w-5 text-center">{i.qtd}</span>
                  <button type="button" onClick={() => mudarQtd(chave, 1)} aria-label={`Aumentar quantidade de ${i.nome}`} className="h-11 w-11 rounded-full surface-alt grid place-items-center disabled:opacity-40" disabled={i.qtd >= i.max}><Plus size={16} /></button>
                </div>
                <div className="w-20 shrink-0 text-right font-medium">{brl(i.preco * i.qtd)}</div>
              </div>
              );
            })}
          </div>

          {/* canal */}
          <div>
            <div className="label" id="rev-canal">Onde foi a venda?</div>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="rev-canal">
              {CANAIS.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  aria-pressed={canal === c.id}
                  onClick={() => setCanal(c.id)}
                  className={`chip ${canal === c.id ? "bg-brand-600 text-white border-brand-600" : "border-default"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* pagamento */}
          <div>
            <div className="label" id="rev-forma">Como foi o pagamento?</div>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="rev-forma">
              {FORMAS.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  aria-pressed={forma === f.id}
                  onClick={() => setForma(f.id)}
                  className={`chip ${forma === f.id ? "bg-brand-600 text-white border-brand-600" : "border-default"}`}
                >
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

          <div className="grid grid-cols-2 gap-2 items-end">
            <div>
              <label htmlFor="rev-desconto" className="label">Desconto (R$)</label>
              <input id="rev-desconto" className="input" inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" />
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Total</div>
              <div className="text-xl font-bold">{brl(total)}</div>
              <div className="text-[11px] text-brand-500">comissão {brl(comissao)}</div>
            </div>
          </div>

          </div>
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>
              {msg.txt}
            </p>
          )}

          <button type="button" onClick={registrar} disabled={enviando || carrinho.length === 0} className="btn-primary w-full disabled:opacity-60">
            {enviando ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} {enviando ? "Registrando…" : "Registrar venda"}
          </button>
        </div>
      )}

      {msg?.ok && carrinho.length === 0 && (
        <p role="status" className="text-sm text-green-600 text-center">{msg.txt}</p>
      )}
    </div>
  );
}

function ProdutoCard({ p, onAdd }: { p: Prod; onAdd: (p: Prod, v: Variacao | null) => void }) {
  const [escolha, setEscolha] = useState(false);
  const esgotado = p.estoque_atual <= 0;
  const temGrade = p.variacoes.length > 0;
  return (
    <div className="surface rounded-2xl border border-default overflow-hidden flex flex-col">
      <div className="aspect-square surface-alt relative">
        {p.imagens[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imagens[0]} alt={p.nome} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center text-muted"><Gem size={24} /></div>
        )}
        <span className={`absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${esgotado ? "bg-red-500 text-white" : "bg-black/55 text-white"}`}>
          {esgotado ? "Esgotado" : `${p.estoque_atual} un`}
        </span>
      </div>
      <div className="p-2.5 flex-1 flex flex-col">
        <div className="text-xs font-semibold leading-tight line-clamp-2">{p.nome}</div>
        <div className="font-bold text-brand-500 text-sm mt-0.5">{brl(p.preco_venda)}</div>

        {!escolha ? (
          <button
            type="button"
            onClick={() => (temGrade ? setEscolha(true) : onAdd(p, null))}
            disabled={esgotado}
            className="btn-primary mt-2 py-1.5 text-xs disabled:opacity-50"
          >
            <Plus size={14} /> {temGrade ? "Escolher" : "Adicionar"}
          </button>
        ) : (
          <div className="mt-2 space-y-1">
            {p.variacoes.map((v) => (
              <button
                type="button"
                key={v.id}
                onClick={() => { onAdd(p, v); setEscolha(false); }}
                disabled={v.estoque_atual <= 0}
                className="w-full text-left text-[11px] rounded-lg surface-alt px-2 py-1 disabled:opacity-40 flex justify-between gap-1"
              >
                <span className="min-w-0">
                  <span className="block truncate">{v.nome}</span>
                  <span className="block font-semibold text-brand-500">{brl(p.preco_venda + Number(v.preco_ajuste || 0))}</span>
                </span>
                <span className="shrink-0 text-muted">{v.estoque_atual > 0 ? `${v.estoque_atual} un` : "esgotado"}</span>
              </button>
            ))}
            <button type="button" onClick={() => setEscolha(false)} className="min-h-[40px] w-full rounded-lg px-3 text-sm text-muted underline">cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}

const FORMA_LABEL: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", boleto: "Boleto", credito: "Crédito", debito: "Débito" };

const STATUS_COMISSAO: Record<string, string> = { paga: "paga", pendente: "pendente", cancelada: "cancelada" };

function MinhasVendas({ vendas, erroDados }: { vendas: any[]; erroDados: boolean }) {
  if (vendas.length === 0)
    return erroDados ? null : <div className="card text-center text-muted">Você ainda não registrou vendas.</div>;
  return (
    <div className="space-y-2">
      {vendas.map((v) => {
        const d = new Date(v.data);
        const itens = (v.itens || []).map((i: any) => `${i.qtd}× ${i.nome}${i.variacao_nome ? ` (${i.variacao_nome})` : ""}`).join(", ");
        const pag = FORMA_LABEL[v.forma_pagamento] || v.forma_pagamento;
        return (
          <div key={v.id} className="card space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{brl(Number(v.total))}</span>
              <span className="text-xs text-muted">{d.toLocaleDateString("pt-BR")} {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="text-xs text-muted">{itens}</div>
            <div className="flex items-center justify-between text-xs">
              <span className="chip border-default">{pag}{v.forma_pagamento === "credito" && Number(v.parcelas) > 1 ? ` ${v.parcelas}x` : ""}</span>
              <span className={v.status_comissao === "cancelada" ? "text-muted line-through" : "text-brand-500"}>
                comissão {brl(Number(v.comissao_total))} · {STATUS_COMISSAO[v.status_comissao] ?? "pendente"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
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
