"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { aplicarCorMarca } from "@/lib/brand";
import { brl } from "@/lib/analytics";
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
  const [aba, setAba] = useState<"vender" | "vendas">("vender");
  const [catalogo, setCatalogo] = useState<Prod[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);

  async function carregar() {
    const [{ data: cat }, { data: vds }] = await Promise.all([
      sb.current.rpc("revendedora_catalogo"),
      sb.current.rpc("revendedora_minhas_vendas"),
    ]);
    setCatalogo((cat as Prod[]) || []);
    setVendas((vds as any[]) || []);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.current.auth.getUser();
      if (!user) {
        router.replace("/acesso");
        return;
      }
      const { data } = await sb.current.rpc("revendedora_me");
      if (!data) {
        router.replace("/acesso");
        return;
      }
      const m = data as Me;
      setMe(m);
      if (m.cor_marca) aplicarCorMarca(m.cor_marca);
      await carregar();
    })();
  }, [router]);

  async function sair() {
    await sb.current.auth.signOut();
    router.replace("/acesso");
  }

  if (me === undefined)
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
            <div className="font-bold leading-tight truncate">{me?.loja_nome}</div>
            <div className="text-xs text-muted truncate">
              {me?.nome} · comissão {me?.comissao_percent}%
            </div>
          </div>
          <button onClick={sair} className="text-muted" aria-label="Sair">
            <LogOut size={20} />
          </button>
        </div>
        <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-2">
          <Tab on={aba === "vender"} onClick={() => setAba("vender")} icon={<ShoppingBag size={16} />} txt="Vender" />
          <Tab on={aba === "vendas"} onClick={() => setAba("vendas")} icon={<ClipboardList size={16} />} txt="Minhas vendas" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {aba === "vender" ? (
          <Vender me={me!} catalogo={catalogo} sb={sb.current} onVendido={carregar} />
        ) : (
          <MinhasVendas vendas={vendas} />
        )}
      </main>
    </div>
  );
}

function Tab({ on, onClick, icon, txt }: { on: boolean; onClick: () => void; icon: React.ReactNode; txt: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${on ? "bg-brand-600 text-white" : "surface-alt text-muted"}`}
    >
      {icon} {txt}
    </button>
  );
}

function Vender({ me, catalogo, sb, onVendido }: { me: Me; catalogo: Prod[]; sb: ReturnType<typeof createClient>; onVendido: () => Promise<void> }) {
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [forma, setForma] = useState<Forma>("pix");
  const [parcelas, setParcelas] = useState(1);
  const [desconto, setDesconto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  function addItem(p: Prod, v: Variacao | null) {
    const variacaoId = v ? v.id : null;
    const max = v ? v.estoque_atual : p.estoque_atual;
    if (max <= 0) return;
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

  function mudarQtd(idx: number, delta: number) {
    setCarrinho((c) => {
      const cp = [...c];
      const nova = cp[idx].qtd + delta;
      if (nova <= 0) return cp.filter((_, i) => i !== idx);
      if (nova > cp[idx].max) return cp;
      cp[idx] = { ...cp[idx], qtd: nova };
      return cp;
    });
  }

  const bruto = useMemo(() => carrinho.reduce((a, i) => a + i.preco * i.qtd, 0), [carrinho]);
  const desc = Math.min(Math.max(parseFloat(desconto.replace(",", ".")) || 0, 0), bruto);
  const total = bruto - desc;
  const comissao = (total * me.comissao_percent) / 100;

  async function registrar() {
    if (carrinho.length === 0) return;
    setEnviando(true);
    setMsg(null);
    const { data, error } = await sb.rpc("revendedora_registrar_venda", {
      p_itens: carrinho.map((i) => ({ produto_id: i.produtoId, variacao_id: i.variacaoId, qtd: i.qtd })),
      p_forma: forma,
      p_parcelas: forma === "credito" ? parcelas : 1,
      p_canal: "whatsapp",
      p_desconto: desc,
    });
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
          <div className="card text-center text-muted text-sm">A loja ainda não tem produtos disponíveis.</div>
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
        <div className="card space-y-3 sticky bottom-4 shadow-xl">
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center gap-2"><ShoppingBag size={16} className="text-brand-500" /> Venda</span>
            <button onClick={() => setCarrinho([])} aria-label="Limpar venda" className="-mr-2 grid h-10 w-10 place-items-center text-muted"><X size={18} /></button>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-auto">
            {carrinho.map((i, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0 truncate">{i.nome}</div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => mudarQtd(idx, -1)} aria-label={`Diminuir quantidade de ${i.nome}`} className="h-10 w-10 rounded-full surface-alt grid place-items-center"><Minus size={16} /></button>
                  <span className="w-5 text-center">{i.qtd}</span>
                  <button onClick={() => mudarQtd(idx, 1)} aria-label={`Aumentar quantidade de ${i.nome}`} className="h-10 w-10 rounded-full surface-alt grid place-items-center disabled:opacity-40" disabled={i.qtd >= i.max}><Plus size={16} /></button>
                </div>
                <div className="w-16 text-right font-medium">{brl(i.preco * i.qtd)}</div>
              </div>
            ))}
          </div>

          {/* pagamento */}
          <div>
            <div className="label">Como foi o pagamento?</div>
            <div className="flex flex-wrap gap-2">
              {FORMAS.map((f) => (
                <button
                  key={f.id}
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
              <label className="label">Parcelas no cartão</label>
              <select className="input" value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
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
              <label className="label">Desconto (R$)</label>
              <input className="input" inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" />
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Total</div>
              <div className="text-xl font-bold">{brl(total)}</div>
              <div className="text-[11px] text-brand-500">comissão {brl(comissao)}</div>
            </div>
          </div>

          {msg && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.txt}</p>}

          <button onClick={registrar} disabled={enviando} className="btn-primary w-full disabled:opacity-60">
            {enviando ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} Registrar venda
          </button>
        </div>
      )}

      {msg?.ok && carrinho.length === 0 && <p className="text-sm text-green-600 text-center">{msg.txt}</p>}
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
                key={v.id}
                onClick={() => { onAdd(p, v); setEscolha(false); }}
                disabled={v.estoque_atual <= 0}
                className="w-full text-left text-[11px] rounded-lg surface-alt px-2 py-1 disabled:opacity-40 flex justify-between"
              >
                <span className="truncate">{v.nome}</span>
                <span className="text-muted">{v.estoque_atual > 0 ? `${v.estoque_atual} un` : "esgotado"}</span>
              </button>
            ))}
            <button onClick={() => setEscolha(false)} className="min-h-[40px] w-full rounded-lg px-3 text-sm text-muted underline">cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}

const FORMA_LABEL: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", boleto: "Boleto", credito: "Crédito", debito: "Débito" };

function MinhasVendas({ vendas }: { vendas: any[] }) {
  if (vendas.length === 0) return <div className="card text-center text-muted">Você ainda não registrou vendas.</div>;
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
              <span className="text-brand-500">
                comissão {brl(Number(v.comissao_total))} · {v.status_comissao === "paga" ? "paga" : "pendente"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function traduz(msg: string) {
  if (/sem_estoque/.test(msg)) return "Estoque insuficiente para um dos itens.";
  if (/escolha_variacao/.test(msg)) return "Escolha a variação de um dos produtos.";
  if (/sem_acesso/.test(msg)) return "Seu acesso expirou. Entre novamente.";
  if (/sem_itens|qtd_invalida/.test(msg)) return "Adicione ao menos um item.";
  if (/produto_invalido|variacao_invalida/.test(msg)) return "Um item não está mais disponível.";
  return "Não foi possível registrar a venda.";
}
