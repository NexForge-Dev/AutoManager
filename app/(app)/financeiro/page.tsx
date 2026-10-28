"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { brl, resumoContas } from "@/lib/analytics";
import type { ContaPagar } from "@/lib/types";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import {
  Wallet,
  Plus,
  X,
  Check,
  Trash2,
  CalendarClock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Repeat,
} from "lucide-react";

export default function FinanceiroPage() {
  return (
    <Guard>
      <Financeiro />
    </Guard>
  );
}

const CATEGORIAS = [
  "Fornecedor",
  "Aluguel",
  "Energia",
  "Água",
  "Internet",
  "Impostos",
  "Salários",
  "Marketing",
  "Outros",
];

function fmtData(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function Financeiro() {
  const { contasPagar, vendas, role, marcarContaPaga, removerContaPagar } = useStore();
  const { confirm, alerta } = useDialog();
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState<"pendentes" | "pagas" | "todas">("pendentes");

  const resumo = useMemo(() => resumoContas(contasPagar), [contasPagar]);
  const aReceber = useMemo(
    () =>
      vendas
        .filter((v) => v.statusPagamento === "pendente")
        .reduce((a, v) => a + v.total, 0),
    [vendas]
  );
  const saldoProjetado = aReceber - resumo.aPagar;

  if (role !== "owner") {
    return <div className="card text-center text-muted">O financeiro é exclusivo do dono da loja.</div>;
  }

  const hoje = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  const lista = contasPagar
    .filter((c) =>
      filtro === "todas" ? true : filtro === "pendentes" ? c.status === "pendente" : c.status === "paga"
    )
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  async function remover(c: ContaPagar) {
    const ok = await confirm({
      titulo: "Excluir conta?",
      mensagem: `"${c.descricao}" (${brl(c.valor)}) será removida.`,
      confirmar: "Excluir",
      perigo: true,
    });
    if (ok) removerContaPagar(c.id);
  }

  async function marcarPaga(c: ContaPagar, paga: boolean) {
    const res = await marcarContaPaga(c.id, paga);
    if (!res.ok) alerta({ titulo: "Não foi possível atualizar a conta", mensagem: res.erro || "Tente novamente." });
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Wallet className="text-brand-600" />
          <h1 className="text-2xl font-bold">Financeiro</h1>
        </div>
        <button onClick={() => setAberto(true)} className="btn-primary py-2 px-3 text-sm">
          <Plus size={18} /> Conta
        </button>
      </header>

      <p className="text-sm text-muted">Contas a pagar e projeção do seu caixa (a receber − a pagar).</p>

      {/* cards de fluxo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <TrendingUp size={14} className="text-green-500" /> A receber
          </div>
          <div className="text-xl font-bold mt-1 text-green-500">{brl(aReceber)}</div>
          <div className="text-[11px] text-muted">vendas fiado em aberto</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <TrendingDown size={14} className="text-red-500" /> A pagar
          </div>
          <div className="text-xl font-bold mt-1 text-red-500">{brl(resumo.aPagar)}</div>
          <div className="text-[11px] text-muted">{resumo.qtdPendentes} conta(s) pendente(s)</div>
        </div>
      </div>

      <div className="card">
        <div className="text-xs text-muted">Saldo projetado</div>
        <div className={`text-2xl font-bold ${saldoProjetado >= 0 ? "text-green-500" : "text-red-500"}`}>
          {brl(saldoProjetado)}
        </div>
        <div className="text-[11px] text-muted mt-0.5">Se tudo a receber entrar e tudo a pagar sair.</div>
      </div>

      {resumo.vencidasQtd > 0 && (
        <div className="card flex items-center justify-between bg-red-500/5 border-red-500/30">
          <span className="text-sm flex items-center gap-1.5 text-red-600">
            <AlertTriangle size={15} /> {resumo.vencidasQtd} conta(s) vencida(s)
          </span>
          <span className="font-bold text-red-600">{brl(resumo.vencidasValor)}</span>
        </div>
      )}

      {/* por categoria */}
      {resumo.porCategoria.length > 0 && (
        <div className="card space-y-2">
          <div className="font-semibold text-sm">A pagar por categoria</div>
          {resumo.porCategoria.map((c) => (
            <div key={c.categoria} className="flex items-center justify-between text-sm">
              <span className="text-muted">{c.categoria}</span>
              <span className="font-semibold">{brl(c.valor)}</span>
            </div>
          ))}
        </div>
      )}

      {/* filtro */}
      <div className="flex gap-2">
        {(["pendentes", "pagas", "todas"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`chip ${filtro === f ? "bg-brand-600 text-white border-brand-600" : "border-default"}`}
          >
            {f === "pendentes" ? "Pendentes" : f === "pagas" ? "Pagas" : "Todas"}
          </button>
        ))}
      </div>

      {/* lista */}
      {lista.length === 0 ? (
        <div className="card text-center text-muted py-8">
          {contasPagar.length === 0
            ? "Nenhuma conta cadastrada. Toque em + Conta para começar."
            : "Nenhuma conta neste filtro."}
        </div>
      ) : (
        <div className="space-y-2 stagger">
          {lista.map((c) => {
            const vencida = c.status === "pendente" && c.vencimento < hoje;
            return (
              <div key={c.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {c.descricao}
                      {c.recorrente && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-brand-500">
                          <Repeat size={11} /> fixa
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted flex items-center gap-2 mt-0.5 flex-wrap">
                      {c.categoria && <span>{c.categoria}</span>}
                      {c.fornecedor && <span>· {c.fornecedor}</span>}
                      <span className={`inline-flex items-center gap-1 ${vencida ? "text-red-500 font-semibold" : ""}`}>
                        <CalendarClock size={11} /> {fmtData(c.vencimento)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-bold ${c.status === "paga" ? "text-muted line-through" : ""}`}>
                      {brl(c.valor)}
                    </div>
                    {c.status === "paga" && <div className="text-[11px] text-green-500">paga</div>}
                  </div>
                </div>

                <div className="flex gap-2">
                  {c.status === "pendente" ? (
                    <button
                      onClick={() => marcarPaga(c, true)}
                      className="btn-primary flex-1 py-1.5 text-sm"
                    >
                      <Check size={15} /> Marcar paga
                    </button>
                  ) : (
                    <button
                      onClick={() => marcarPaga(c, false)}
                      className="btn-ghost flex-1 py-1.5 text-sm"
                    >
                      <RotateCcw size={15} /> Reabrir
                    </button>
                  )}
                  <button
                    onClick={() => remover(c)}
                    className="btn-ghost py-1.5 px-3 text-sm text-red-500"
                    aria-label="Excluir conta"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {aberto && <ContaForm onClose={() => setAberto(false)} />}
    </div>
  );
}

function ContaForm({ onClose }: { onClose: () => void }) {
  const { addContaPagar } = useStore();
  const { alerta } = useDialog();
  const hoje = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(hoje);
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [fornecedor, setFornecedor] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const res = await addContaPagar({
      descricao,
      valor: parseFloat(valor.replace(",", ".")),
      vencimento,
      categoria,
      fornecedor,
      recorrente,
      observacao,
    });
    setSalvando(false);
    if (!res.ok) {
      alerta({ titulo: "Não foi possível salvar", mensagem: res.erro || "Revise os campos." });
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-end md:items-center justify-center">
      <div className="surface w-full max-w-md rounded-t-3xl md:rounded-3xl p-5 space-y-3 max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Nova conta a pagar</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <div>
          <label className="label">Descrição</label>
          <input
            className="input"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Compra de mercadoria"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Valor (R$)</label>
            <input
              className="input"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="label">Vencimento</label>
            <input type="date" className="input" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Fornecedor (opcional)</label>
            <input className="input" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
          <Repeat size={14} className="text-brand-500" /> Despesa fixa (recorrente)
        </label>
        <div>
          <label className="label">Observação (opcional)</label>
          <textarea className="input" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
        <button onClick={salvar} disabled={salvando} className="btn-primary w-full disabled:opacity-60">
          {salvando ? "Salvando…" : "Salvar conta"}
        </button>
      </div>
    </div>
  );
}
