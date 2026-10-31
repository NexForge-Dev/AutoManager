"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { calcularAnalytics, brl } from "@/lib/analytics";
import { usePlano } from "@/lib/usePlano";
import { planoQueLibera } from "@/lib/plans";
import { UpgradeBlock } from "@/components/UpgradeGate";
import Guard from "@/components/Guard";
import { useMetricaAoAbrir } from "@/lib/metricas/cliente";
import CountUp from "@/components/CountUp";
import { PieChart, TrendingUp, TrendingDown, ShoppingBag, AlertTriangle, Sparkles } from "lucide-react";

export default function AnalyticsPage() {
  useMetricaAoAbrir({ tipo: "recurso", recurso: "analytics_visto" });
  return (
    <Guard>
      <Analytics />
    </Guard>
  );
}

const CORES = ["#db2777", "#7c3aed", "#2563eb", "#0d9488", "#ea580c", "#ca8a04", "#dc2626", "#64748b"];

function Analytics() {
  const produtos = useStore((s) => s.produtos);
  const vendas = useStore((s) => s.vendas);
  const { caps } = usePlano();
  const a = useMemo(() => calcularAnalytics(produtos, vendas), [produtos, vendas]);

  if (!caps.allowAnalytics) {
    return (
      <div className="space-y-4">
        <header className="flex items-center gap-2 pt-1">
          <PieChart className="text-brand-600" />
          <h1 className="text-2xl font-bold">Inteligência</h1>
        </header>
        <UpgradeBlock
          titulo="Analytics não está no seu plano"
          descricao="Veja receita por produto, mix de canais e tendências para vender mais. Disponível a partir do plano Equipe."
          planoNecessario={planoQueLibera((p) => p.allowAnalytics)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2 pt-1">
        <PieChart className="text-brand-600" />
        <h1 className="text-2xl font-bold">Inteligência</h1>
      </header>

      {vendas.length === 0 ? (
        <div className="card text-center text-muted">
          Sem vendas ainda. Os gráficos aparecem quando você começar a vender.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className={`grid gap-2 stagger ${caps.allowAdvancedAnalytics ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
            <Kpi label="Ticket médio" valor={<CountUp value={a.ticketMedio} format={brl} />} />
            <Kpi label="Itens/venda" valor={<CountUp value={a.itensPorVenda} format={(n) => n.toFixed(1)} />} />
            {caps.allowAdvancedAnalytics && (
              <Kpi
                label="Mês vs anterior"
                valor={`${a.tendenciaMes >= 0 ? "+" : ""}${a.tendenciaMes.toFixed(0)}%`}
                cor={a.tendenciaMes >= 0 ? "text-green-500" : "text-red-500"}
                icon={a.tendenciaMes >= 0 ? TrendingUp : TrendingDown}
              />
            )}
          </div>

          {/* Vendas por produto (donut) */}
          <section className="card space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <ShoppingBag size={18} className="text-brand-500" /> Receita por produto
            </div>
            {a.porProduto.length === 0 ? (
              <p className="text-sm text-muted">Sem dados.</p>
            ) : (
              <div className="flex items-center gap-4 flex-wrap">
                <Donut
                  data={a.porProduto.map((p, i) => ({ valor: p.receita, cor: CORES[i % CORES.length] }))}
                />
                <div className="flex-1 min-w-[150px] space-y-1">
                  {a.porProduto.map((p, i) => (
                    <div key={p.nome} className="flex items-center gap-2 text-sm">
                      <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: CORES[i % CORES.length] }} />
                      <span className="truncate flex-1">{p.nome}</span>
                      <span className="text-muted">{brl(p.receita)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Mix por canal */}
          <section className="card space-y-3">
            <div className="font-semibold">Mix por canal</div>
            {a.porCanal.map((c) => (
              <div key={c.canal}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{c.label}</span>
                  <span className="text-muted">
                    {brl(c.total)} · {c.pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full surface-alt overflow-hidden">
                  <div className="h-full rounded-full bg-brand-600 bar-grow-x" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </section>

          {/* AVANÇADO: tendência + ruptura (plano Expansão) */}
          {caps.allowAdvancedAnalytics ? (
            <>
              <section className="card space-y-3">
                <div className="font-semibold">Faturamento (6 meses)</div>
                <BarsMes data={a.porMes} />
              </section>

              {a.ruptura.length > 0 && (
                <section className="card space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-amber-500">
                    <AlertTriangle size={18} /> Oportunidades perdidas
                  </div>
                  <p className="text-xs text-muted">
                    Produtos sem estoque que vendiam bem — repor pode recuperar esta receita.
                  </p>
                  {a.ruptura.map((r) => (
                    <div key={r.nome} className="flex items-center justify-between text-sm">
                      <span className="truncate">{r.nome}</span>
                      <span className="text-amber-500 font-semibold shrink-0">~{brl(r.perdaEstimada)}/mês</span>
                    </div>
                  ))}
                </section>
              )}
            </>
          ) : (
            <Link href="/planos" className="card block bg-brand-500/5 border-brand-500/30">
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles size={18} className="text-brand-500" /> Analytics avançado
              </div>
              <p className="text-sm text-muted mt-1">
                Desbloqueie <b>tendência mensal</b> e <b>ruptura de estoque</b> (oportunidades perdidas) com o plano{" "}
                <b>Expansão</b>. <span className="text-brand-500 font-semibold">Ver planos →</span>
              </p>
            </Link>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  valor,
  cor,
  icon: Icon,
}: {
  label: string;
  valor: React.ReactNode;
  cor?: string;
  icon?: any;
}) {
  return (
    <div className="card py-3 px-2 text-center min-w-0">
      <div className={`text-base sm:text-lg font-bold flex items-center justify-center gap-1 whitespace-nowrap overflow-hidden ${cor || ""}`}>
        {Icon && <Icon size={15} />} {valor}
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

// donut SVG sem dependências
function Donut({ data }: { data: { valor: number; cor: string }[] }) {
  const total = data.reduce((a, d) => a + d.valor, 0) || 1;
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90 reveal">
      <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-alt)" strokeWidth="14" />
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
            strokeWidth="14"
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-offset}
            className="origin-center transition-[stroke-width] duration-200 hover:[stroke-width:17] cursor-pointer"
          >
            <title>{brl(d.valor)}</title>
          </circle>
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

function BarsMes({ data }: { data: { mes: string; total: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
          <div className="text-[10px] text-muted whitespace-nowrap">{d.total > 0 ? brl(d.total).replace("R$", "").trim() : ""}</div>
          {/* a barra cresce dentro do próprio espaço (sem empurrar o rótulo para fora) */}
          <div className="w-full flex-1 flex items-end min-h-0">
            <div
              className="w-full rounded-t-lg bg-brand-600 min-h-[2px] bar-grow-y transition-colors group-hover:bg-brand-500"
              style={{ height: `${(d.total / max) * 100}%`, animationDelay: `${i * 60}ms` }}
            />
          </div>
          <div className="text-[11px] text-muted">{d.mes}</div>
        </div>
      ))}
    </div>
  );
}
