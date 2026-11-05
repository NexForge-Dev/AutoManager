"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { parseNumero } from "@/lib/csvProdutos";
import { brl, centavos, resumoContas } from "@/lib/analytics";
import { ymdSP } from "@/lib/fuso";
import type { ContaPagar } from "@/lib/types";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import Modal from "@/components/Modal";
import { Aviso, EstadoVazio, PageHeader, Painel, Progresso, Segmentado, Selo, Stat } from "@/components/ui";
import {
  Wallet,
  Plus,
  Check,
  Trash2,
  CalendarClock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Repeat,
  Scale,
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

const FILTROS = [
  ["pendentes", "Pendentes"],
  ["pagas", "Pagas"],
  ["todas", "Todas"],
] as const;

function fmtData(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function Financeiro() {
  const { contasPagar, vendas, role, marcarContaPaga, removerContaPagar } = useStore();
  const { confirm, alerta } = useDialog();
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState<"pendentes" | "pagas" | "todas">("pendentes");
  // conta com ação em andamento (marcar paga / reabrir / excluir): trava toque duplo
  const [processando, setProcessando] = useState<string | null>(null);

  const resumo = useMemo(() => resumoContas(contasPagar), [contasPagar]);
  const aReceber = useMemo(
    () =>
      centavos(
        vendas
          .filter((v) => v.statusPagamento === "pendente")
          .reduce((a, v) => a + v.total, 0)
      ),
    [vendas]
  );
  const saldoProjetado = centavos(aReceber - resumo.aPagar);

  if (role !== "owner") {
    return <div className="card text-center text-muted">O financeiro é exclusivo do dono da loja.</div>;
  }

  // "hoje" no fuso da loja, igual ao resumoContas (vencidas)
  const hoje = ymdSP(Date.now());

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
    if (!ok || processando) return;
    setProcessando(c.id);
    try {
      const res = await removerContaPagar(c.id);
      if (!res.ok) alerta({ titulo: "Não foi possível excluir a conta", mensagem: res.erro || "Tente novamente." });
    } finally {
      setProcessando(null);
    }
  }

  async function marcarPaga(c: ContaPagar, paga: boolean) {
    if (processando) return;
    setProcessando(c.id);
    try {
      const res = await marcarContaPaga(c.id, paga);
      if (!res.ok) alerta({ titulo: "Não foi possível atualizar a conta", mensagem: res.erro || "Tente novamente." });
    } finally {
      setProcessando(null);
    }
  }

  const maiorCategoria = resumo.porCategoria.reduce((m, c) => Math.max(m, c.valor), 0);

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        titulo="Financeiro"
        descricao="Contas a pagar e projeção do seu caixa (a receber − a pagar)."
        acoes={
          <button onClick={() => setAberto(true)} className="btn-primary btn-sm">
            <Plus size={17} aria-hidden /> Conta
          </button>
        }
      />

      {/* fluxo: o que entra, o que sai e o que sobra */}
      <div className="grid-kpi lg:grid-cols-3 gap-3">
        <Stat
          rotulo="A receber"
          icone={TrendingUp}
          tom="ok"
          valor={brl(aReceber)}
          apoio="vendas fiado em aberto"
        />
        <Stat
          rotulo="A pagar"
          icone={TrendingDown}
          tom="bad"
          valor={brl(resumo.aPagar)}
          apoio={`${resumo.qtdPendentes} conta(s) pendente(s)`}
        />
        <Stat
          className="col-full lg:col-span-1"
          rotulo="Saldo projetado"
          icone={Scale}
          tom={saldoProjetado >= 0 ? "ok" : "bad"}
          valorTom={saldoProjetado >= 0 ? "ok" : "bad"}
          valor={brl(saldoProjetado)}
          apoio="Se tudo a receber entrar e tudo a pagar sair."
        />
      </div>

      {resumo.vencidasQtd > 0 && (
        <Aviso
          tom="bad"
          icone={AlertTriangle}
          titulo={`${resumo.vencidasQtd} conta(s) vencida(s)`}
          acao={<span className="font-bold tnum text-bad">{brl(resumo.vencidasValor)}</span>}
        />
      )}

      <div className="grid gap-4 md:gap-5 lg:grid-cols-3 items-start">
        {/* lista */}
        <div className="lg:col-span-2 min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">Contas</h2>
            <Segmentado rotulo="Filtrar contas" opcoes={FILTROS} valor={filtro} onChange={setFiltro} />
          </div>

          {lista.length === 0 ? (
            <div className="card p-0">
              {contasPagar.length === 0 ? (
                <EstadoVazio
                  icone={Wallet}
                  titulo="Nenhuma conta cadastrada"
                  acao={
                    <button onClick={() => setAberto(true)} className="btn-primary">
                      <Plus size={17} aria-hidden /> Adicionar conta
                    </button>
                  }
                >
                  Registre fornecedores, aluguel e energia para ver o que sai do caixa.
                </EstadoVazio>
              ) : (
                <EstadoVazio compacto titulo="Nenhuma conta neste filtro." />
              )}
            </div>
          ) : (
            <div className="card-list">
              {lista.map((c) => {
                const vencida = c.status === "pendente" && c.vencimento < hoje;
                const ocupada = processando === c.id;
                return (
                  <div key={c.id} className="px-4 py-3 sm:flex sm:items-center sm:gap-4">
                    <div className="flex items-start justify-between gap-3 min-w-0 flex-1">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{c.descricao}</div>
                        <div className="text-xs text-muted flex items-center gap-x-2 gap-y-1 mt-1 flex-wrap">
                          {vencida ? (
                            <Selo tom="bad" icone={CalendarClock}>
                              Venceu {fmtData(c.vencimento)}
                            </Selo>
                          ) : (
                            <span className="inline-flex items-center gap-1 tnum">
                              <CalendarClock size={12} aria-hidden /> {fmtData(c.vencimento)}
                            </span>
                          )}
                          {c.categoria && <span>{c.categoria}</span>}
                          {c.fornecedor && <span>· {c.fornecedor}</span>}
                          {c.recorrente && (
                            <Selo tom="brand" icone={Repeat}>
                              fixa
                            </Selo>
                          )}
                          {c.status === "paga" && <Selo tom="ok">paga</Selo>}
                        </div>
                      </div>
                      <div
                        className={`font-bold tnum shrink-0 ${c.status === "paga" ? "text-muted line-through" : ""}`}
                      >
                        {brl(c.valor)}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2.5 sm:mt-0 shrink-0">
                      {c.status === "pendente" ? (
                        <button
                          type="button"
                          onClick={() => marcarPaga(c, true)}
                          disabled={ocupada}
                          className="btn-ghost btn-sm flex-1"
                        >
                          <Check size={15} aria-hidden /> {ocupada ? "Salvando…" : "Marcar paga"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => marcarPaga(c, false)}
                          disabled={ocupada}
                          className="btn-ghost btn-sm flex-1"
                        >
                          <RotateCcw size={15} aria-hidden /> {ocupada ? "Salvando…" : "Reabrir"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remover(c)}
                        disabled={ocupada}
                        className="icon-btn hover:!text-bad"
                        aria-label={`Excluir conta ${c.descricao}`}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* por categoria */}
        {resumo.porCategoria.length > 0 && (
          <Painel titulo="A pagar por categoria">
            <div className="space-y-3">
              {resumo.porCategoria.map((c) => (
                <div key={c.categoria}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted truncate">{c.categoria}</span>
                    <span className="font-semibold tnum shrink-0">{brl(c.valor)}</span>
                  </div>
                  <Progresso className="mt-1" pct={maiorCategoria ? (c.valor / maiorCategoria) * 100 : 0} />
                </div>
              ))}
            </div>
          </Painel>
        )}
      </div>

      {aberto && <ContaForm onClose={() => setAberto(false)} />}
    </div>
  );
}

function ContaForm({ onClose }: { onClose: () => void }) {
  const { addContaPagar } = useStore();
  const { alerta } = useDialog();
  const hoje = ymdSP(Date.now()); // fuso da loja

  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(hoje);
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [fornecedor, setFornecedor] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    const res = await addContaPagar({
      descricao,
      valor: parseNumero(valor),
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
    <Modal onClose={onClose} titulo="Nova conta a pagar">
        <div>
          <label className="label" htmlFor="conta-descricao">Descrição</label>
          <input
            id="conta-descricao"
            className="input"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Compra de mercadoria"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="conta-valor">Valor (R$)</label>
            <input
              id="conta-valor"
              className="input"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="label" htmlFor="conta-vencimento">Vencimento</label>
            <input id="conta-vencimento" type="date" className="input" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="conta-categoria">Categoria</label>
            <select id="conta-categoria" className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="conta-fornecedor">Fornecedor (opcional)</label>
            <input id="conta-fornecedor" className="input" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm min-h-[44px]">
          <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
          <Repeat size={14} className="text-muted" aria-hidden /> Marcar como despesa fixa
        </label>
        <p className="hint !-mt-2">
          Só identifica a conta como fixa (aluguel, internet…). O próximo mês não é lançado automaticamente.
        </p>
        <div>
          <label className="label" htmlFor="conta-obs">Observação (opcional)</label>
          <textarea id="conta-obs" className="input" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
        <button onClick={salvar} disabled={salvando} className="btn-primary w-full">
          {salvando ? "Salvando…" : "Salvar conta"}
        </button>
    </Modal>
  );
}
