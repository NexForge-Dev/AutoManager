"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { calcularRelatorio, rankingRevendedoras, brl, brlKpi } from "@/lib/analytics";
import { baixarCSV, dataHora } from "@/lib/export";
import Guard from "@/components/Guard";
import { registrarMetrica } from "@/lib/metricas/cliente";
import CountUp from "@/components/CountUp";
import { useDialog } from "@/components/Dialog";
import { EstadoVazio, PageHeader, Painel, Progresso, Segmentado, Selo, Stat } from "@/components/ui";
import type { Venda } from "@/lib/types";
import { fimDeYmd, fimDoDia, inicioDeYmd, inicioDoAno, inicioDoDia, inicioDoMes, ymdSP } from "@/lib/fuso";
const VendasArea = dynamic(() => import("@/components/charts/VendasArea"), {
  ssr: false,
  loading: () => <div style={{ height: 190 }} className="skeleton rounded-xl" />,
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
  BarChart3,
  Percent,
} from "lucide-react";

export default function RelatoriosPage() {
  return (
    <Guard>
      <Relatorios />
    </Guard>
  );
}

type Preset = "hoje" | "7dias" | "mes" | "ano" | "custom";

const PRESETS = [
  ["hoje", "Hoje"],
  ["7dias", "7 dias"],
  ["mes", "Mês"],
  ["ano", "Ano"],
  ["custom", "Personalizado"],
] as const;


function Relatorios() {
  const { vendas, revendedoras, config, role, cancelarVenda, marcarVendaRecebida } = useStore();
  const { confirm, alerta } = useDialog();
  const [preset, setPreset] = useState<Preset>("mes");
  const [mostrarVendas, setMostrarVendas] = useState(20);
  const [processando, setProcessando] = useState<string | null>(null);
  const ehDono = role === "owner";

  // dias/meses no fuso da loja (America/Sao_Paulo), não no do navegador
  const [de, setDe] = useState(() => ymdSP(inicioDoMes(Date.now())));
  const [ate, setAte] = useState(() => ymdSP(Date.now()));

  // período invertido no "Personalizado" (De depois de Até): avisa em vez de mostrar relatório vazio
  const periodoInvalido = preset === "custom" && !!de && !!ate && de > ate;

  const { deMs, ateMs, label } = useMemo(() => {
    const now = Date.now();
    if (preset === "hoje") return { deMs: inicioDoDia(now), ateMs: fimDoDia(now), label: "Hoje" };
    if (preset === "7dias") return { deMs: inicioDoDia(now, -6), ateMs: fimDoDia(now), label: "Últimos 7 dias" };
    if (preset === "mes") return { deMs: inicioDoMes(now), ateMs: fimDoDia(now), label: "Este mês" };
    if (preset === "ano") return { deMs: inicioDoAno(now), ateMs: fimDoDia(now), label: "Este ano" };
    // campo de data apagado/inválido: não deixa virar NaN nos cards
    const deCustom = inicioDeYmd(de);
    const ateCustom = fimDeYmd(ate);
    if (Number.isNaN(deCustom) || Number.isNaN(ateCustom))
      return { deMs: inicioDoMes(now), ateMs: fimDoDia(now), label: "Este mês" };
    const br = (iso: string) => iso.split("-").reverse().join("/");
    return { deMs: deCustom, ateMs: ateCustom, label: `${br(de)} a ${br(ate)}` };
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
    registrarMetrica({ tipo: "recurso", recurso: "relatorio_exportado" });
    if (periodoInvalido) {
      alerta({ titulo: "Período inválido", mensagem: "A data inicial (De) precisa ser antes da final (Até)." });
      return;
    }
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
    const canalLabel: Record<string, string> = {
      loja: "Loja",
      whatsapp: "WhatsApp",
      instagram: "Instagram",
    };
    const reais = (n: number) => (Math.round(n * 100) / 100 + 0).toFixed(2).replace(".", ",");
    const linhas = noPeriodo.map((v) => {
      const { data, hora } = dataHora(v.data);
      const itens = v.itens.map((i) => `${i.qtd}x ${i.nome}`).join(" | ");
      const bruto = v.total + (v.desconto || 0);
      return [
        data,
        hora,
        canalLabel[v.canal] || v.canal,
        formaLabel[v.formaPagamento] || v.formaPagamento,
        v.parcelas > 1 ? `${v.parcelas}x` : "À vista",
        statusLabel[v.statusPagamento] || v.statusPagamento,
        nome(v.revendedoraId),
        itens || "Recebimento avulso",
        reais(bruto),
        reais(v.desconto || 0),
        reais(v.total),
        reais(v.custoTotal),
        reais(v.comissaoTotal),
        reais(v.lucro),
      ];
    });
    baixarCSV(
      // nome pelo período realmente exibido (preset ou personalizado), no fuso da loja
      `vendas_${ymdSP(deMs)}_a_${ymdSP(ateMs)}.csv`,
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

  const maiorForma = r.porForma.reduce((m, f) => Math.max(m, f.valor), 0);

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        titulo="Relatórios financeiros"
        descricao="Faturamento, lucro e fluxo de caixa. Vendido (competência) × recebido (caixa)."
        acoes={
          <>
            <button type="button" onClick={exportarExcel} disabled={periodoInvalido} className="btn-ghost btn-sm">
              <FileSpreadsheet size={16} aria-hidden /> Excel
            </button>
            <button
              type="button"
              disabled={periodoInvalido}
              onClick={() => {
                registrarMetrica({ tipo: "recurso", recurso: "relatorio_exportado" });
                window.print();
              }}
              className="btn-ghost btn-sm"
            >
              <Printer size={16} aria-hidden /> PDF
            </button>
          </>
        }
      />

      {/* período */}
      <div className="space-y-3 print-hidden">
        <Segmentado rotulo="Período do relatório" opcoes={PRESETS} valor={preset} onChange={setPreset} className="max-w-full" />
        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="label" htmlFor="rel-de">De</label>
              <input id="rel-de" type="date" className="input" value={de} onChange={(e) => setDe(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="rel-ate">Até</label>
              <input id="rel-ate" type="date" className="input" value={ate} onChange={(e) => setAte(e.target.value)} />
            </div>
          </div>
        )}
        {periodoInvalido && (
          <p className="text-sm text-bad" role="alert">
            A data inicial (De) precisa ser antes da final (Até). Ajuste o período para ver o relatório.
          </p>
        )}
      </div>

      <div className="text-xs text-muted -mt-2">
        Período: {label}
        {/* a loja carrega primeiro só os últimos 180 dias; o resto chega em segundo plano */}
        {deMs < Date.now() - 180 * 24 * 60 * 60 * 1000 &&
          " · vendas com mais de 180 dias podem levar alguns segundos para aparecer"}
      </div>

      {vendas.length === 0 && (
        <div className="card p-0">
          <EstadoVazio icone={BarChart3} titulo="Ainda não há o que mostrar">
            Registre vendas para ver seus relatórios aqui.
          </EstadoVazio>
        </div>
      )}

      {vendas.length > 0 && vendasPeriodo.length === 0 && !periodoInvalido && (
        <div className="card p-0">
          <EstadoVazio compacto icone={Clock} titulo="Nenhuma venda neste período." />
        </div>
      )}

      {/* receita */}
      <div className="grid-kpi lg:grid-cols-4 gap-3 stagger">
        <Stat rotulo="Faturamento bruto" icone={Receipt} tom="brand" valor={<CountUp value={r.faturamento} format={brlKpi} />} apoio="vendas (competência)" />
        <Stat rotulo="Recebido (caixa)" icone={Wallet} tom="ok" valor={<CountUp value={r.recebido} format={brlKpi} />} apoio={`${r.qtdPagas} pagas`} />
        <Stat rotulo="A receber" icone={Clock} tom="warn" valor={<CountUp value={r.aReceber} format={brlKpi} />} apoio={`${r.qtdPendentes} pendentes`} />
        <Stat rotulo="Descontos" icone={Percent} valor={<CountUp value={r.descontos} format={brlKpi} />} apoio={`em ${r.qtdComDesconto} venda(s)`} />
      </div>

      {/* lucro */}
      <div className="grid-kpi lg:grid-cols-3 gap-3">
        <Stat
          className="col-full lg:col-span-1"
          rotulo="Lucro projetado"
          icone={TrendingUp}
          tom="ok"
          valorTom="ok"
          valor={<CountUp value={r.lucroProjetado} format={brlKpi} />}
          apoio={
            <>
              Se todas as vendas do período forem pagas · margem {r.margem.toFixed(1)}%
              {r.qtdCanceladas > 0 && ` · ${r.qtdCanceladas} cancelada(s) fora da conta`}
            </>
          }
        />
        <Stat rotulo="Lucro realizado" valor={brlKpi(r.lucroRealizado)} apoio="proporcional ao caixa" />
        <Stat rotulo="Custo das vendas" valor={brlKpi(r.custoVendas)} apoio="custo congelado na venda" />
      </div>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-3 items-start">
        {/* fluxo de caixa */}
        <Painel
          className="lg:col-span-2"
          titulo="Fluxo de caixa"
          descricao="Entradas no período"
          icone={Wallet}
          acao={<CountUp value={r.fluxoTotal} format={brl} className="text-lg font-bold tnum" />}
        >
          <div className="grid-kpi-3 gap-2 mb-3">
            <Mini label="Média" valor={brlKpi(r.fluxoMedia)} />
            <Mini label="Pico" valor={brlKpi(r.fluxoPico.valor)} sub={r.fluxoPico.dia} />
            {/* sem base de comparação (ex.: "Hoje"): neutro, nada de "+0%" verde */}
            <Mini
              label="Tendência"
              valor={r.tendencia === null ? "—" : `${r.tendencia >= 0 ? "+" : ""}${r.tendencia.toFixed(0)}%`}
              up={r.tendencia === null ? undefined : r.tendencia >= 0}
            />
          </div>
          <VendasArea data={r.fluxo} yKey="valor" gradientId="fx" interval="preserveStartEnd" height={190} />
        </Painel>

        <div className="space-y-4 md:space-y-5 min-w-0">
          {/* por forma de pagamento */}
          {r.porForma.length > 0 && (
            <Painel titulo="Recebido por forma de pagamento">
              <div className="space-y-3">
                {r.porForma.map((f) => (
                  <div key={f.forma}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted truncate">{f.label}</span>
                      <span className="font-semibold tnum shrink-0">{brl(f.valor)}</span>
                    </div>
                    <Progresso className="mt-1" pct={maiorForma ? (f.valor / maiorForma) * 100 : 0} />
                  </div>
                ))}
              </div>
            </Painel>
          )}

          {/* parcelamento (crédito) */}
          {parcelado.qtd > 0 && (
            <div className="card flex items-center justify-between gap-3">
              <div>
                <div className="section-title">Vendas parceladas</div>
                <div className="text-xs text-muted">
                  {parcelado.qtd} venda(s) · até {parcelado.maxParcelas}x
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold tnum">{brl(parcelado.total)}</div>
                <div className="text-xs text-muted">no crédito</div>
              </div>
            </div>
          )}

          {/* ranking mais/menos */}
          {config.usaRevendedoras && ranking.length > 0 && (
            <Painel titulo="Quem vende mais - e menos" icone={Trophy}>
              <div className="space-y-2">
                {ranking.map((r2, i) => {
                  const ultimo = i === ranking.length - 1 && ranking.length > 1;
                  return (
                    <div key={r2.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-muted tnum w-5 shrink-0">{i + 1}º</span>
                        <span className="font-medium truncate">{r2.nome}</span>
                        {i === 0 && r2.total > 0 && (
                          <TrendingUp size={14} className="text-ok shrink-0" aria-label="Quem mais vendeu" />
                        )}
                        {ultimo && <TrendingDown size={14} className="text-bad shrink-0" aria-label="Quem menos vendeu" />}
                      </span>
                      <span className="tnum shrink-0">
                        {brl(r2.total)} <span className="text-muted">· {r2.qtd}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </Painel>
          )}
        </div>
      </div>

      {/* vendas do período (cancelar / receber fiado) */}
      {vendasPeriodo.length > 0 && (
        <Painel
          className="print-hidden"
          titulo={
            <>
              Vendas do período <span className="text-muted font-normal tnum">({vendasPeriodo.length})</span>
            </>
          }
          icone={Receipt}
          lista
        >
          {vendasPeriodo.slice(0, mostrarVendas).map((v) => {
            const { data, hora } = dataHora(v.data);
            const cancelada = v.statusPagamento === "cancelada";
            const quem = v.revendedoraId
              ? revendedoras.find((x) => x.id === v.revendedoraId)?.nome ?? "-"
              : "Loja";
            return (
              <div key={v.id} className="row flex-wrap py-2.5">
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium truncate ${cancelada ? "line-through text-muted" : ""}`}>
                    {v.itens.length > 0
                      ? v.itens.map((i) => `${i.qtd}x ${i.nome}${i.variacaoNome ? ` (${i.variacaoNome})` : ""}`).join(", ")
                      : "Recebimento avulso"}
                  </div>
                  <div className="text-xs text-muted flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="tnum">
                      {data} {hora}
                    </span>
                    <span>· {quem}</span>
                    {cancelada ? (
                      <Selo tom="bad">cancelada</Selo>
                    ) : v.statusPagamento === "pendente" ? (
                      <Selo tom="warn">a receber</Selo>
                    ) : null}
                  </div>
                </div>
                <div className={`text-sm font-bold tnum shrink-0 ${cancelada ? "line-through text-muted" : ""}`}>
                  {brl(v.total)}
                </div>
                {ehDono && (
                  <div className="flex shrink-0 justify-end w-[5.25rem] -mr-1.5">
                    {!cancelada && v.statusPagamento === "pendente" && (
                      <button
                        onClick={() => receber(v)}
                        disabled={processando === v.id}
                        className="icon-btn text-ok hover:!text-ok"
                        title="Marcar como recebida"
                        aria-label="Marcar como recebida"
                      >
                        <Check size={17} aria-hidden />
                      </button>
                    )}
                    {!cancelada && (
                      <button
                        onClick={() => cancelar(v)}
                        disabled={processando === v.id}
                        className="icon-btn hover:!text-bad"
                        title="Cancelar venda"
                        aria-label="Cancelar venda"
                      >
                        <XCircle size={17} aria-hidden />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {vendasPeriodo.length > mostrarVendas && (
            <div className="p-3">
              <button onClick={() => setMostrarVendas((n) => n + 20)} className="btn-ghost btn-sm w-full">
                Mostrar mais ({vendasPeriodo.length - mostrarVendas})
              </button>
            </div>
          )}
        </Painel>
      )}
    </div>
  );
}

function Mini({ label, valor, sub, up }: { label: string; valor: string; sub?: string; up?: boolean }) {
  return (
    <div className="surface-alt rounded-lg px-2 py-2 min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className={`font-bold text-sm tnum [overflow-wrap:anywhere] ${up === undefined ? "" : up ? "text-ok" : "text-bad"}`}>
        {valor}
      </div>
      {sub && <div className="text-[11px] text-muted truncate">{sub}</div>}
    </div>
  );
}
