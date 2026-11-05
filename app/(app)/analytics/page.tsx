"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { calcularAnalytics, brl, brlKpi } from "@/lib/analytics";
import { usePlano } from "@/lib/usePlano";
import { planoQueLibera } from "@/lib/plans";
import { UpgradeBlock } from "@/components/UpgradeGate";
import Guard from "@/components/Guard";
import { useMetricaAoAbrir } from "@/lib/metricas/cliente";
import CountUp from "@/components/CountUp";
import { Aviso, EstadoVazio, LinkAcao, PageHeader, Painel, Progresso, Stat } from "@/components/ui";
import { PieChart, TrendingUp, TrendingDown, ShoppingBag, AlertTriangle, Sparkles, Radio, CalendarRange, Hash, Receipt, PlusCircle } from "lucide-react";

export default function AnalyticsPage() {
  useMetricaAoAbrir({ tipo: "recurso", recurso: "analytics_visto" });
  return (
    <Guard>
      <Analytics />
    </Guard>
  );
}

// ordem fixa validada (daltonismo e contraste nos dois temas): vizinhas no anel
// são sempre bem distintas. A cor segue a posição do produto no ranking.
const CORES = ["#db2777", "#ca8a04", "#2563eb", "#0d9488", "#7c3aed", "#ea580c", "#94a3b8", "#dc2626"];

