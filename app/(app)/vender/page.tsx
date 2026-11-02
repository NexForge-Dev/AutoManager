"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { parseNumero } from "@/lib/csvProdutos";
import { brl } from "@/lib/analytics";
import type { Canal, FormaPagamento } from "@/lib/types";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import { Minus, Plus, Check, ShoppingBag, Loader2, ChevronUp, ChevronDown } from "lucide-react";

const FORMAS: { id: FormaPagamento; label: string }[] = [
  { id: "dinheiro", label: "💵 Dinheiro" },
  { id: "pix", label: "⚡ Pix" },
  { id: "debito", label: "🏧 Débito" },
  { id: "credito", label: "💳 Crédito" },
  { id: "boleto", label: "🧾 Boleto" },
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
  const [cart, setCart] = useState<Record<string, number>>({});
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
      <div className="card text-center text-muted mt-6">
        Cadastre um produto no <b>Estoque</b> antes de vender.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center gap-2 pt-1">
        <ShoppingBag className="text-brand-600" />
        <h1 className="text-2xl font-bold">Nova venda</h1>
      </header>

      <input
        className="input"
        placeholder="Buscar produto…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <div className="space-y-2">
        {disponiveis.map((p) => {
          const temGrade = p.variacoes.length > 0;
          if (!temGrade) {
            return (
              <div key={p.id} className="card flex items-center justify-between py-3">
                <div>
                  <div className="font-semibold">{p.nome}</div>
                  <div className="text-xs text-muted">
                    {brl(p.precoVenda)} · {p.estoqueAtual} em estoque
                  </div>
                </div>
                <Stepper
                  qtd={cart[keyOf(p.id)] || 0}
                  max={p.estoqueAtual}
                  onAdd={() => add(p.id)}
                  onSub={() => sub(p.id)}
                />
              </div>
            );
          }
          return (
            <div key={p.id} className="card py-3 space-y-2">
              <div className="font-semibold">{p.nome}</div>
              <div className="divide-y divide-[color:var(--border)]">
                {p.variacoes
                  .filter((v) => v.ativo)
                  .map((v) => (
                    <div key={v.id} className="flex items-center justify-between py-1.5">
                      <div className="text-sm">
                        <span className="font-medium">{v.nome}</span>
                        <div className="text-xs text-muted">
                          {brl(p.precoVenda + v.precoAjuste)} · {v.estoqueAtual} em estoque
                        </div>
                      </div>
                      <Stepper
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

      {/* espaço para a barra fixa não cobrir os últimos produtos */}
      {itens.length > 0 && (
        <div aria-hidden className={`${opcoesAbertas ? "h-[60vh]" : "h-32"} md:h-[55vh]`} />
      )}

      {/* barra fixa de checkout */}
      {itens.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 inset-x-0 md:left-60 px-4 z-30">
          <div className="card shadow-lg space-y-3 max-w-3xl mx-auto max-h-[70vh] overflow-auto">
            <button
              type="button"
              onClick={() => setOpcoesAbertas((v) => !v)}
              aria-expanded={opcoesAbertas}
              aria-controls="vender-opcoes"
              className="md:hidden w-full flex items-center justify-between gap-2 text-sm min-h-[44px] -my-1"
            >
              <span className="text-muted truncate">
                {CANAIS.find((c) => c.id === canal)?.label} ·{" "}
                {fiado ? "Fiado" : FORMAS.find((f) => f.id === forma)?.label}
                {desconto > 0 && ` · desconto ${brl(desconto)}`}
              </span>
              <span className="shrink-0 flex items-center gap-1 font-semibold text-brand-500">
                {opcoesAbertas ? "Ocultar" : "Opções"}
                {opcoesAbertas ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </span>
            </button>

            <div id="vender-opcoes" className={`${opcoesAbertas ? "" : "hidden"} md:block space-y-3`}>
            {/* canal */}
            <div className="flex gap-2 flex-wrap" role="group" aria-label="Canal da venda">
              {canaisVisiveis.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCanal(c.id)}
                  aria-pressed={canal === c.id}
                  className={`chip min-h-[36px] ${
                    canal === c.id
                      ? "bg-brand-600 text-white border-brand-600"
                      : "border-default"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* forma de pagamento */}
            <div className="flex gap-2 flex-wrap" role="group" aria-label="Forma de pagamento">
              {FORMAS.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => setForma(f.id)}
                  aria-pressed={forma === f.id}
                  className={`chip min-h-[36px] ${
                    forma === f.id
                      ? "bg-brand-600 text-white border-brand-600"
                      : "border-default"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* parcelas (só no crédito) */}
            {forma === "credito" && (
              <div>
                <label className="label" htmlFor="venda-parcelas">Parcelas no cartão</label>
                <select
                  id="venda-parcelas"
                  className="input py-2"
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
                    {r.nome} ({r.comissaoPercent}%)
                  </option>
                ))}
              </select>
            )}

            {/* desconto + fiado */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="label" htmlFor="venda-desconto">Desconto (R$)</label>
                <input
                  id="venda-desconto"
                  className="input py-2"
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
                className={`chip mt-5 ${
                  fiado ? "bg-amber-500 text-white border-amber-500" : "border-default"
                }`}
              >
                {fiado ? "🕒 Fiado (a receber)" : "Marcar fiado"}
              </button>
            </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                {desconto > 0 && (
                  <div className="text-xs text-muted line-through">{brl(bruto)}</div>
                )}
                <div className="text-xl font-bold">{brl(total)}</div>
                <div className="text-xs text-muted">
                  {comissao > 0 && <>comissão {brl(comissao)} · </>}
                  {fiado
                    ? "será registrada como a receber"
                    : `${FORMAS.find((f) => f.id === forma)?.label}${
                        forma === "credito" && parcelas > 1 ? ` ${parcelas}x` : ""
                      }`}
                </div>
              </div>
              <button onClick={finalizar} disabled={registrando} className="btn-primary px-6 disabled:opacity-70">
                {registrando ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                {registrando ? "Registrando…" : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sucesso && (
        <div
          onClick={() => setSucesso(null)}
          className="modal-backdrop fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm px-5"
        >
          <div role="status" aria-live="polite" className="modal-panel surface shadow-pop rounded-3xl p-8 text-center space-y-2">
            <div className="text-5xl ob-anim-pop">🎉</div>
            <div className="text-xl font-bold">Venda registrada!</div>
            <div className="text-brand-600 font-semibold text-lg">{sucesso}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({
  qtd,
  max,
  onAdd,
  onSub,
}: {
  qtd: number;
  max: number;
  onAdd: () => void;
  onSub: () => void;
}) {
  if (qtd === 0) {
    return (
      <button onClick={onAdd} disabled={max <= 0} aria-label="Adicionar" className="btn-ghost py-2 px-3 min-h-[44px] min-w-[44px] disabled:opacity-40">
        <Plus size={18} />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <button onClick={onSub} aria-label="Remover um" className="btn-ghost py-2 px-2 min-h-[44px] min-w-[44px]">
        <Minus size={16} />
      </button>
      <span className="font-bold w-5 text-center">{qtd}</span>
      <button onClick={onAdd} disabled={qtd >= max} aria-label="Adicionar mais um" className="btn-primary py-2 px-2 min-h-[44px] min-w-[44px] disabled:opacity-40">
        <Plus size={16} />
      </button>
    </div>
  );
}
