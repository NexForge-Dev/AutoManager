"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { calcularRelatorio, rankingRevendedoras, brl } from "@/lib/analytics";
import { baixarCSV, dataHora } from "@/lib/export";
import Guard from "@/components/Guard";
import CountUp from "@/components/CountUp";
import { useDialog } from "@/components/Dialog";
import type { Venda } from "@/lib/types";
const VendasArea = dynamic(() => import("@/components/charts/VendasArea"), {
  ssr: false,
  loading: () => <div style={{ height: 150 }} className="skeleton rounded-xl" />,
});
import {
  FileSpreadsheet,
  Printer,
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  Trophy,
  Receipt,
  XCircle,
  Check,
} from "lucide-react";

export default function RelatoriosPage() {
  return (
    <Guard>
      <Relatorios />
    </Guard>
  );
}

type Preset = "hoje" | "7dias" | "mes" | "ano" | "custom";

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Relatorios() {
  const { vendas, revendedoras, config, role, cancelarVenda, marcarVendaRecebida } = useStore();
  const { confirm, alerta } = useDialog();
  const [preset, setPreset] = useState<Preset>("mes");
  const [mostrarVendas, setMostrarVendas] = useState(20);
  const [processando, setProcessando] = useState<string | null>(null);
  const ehDono = role === "owner";

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [de, setDe] = useState(ymd(inicioMes));
  const [ate, setAte] = useState(ymd(hoje));

  const { deMs, ateMs, label } = useMemo(() => {
    const now = new Date();
    const sod = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x.getTime();
    };
    const eod = (d: Date) => {
      const x = new Date(d);
      x.setHours(23, 59, 59, 999);
      return x.getTime();
    };
    if (preset === "hoje") return { deMs: sod(now), ateMs: eod(now), label: "Hoje" };
    if (preset === "7dias") {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { deMs: sod(d), ateMs: eod(now), label: "Últimos 7 dias" };
    }
    if (preset === "mes") {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { deMs: sod(d), ateMs: eod(now), label: "Este mês" };
    }
    if (preset === "ano") {
      const d = new Date(now.getFullYear(), 0, 1);
      return { deMs: sod(d), ateMs: eod(now), label: "Este ano" };
    }
    return {
      deMs: sod(new Date(de + "T00:00:00")),
      ateMs: eod(new Date(ate + "T00:00:00")),
      label: `${de} a ${ate}`,
    };
  }, [preset, de, ate]);

  const r = useMemo(() => calcularRelatorio(vendas, deMs, ateMs), [vendas, deMs, ateMs]);
  const ranking = useMemo(
    () => rankingRevendedoras(vendas.filter((v) => v.data >= deMs && v.data <= ateMs), revendedoras),
    [vendas, revendedoras, deMs, ateMs]
  );

  // resumo de parcelamento (crédito) no período
  const parcelado = useMemo(() => {
    const parceladas = vendas.filter(
      (v) => v.data >= deMs && v.data <= ateMs && v.statusPagamento !== "cancelada" && v.parcelas > 1
    );
    return {
      qtd: parceladas.length,
      total: parceladas.reduce((a, v) => a + v.total, 0),
      maxParcelas: parceladas.reduce((m, v) => Math.max(m, v.parcelas), 0),
    };
  }, [vendas, deMs, ateMs]);

  // lista de vendas do período (mais recentes primeiro), com ações do dono
  const vendasPeriodo = useMemo(
    () => vendas.filter((v) => v.data >= deMs && v.data <= ateMs).sort((a, b) => b.data - a.data),
    [vendas, deMs, ateMs]
  );

  async function cancelar(v: Venda) {
    const itens = v.itens.map((i) => `${i.qtd}x ${i.nome}`).join(", ");
    const ok = await confirm({
      titulo: "Cancelar venda?",
      mensagem:
        `Venda de ${brl(v.total)}${itens ? ` (${itens})` : ""}. ` +
        "O estoque volta para o produto e a comissão pendente é anulada. Não dá para desfazer.",
      confirmar: "Cancelar venda",
      cancelar: "Voltar",
      perigo: true,
    });
    if (!ok) return;
    setProcessando(v.id);
    const res = await cancelarVenda(v.id);
    setProcessando(null);
    if (!res.ok) alerta({ titulo: "Não foi possível cancelar", mensagem: res.erro || "Tente novamente." });
  }

  async function receber(v: Venda) {
    const ok = await confirm({
      titulo: "Marcar como recebida?",
      mensagem: `Confirma que ${brl(v.total)} desta venda fiado já entrou no caixa?`,
      confirmar: "Recebida",
    });
    if (!ok) return;
    setProcessando(v.id);
    const res = await marcarVendaRecebida(v.id);
    setProcessando(null);
    if (!res.ok) alerta({ titulo: "Não foi possível atualizar", mensagem: res.erro || "Tente novamente." });
  }

  function exportarExcel() {
    const noPeriodo = vendas
      .filter((v) => v.data >= deMs && v.data <= ateMs)
      .sort((a, b) => a.data - b.data);
    const nome = (id: string | null) =>
      id ? revendedoras.find((x) => x.id === id)?.nome ?? "-" : "Loja";
    const formaLabel: Record<string, string> = {
      dinheiro: "Dinheiro",
      pix: "Pix",
      credito: "Crédito",
      debito: "Débito",
      boleto: "Boleto",
    };
    const statusLabel: Record<string, string> = {
      paga: "Paga",
      pendente: "A receber",
      cancelada: "Cancelada",
    };
    const linhas = noPeriodo.map((v) => {
      const { data, hora } = dataHora(v.data);
      const itens = v.itens.map((i) => `${i.qtd}x ${i.nome}`).join(" | ");
      const bruto = v.total + (v.desconto || 0);
      return [
        data,
        hora,
        v.canal,
        formaLabel[v.formaPagamento] || v.formaPagamento,
        v.parcelas > 1 ? `${v.parcelas}x` : "À vista",
        statusLabel[v.statusPagamento] || v.statusPagamento,
        nome(v.revendedoraId),
        itens,
        bruto.toFixed(2).replace(".", ","),
        (v.desconto || 0).toFixed(2).replace(".", ","),
        v.total.toFixed(2).replace(".", ","),
        v.custoTotal.toFixed(2).replace(".", ","),
        v.comissaoTotal.toFixed(2).replace(".", ","),
        v.lucro.toFixed(2).replace(".", ","),
      ];
    });
    baixarCSV(
      `vendas_${de}_a_${ate}.csv`,
      [
        "Data",
        "Hora",
        "Canal",
        "Pagamento",
        "Parcelas",
        "Status",
        "Vendedora",
        "Itens",
        "Bruto",
        "Desconto",
        "Total",
        "Custo",
        "Comissão",
        "Lucro",
      ],
      linhas
    );
  }

  return (
    <div className="space-y-4">
      <header className="pt-1">
        <h1 className="text-2xl font-bold">Relatórios Financeiros</h1>
        <p className="text-sm text-muted">
          Faturamento, lucro e fluxo de caixa. Vendido (competência) × recebido (caixa).
        </p>
      </header>

      {/* filtros + export */}
      <div className="card space-y-3 print-hidden">
        <div className="flex gap-2 flex-wrap">
          {([
            ["hoje", "Hoje"],
            ["7dias", "7 dias"],
            ["mes", "Mês"],
            ["ano", "Ano"],
            ["custom", "Personalizado"],
          ] as [Preset, string][]).map(([id, lbl]) => (
            <span
              key={id}
              onClick={() => setPreset(id)}
              className={`chip ${
                preset === id ? "bg-brand-600 text-white border-brand-600" : "border-default"
              }`}
            >
              {lbl}
            </span>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="label">De</label>
              <input type="date" className="input" value={de} onChange={(e) => setDe(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="label">Até</label>
              <input type="date" className="input" value={ate} onChange={(e) => setAte(e.target.value)} />
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={exportarExcel} className="btn-ghost flex-1 py-2 text-sm">
            <FileSpreadsheet size={16} /> Excel
          </button>
          <button onClick={() => window.print()} className="btn-ghost flex-1 py-2 text-sm">
            <Printer size={16} /> PDF
          </button>
        </div>
      </div>

      <div className="text-xs text-muted -mt-1">Período: {label}</div>

      {/* cards principais */}
      <div className="grid grid-cols-2 gap-3 stagger">
        <Metric titulo="Faturamento bruto" valor={<CountUp value={r.faturamento} format={brl} />} sub="vendas (competência)" />
        <Metric titulo="Recebido (caixa)" valor={<CountUp value={r.recebido} format={brl} />} sub={`${r.qtdPagas} pagas`} forte />
        <Metric titulo="A receber" valor={<CountUp value={r.aReceber} format={brl} />} sub={`${r.qtdPendentes} pendentes`} />
        <Metric titulo="Descontos" valor={<CountUp value={r.descontos} format={brl} />} sub={`${r.qtdCanceladas} canceladas`} />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="card">
          <div className="text-xs text-muted">Lucro projetado</div>
          <CountUp value={r.lucroProjetado} format={brl} className="text-2xl font-bold text-green-500 block" />
          <div className="text-xs text-muted mt-1">
            Se todas as vendas do período forem pagas · margem {r.margem.toFixed(1)}%
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric titulo="Lucro realizado" valor={brl(r.lucroRealizado)} sub="proporcional ao caixa" />
          <Metric titulo="Custo das vendas" valor={brl(r.custoVendas)} sub="custo congelado na venda" />
        </div>
      </div>

      {/* fluxo de caixa */}
      <div className="card">
        <div className="flex items-center gap-2 font-semibold">
          <Wallet size={18} className="text-brand-500" /> Fluxo de Caixa — entradas no período
        </div>
        <CountUp value={r.fluxoTotal} format={brl} className="text-2xl font-bold mt-1 block" />
        <div className="grid grid-cols-3 gap-2 my-3">
          <Mini label="Média" valor={brl(r.fluxoMedia)} />
          <Mini label="Pico" valor={brl(r.fluxoPico.valor)} sub={r.fluxoPico.dia} />
          <Mini
            label="Tendência"
            valor={`${r.tendencia >= 0 ? "+" : ""}${r.tendencia.toFixed(0)}%`}
            up={r.tendencia >= 0}
          />
        </div>
        <VendasArea data={r.fluxo} yKey="valor" gradientId="fx" interval="preserveStartEnd" height={150} />
      </div>

      {/* por forma de pagamento */}
      {r.porForma.length > 0 && (
        <div className="card space-y-2">
          <div className="font-semibold mb-1">Recebido por forma de pagamento</div>
          {r.porForma.map((f) => (
            <div key={f.forma} className="flex items-center justify-between">
              <span className="text-muted">{f.label}</span>
              <span className="font-semibold">{brl(f.valor)}</span>
            </div>
          ))}
        </div>
      )}

      {/* parcelamento (crédito) */}
      {parcelado.qtd > 0 && (
        <div className="card flex items-center justify-between">
          <div>
            <div className="font-semibold">Vendas parceladas</div>
            <div className="text-xs text-muted">
              {parcelado.qtd} venda(s) · até {parcelado.maxParcelas}x
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold">{brl(parcelado.total)}</div>
            <div className="text-[11px] text-muted">no crédito</div>
          </div>
        </div>
      )}

      {/* ranking mais/menos */}
      {config.usaRevendedoras && ranking.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 font-semibold mb-3">
            <Trophy size={18} className="text-amber-500" /> Quem vende mais - e menos
          </div>
          <div className="space-y-1.5">
            {ranking.map((r2, i) => {
              const ultimo = i === ranking.length - 1 && ranking.length > 1;
              return (
                <div key={r2.nome} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="text-muted w-5">{i + 1}º</span>
                    <span className="font-medium">{r2.nome}</span>
                    {i === 0 && r2.total > 0 && (
                      <TrendingUp size={14} className="text-green-500" />
                    )}
                    {ultimo && <TrendingDown size={14} className="text-red-500" />}
                  </span>
                  <span className="text-sm">
                    {brl(r2.total)} <span className="text-muted">· {r2.qtd}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* vendas do período (cancelar / receber fiado) */}
      {vendasPeriodo.length > 0 && (
        <div className="card print-hidden">
          <div className="flex items-center gap-2 font-semibold mb-3">
            <Receipt size={18} className="text-brand-500" /> Vendas do período
            <span className="text-xs text-muted font-normal">({vendasPeriodo.length})</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {vendasPeriodo.slice(0, mostrarVendas).map((v) => {
              const { data, hora } = dataHora(v.data);
              const cancelada = v.statusPagamento === "cancelada";
              const quem = v.revendedoraId
                ? revendedoras.find((x) => x.id === v.revendedoraId)?.nome ?? "-"
                : "Loja";
              return (
                <div key={v.id} className="py-2 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium truncate ${cancelada ? "line-through text-muted" : ""}`}>
                      {v.itens.length > 0
                        ? v.itens.map((i) => `${i.qtd}x ${i.nome}${i.variacaoNome ? ` (${i.variacaoNome})` : ""}`).join(", ")
                        : "Recebimento avulso"}
                    </div>
                    <div className="text-[11px] text-muted truncate">
                      {data} {hora} · {quem}
                      {cancelada ? (
                        <span className="text-red-500 font-semibold"> · cancelada</span>
                      ) : v.statusPagamento === "pendente" ? (
                        <span className="text-amber-500 font-semibold"> · a receber</span>
                      ) : null}
                    </div>
                  </div>
                  <div className={`text-sm font-bold shrink-0 ${cancelada ? "line-through text-muted" : ""}`}>
                    {brl(v.total)}
                  </div>
                  {ehDono && !cancelada && (
                    <div className="flex gap-1 shrink-0">
                      {v.statusPagamento === "pendente" && (
                        <button
                          onClick={() => receber(v)}
                          disabled={processando === v.id}
                          className="grid place-items-center h-8 w-8 rounded-lg text-green-600 hover:bg-[var(--hover)] disabled:opacity-50"
                          title="Marcar como recebida"
                          aria-label="Marcar como recebida"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => cancelar(v)}
                        disabled={processando === v.id}
                        className="grid place-items-center h-8 w-8 rounded-lg text-red-500 hover:bg-[var(--hover)] disabled:opacity-50"
                        title="Cancelar venda"
                        aria-label="Cancelar venda"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {vendasPeriodo.length > mostrarVendas && (
            <button
              onClick={() => setMostrarVendas((n) => n + 20)}
              className="btn-ghost w-full py-2 text-sm mt-2"
            >
              Mostrar mais ({vendasPeriodo.length - mostrarVendas})
            </button>
          )}
        </div>
      )}

      {vendas.length === 0 && (
        <div className="card text-center text-muted py-8">
          <Clock className="mx-auto mb-2 opacity-50" />
          Registre vendas para ver seus relatórios aqui.
        </div>
      )}
    </div>
  );
}

function Metric({
  titulo,
  valor,
  sub,
  forte,
}: {
  titulo: string;
  valor: React.ReactNode;
  sub?: string;
  forte?: boolean;
}) {
  return (
    <div className="card">
      <div className="text-xs text-muted">{titulo}</div>
      <div className={`text-xl font-bold mt-1 ${forte ? "text-brand-500" : ""}`}>{valor}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function Mini({ label, valor, sub, up }: { label: string; valor: string; sub?: string; up?: boolean }) {
  return (
    <div className="surface-alt rounded-xl px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`font-bold text-sm ${up === undefined ? "" : up ? "text-green-500" : "text-red-500"}`}>
        {valor}
      </div>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </div>
  );
}