// valor curto para o rótulo sobre a barra; o valor exato fica na dica ao passar o mouse
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function Analytics() {
  const produtos = useStore((s) => s.produtos);
  const vendas = useStore((s) => s.vendas);
  const { caps } = usePlano();
  const a = useMemo(() => calcularAnalytics(produtos, vendas), [produtos, vendas]);

  const cabecalho = (
    <PageHeader
      titulo="Inteligência"
      descricao="Receita por produto, mix de canais e tendências para vender mais."
    />
  );

  if (!caps.allowAnalytics) {
    return (
      <div className="space-y-4 md:space-y-5">
        {cabecalho}
        <UpgradeBlock
          titulo="Analytics não está no seu plano"
          descricao="Veja receita por produto, mix de canais e tendências para vender mais. Disponível a partir do plano Equipe."
          planoNecessario={planoQueLibera((p) => p.allowAnalytics)}
        />
      </div>
    );
  }

  const temRuptura = caps.allowAdvancedAnalytics && a.ruptura.length > 0;
  const totalProdutos = a.porProduto.reduce((s, p) => s + p.receita, 0);

  return (
    <div className="space-y-4 md:space-y-5">
      {cabecalho}

      {/* canceladas não contam: só canceladas = sem dados */}
      {a.totalVendas === 0 ? (
        <div className="card p-0">
          <EstadoVazio
            icone={PieChart}
            titulo="Sem vendas ainda."
            acao={
              <Link href="/vender" className="btn-primary">
                <PlusCircle size={17} aria-hidden /> Registrar venda
              </Link>
            }
          >
            Os gráficos aparecem quando você começar a vender.
          </EstadoVazio>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="space-y-1.5">
            <div className={`grid-kpi gap-3 ${caps.allowAdvancedAnalytics ? "lg:grid-cols-3" : ""}`}>
              {/* ticket médio e itens/venda: só vendas com produtos (sem "Recebimento avulso") */}
              <Stat rotulo="Ticket médio" icone={Receipt} tom="brand" valor={<CountUp value={a.ticketMedio} format={brlKpi} />} />
              <Stat
                rotulo="Itens/venda"
                icone={Hash}
                tom="info"
                valor={<CountUp value={a.itensPorVenda} format={(n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} />}
              />
              {caps.allowAdvancedAnalytics &&
                (a.tendenciaMes === null ? (
                  // mês anterior sem vendas: não há base para comparar (nada de "+0%" verde)
                  <Stat className="col-full lg:col-span-1" rotulo="Mês vs anterior" icone={CalendarRange} valor="—" />
                ) : (
                  <Stat
                    className="col-full lg:col-span-1"
                    rotulo="Mês vs anterior"
                    icone={a.tendenciaMes >= 0 ? TrendingUp : TrendingDown}
                    tom={a.tendenciaMes >= 0 ? "ok" : "bad"}
                    valorTom={a.tendenciaMes >= 0 ? "ok" : "bad"}
                    valor={`${a.tendenciaMes >= 0 ? "+" : ""}${a.tendenciaMes.toFixed(0)}%`}
                  />
                ))}
            </div>
            {a.vendasComItens < a.totalVendas && (
              <p className="hint">
                Ticket médio e itens/venda consideram só vendas com produtos (
                {a.totalVendas - a.vendasComItens} recebimento(s) avulso(s) fora da conta).
              </p>
            )}
          </div>

          <div className="grid gap-4 md:gap-5 lg:grid-cols-3 items-start">
            {/* Vendas por produto (donut) */}
            <Painel
              className="lg:col-span-2"
              titulo="Receita por produto"
              icone={ShoppingBag}
              descricao="Já com os descontos das vendas, rateados entre os itens."
            >
              {a.porProduto.length === 0 ? (
                <p className="text-sm text-muted">Sem dados.</p>
              ) : (
                <div className="flex flex-col xl:flex-row xl:items-center gap-x-6 gap-y-4">
                  <Donut
                    className="self-center shrink-0"
                    data={a.porProduto.map((p, i) => ({ nome: p.nome, valor: p.receita, cor: CORES[i % CORES.length] }))}
                  />
                  <ul className="flex-1 min-w-0 space-y-1.5">
                    {a.porProduto.map((p, i) => (
                      <li key={`${i}-${p.nome}`} className="flex items-center gap-2 text-sm">
                        <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: CORES[i % CORES.length] }} aria-hidden />
                        <span className="truncate flex-1 min-w-0">{p.nome}</span>
                        <span className="text-xs text-muted tnum shrink-0 w-9 text-right">
                          {totalProdutos > 0 ? `${((p.receita / totalProdutos) * 100).toFixed(0)}%` : ""}
                        </span>
                        <span className="font-medium tnum shrink-0 w-[5.75rem] text-right">{brl(p.receita)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Painel>

            {/* Mix por canal */}
            <Painel titulo="Mix por canal" icone={Radio}>
              <div className="space-y-3">
                {a.porCanal.map((c) => (
                  <div key={c.canal}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate">{c.label}</span>
                      <span className="text-muted tnum shrink-0">
                        {brl(c.total)} · {c.pct.toFixed(0)}%
                      </span>
                    </div>
                    <Progresso className="mt-1.5 !h-2" pct={c.pct} rotulo={`Participação de ${c.label}`} />
                  </div>
                ))}
              </div>
            </Painel>

            {/* AVANÇADO: tendência + ruptura (plano Expansão) */}
            {caps.allowAdvancedAnalytics ? (
              <>
                <Painel className={temRuptura ? "lg:col-span-2" : "lg:col-span-3"} titulo="Faturamento (6 meses)" icone={CalendarRange}>
                  <BarsMes data={a.porMes} />
                </Painel>

                {a.ruptura.length > 0 && (
                  <Painel
                    titulo="Oportunidades perdidas"
                    icone={AlertTriangle}
                    descricao="Produtos sem estoque que vendiam bem — repor pode recuperar esta receita."
                    lista
                  >
                    {a.ruptura.map((r, i) => (
                      <div key={`${i}-${r.nome}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                        <span className="truncate">{r.nome}</span>
                        <span className="text-warn font-semibold tnum shrink-0">~{brl(r.perdaEstimada)}/mês</span>
                      </div>
                    ))}
                  </Painel>
                )}
              </>
            ) : (
              <Aviso
                className="lg:col-span-3"
                tom="brand"
                icone={Sparkles}
                titulo="Analytics avançado"
                acao={<LinkAcao href="/planos">Ver planos</LinkAcao>}
              >
                Desbloqueie <b>tendência mensal</b> e <b>ruptura de estoque</b> (oportunidades perdidas) com o plano{" "}
                <b>Expansão</b>.
              </Aviso>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// donut SVG sem dependências
function Donut({ data, className = "" }: { data: { nome: string; valor: number; cor: string }[]; className?: string }) {
  const total = data.reduce((a, d) => a + d.valor, 0) || 1;
  const R = 42;
  const C = 2 * Math.PI * R;
  // fio entre as fatias (somente quando há mais de uma)
  const GAP = data.length > 1 ? 1.2 : 0;
  let offset = 0;
  return (
    <div className={`relative h-40 w-40 reveal ${className}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label="Participação de cada produto na receita">
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-alt)" strokeWidth="12" />
        {data.map((d, i) => {
          const frac = d.valor / total;
          const len = frac * C;
          const el = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={d.cor}
              strokeWidth="12"
              strokeDasharray={`${Math.max(len - GAP, 0.5)} ${C - Math.max(len - GAP, 0.5)}`}
              strokeDashoffset={-offset}
              className="origin-center transition-[stroke-width] duration-200 hover:[stroke-width:15] cursor-pointer"
            >
              <title>{`${d.nome}: ${brl(d.valor)}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center pointer-events-none">
        <div className="eyebrow">Top {data.length}</div>
        <div className="text-sm font-bold tnum">{brl(data.reduce((a, d) => a + d.valor, 0))}</div>
      </div>
    </div>
  );
}

function BarsMes({ data }: { data: { mes: string; total: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex items-end justify-between gap-2 sm:gap-4 h-48" role="img" aria-label={data.map((d) => `${d.mes}: ${brl(d.total)}`).join("; ")}>
      {data.map((d, i) => (
        <div key={i} className="relative flex-1 min-w-0 flex flex-col items-center gap-1.5 h-full justify-end group" title={`${d.mes}: ${brl(d.total)}`}>
          <div className="text-[11px] text-muted tnum whitespace-nowrap">{d.total > 0 ? compacto.format(d.total) : ""}</div>
          {/* a barra cresce dentro do próprio espaço (sem empurrar o rótulo para fora) */}
          <div className="w-full flex-1 flex items-end justify-center min-h-0 border-b border-default">
            <div
              className={`w-full max-w-[3.5rem] rounded-t min-h-[2px] bar-grow-y transition-colors ${
                i === data.length - 1 ? "bg-brand-500" : "bg-brand-500/55 group-hover:bg-brand-500/75"
              }`}
              style={{ height: `${(d.total / max) * 100}%`, animationDelay: `${i * 60}ms` }}
            />
          </div>
          <div className="text-xs text-muted">{d.mes}</div>
        </div>
      ))}
    </div>
  );
}
