"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { calcularMetricas, brl } from "@/lib/analytics";
import { usePlano } from "@/lib/usePlano";
import { fmtLimite } from "@/lib/plans";
import { FUSO_LOJA } from "@/lib/fuso";
import Guard from "@/components/Guard";
import Reporte from "@/components/Reporte";
import CountUp from "@/components/CountUp";
import Link from "next/link";
// recharts é pesado: carrega só quando o painel monta, fora do bundle inicial.
const VendasArea = dynamic(() => import("@/components/charts/VendasArea"), {
  ssr: false,
  loading: () => <div style={{ height: 140 }} className="skeleton rounded-xl" />,
});
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  AlertTriangle,
  Trophy,
  Settings,
  BarChart3,
  PackageX,
  Crown,
  Sparkles,
  Inbox,
  Lock,
} from "lucide-react";

export default function PainelPage() {
  return (
    <Guard>
      <Painel />
    </Guard>
  );
}

function Painel() {
  const { produtos, vendas, revendedoras, config } = useStore();
  const recebimentosPendentes = useStore((s) => s.entradasPendentes.length);
  const { caps } = usePlano();
  const m = useMemo(() => calcularMetricas(produtos, vendas, revendedoras), [produtos, vendas, revendedoras]);

  const variacao =
    m.faturamentoMesAnterior > 0
      ? ((m.faturamentoMes - m.faturamentoMesAnterior) / m.faturamentoMesAnterior) * 100
      : null;

  const criticos = produtos
    .filter((p) => p.ativo && p.estoqueAtual <= p.estoqueMinimo)
    .sort((a, b) => a.estoqueAtual - b.estoqueAtual);

  return (
    <div className="space-y-4">
      <header className="pt-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {config.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.logoUrl}
              alt={config.nomeLoja || "Logo da loja"}
              className="h-11 w-11 rounded-xl object-cover shrink-0 border border-default"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm text-muted">Olá 👋</p>
            <h1 className="text-2xl font-bold truncate">{config.nomeLoja || "Minha Loja"}</h1>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Link
            href="/recebimentos"
            className="relative grid place-items-center h-10 w-10 rounded-xl text-muted hover:text-strong hover:bg-[var(--hover)] active:scale-90 transition"
            title="Recebimentos"
            aria-label={
              recebimentosPendentes > 0 ? `Recebimentos (${recebimentosPendentes} pendentes)` : "Recebimentos"
            }
          >
            <Inbox size={22} />
            {recebimentosPendentes > 0 && (
              <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">
                {recebimentosPendentes > 9 ? "9+" : recebimentosPendentes}
              </span>
            )}
          </Link>
          <Link
            href="/relatorios"
            className="grid place-items-center h-10 w-10 rounded-xl text-muted hover:text-strong hover:bg-[var(--hover)] active:scale-90 transition"
            title="Relatórios"
            aria-label="Relatórios"
          >
            <BarChart3 size={22} />
          </Link>
          <Link
            href="/configuracoes"
            className="grid place-items-center h-10 w-10 rounded-xl text-muted hover:text-strong hover:bg-[var(--hover)] active:scale-90 transition"
            title="Configurações"
            aria-label="Configurações"
          >
            <Settings size={22} />
          </Link>
        </div>
      </header>

      {/* plano atual */}
      <PlanoCard />

      {/* cards principais */}
      <div className="grid grid-cols-2 gap-3 stagger">
        <div className="card">
          <div className="flex items-center gap-2 text-muted text-xs">
            <Wallet size={14} /> Faturamento do mês
          </div>
          <CountUp value={m.faturamentoMes} format={brl} className="block text-xl font-bold mt-1" />
          <div className="text-xs mt-1 h-4 flex items-center gap-1">
            {variacao !== null ? (
              <span
                className={`flex items-center gap-1 ${
                  variacao >= 0 ? "text-green-600" : "text-red-500"
                }`}
              >
                {variacao >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(variacao).toFixed(0)}% vs mês anterior
              </span>
            ) : (
              <span className="text-muted">no mês atual</span>
            )}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-muted text-xs">
            <TrendingUp size={14} /> Lucro estimado
          </div>
          <CountUp
            value={m.lucroMes}
            format={brl}
            className={`block text-xl font-bold mt-1 ${m.lucroMes < 0 ? "text-red-500" : "text-green-600"}`}
          />
          <div className="text-xs mt-1 h-4 text-muted">
            {m.faturamentoMes > 0
              ? `margem de ${Math.round((m.lucroMes / m.faturamentoMes) * 100)}% no mês`
              : "no mês atual"}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-muted text-xs">
            <Wallet size={14} /> Comissão pendente
          </div>
          <CountUp value={m.comissaoPendente} format={brl} className="block text-xl font-bold mt-1 text-brand-600" />
          <div className="text-xs mt-1 h-4 text-muted">a repassar</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-muted text-xs">
            <Package size={14} /> Valor em estoque
          </div>
          <CountUp value={m.valorEstoque} format={brl} className="block text-xl font-bold mt-1" />
          <div className="text-xs mt-1 h-4 text-muted">a preço de custo</div>
        </div>
      </div>

      {/* estoque crítico - sempre visível */}
      {criticos.length > 0 && (
        <div className="card border-red-500/40 bg-red-500/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-semibold text-red-500">
              <PackageX size={18} /> Estoque Crítico
            </div>
            <Link href="/reposicao" className="text-xs text-brand-500">
              repor →
            </Link>
          </div>
          <div className="space-y-1.5 stagger">
            {criticos.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="truncate pr-2">{p.nome}</span>
                <span
                  className={`shrink-0 font-bold ${
                    p.estoqueAtual <= 0 ? "text-red-500" : "text-amber-500"
                  }`}
                >
                  {p.estoqueAtual} un.
                </span>
              </div>
            ))}
            {criticos.length > 6 && (
              <div className="text-xs text-muted pt-1">+ {criticos.length - 6} outros produtos</div>
            )}
          </div>
        </div>
      )}

      {/* alerta reposição */}
      {m.qtdReposicao > 0 && (
        <Link href="/reposicao" className="card flex items-center gap-3 bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="text-amber-500 shrink-0" />
          <div>
            <div className="font-semibold text-amber-500">
              {m.qtdReposicao} produto(s) para repor
            </div>
            <div className="text-sm text-amber-500/80">Toque para ver o que comprar →</div>
          </div>
        </Link>
      )}

      {/* gráfico */}
      <div className="card">
        <div className="text-sm font-semibold mb-2">Vendas (últimos 14 dias)</div>
        <VendasArea data={m.vendasPorDia} />
      </div>

      {/* ranking revendedoras (plano Equipe+) */}
      {caps.allowRanking && config.usaRevendedoras && m.rankingRevendedoras.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 text-sm font-semibold mb-3">
            <Trophy size={16} className="text-amber-500" /> Ranking de revendedoras
          </div>
          <div className="space-y-2 stagger">
            {m.rankingRevendedoras.map((r, i) => (
              // nomes podem repetir (homônimas, "-" de revendedora removida): posição + nome
              <div key={`${i}-${r.nome}`} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-muted w-5 shrink-0">{i + 1}º</span>
                  <span className="font-medium truncate">{r.nome}</span>
                </span>
                <span className="text-sm shrink-0">{brl(r.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* top produtos */}
      {m.topProdutos.length > 0 && (
        <div className="card">
          <div className="text-sm font-semibold mb-3">🔥 Mais vendidos</div>
          <div className="space-y-2 stagger">
            {m.topProdutos.map((p) => (
              <div key={p.nome} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium truncate">{p.nome}</span>
                <span className="text-muted shrink-0">{p.qtd} un</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {vendas.length === 0 && (
        <Link href="/vender" className="card text-center block bg-brand-500/10 border-brand-500/30">
          <div className="font-semibold text-brand-500">Registre sua primeira venda 🎉</div>
          <div className="text-sm text-brand-500/80 mt-1">É 1 toque. Toque aqui pra começar.</div>
        </Link>
      )}

      {/* suporte: reportar problema / abrir ticket */}
      <Reporte />
    </div>
  );
}

function PlanoCard() {
  const { defContratado, caps, uso, emTrial, diasTrial, assinatura, situacao, bloqueado } = usePlano();
  // No teste grátis vale o Expansão (caps) e depois o plano contratado: mostra os
  // dois para não parecer que o plano contratado tem revendedoras ilimitadas.
  const limRev = caps.maxRevendedoras;
  const limDepois = defContratado.maxRevendedoras;
  // limite 0 (Ambulante/piso): sem divisão por zero (NaN na largura da barra)
  const pctRev =
    limRev === Infinity ? 0 : limRev > 0 ? Math.min(100, (uso.revendedoras / limRev) * 100) : uso.revendedoras > 0 ? 100 : 0;
  const ate =
    emTrial && assinatura?.trialAte
      ? new Date(assinatura.trialAte).toLocaleDateString("pt-BR", {
          timeZone: FUSO_LOJA,
          day: "2-digit",
          month: "2-digit",
        })
      : null;
  // sem assinatura / teste vencido / cancelada / inadimplente: a loja está no piso
  const motivoBloqueio =
    situacao === "sem_assinatura"
      ? "Sem assinatura"
      : situacao === "trial_vencido"
        ? "Teste encerrado"
        : situacao === "cancelada"
          ? "Assinatura cancelada"
          : "Pagamento pendente";
  if (bloqueado) {
    return (
      <Link href="/planos" className="card block border-red-500/40 bg-red-500/5 hover:surface-alt transition">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold min-w-0">
            <Lock size={18} className="text-red-500 shrink-0" />
            <span className="truncate">
              {situacao === "sem_assinatura" ? "Nenhum plano ativo" : `Plano ${defContratado.nome}`}
            </span>
            <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-red-500 text-white whitespace-nowrap">
              {motivoBloqueio}
            </span>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted">
          Revendedoras, vendedores, motoboys, ranking e analytics estão bloqueados. Seus dados continuam salvos.
        </p>
        <span className="mt-2 text-sm text-brand-500 font-semibold flex items-center gap-1">
          {situacao === "pendente" ? "Regularizar pagamento" : "Assinar um plano"} <Sparkles size={13} />
        </span>
      </Link>
    );
  }
  return (
    <Link href="/configuracoes/plano" className="card block hover:surface-alt transition">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold min-w-0">
          <Crown size={18} className="text-brand-500 shrink-0" />
          {emTrial ? (
            <span className="truncate">Teste grátis</span>
          ) : (
            <span className="truncate">Plano {defContratado.nome}</span>
          )}
          {emTrial && (
            <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-brand-600 text-white whitespace-nowrap">
              {diasTrial} dia{diasTrial === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-brand-500 font-semibold flex items-center gap-1">
          Gerenciar <Sparkles size={13} />
        </span>
      </div>
      {emTrial && (
        <p className="mt-1 text-xs text-muted">
          Recursos do <b>{caps.nome}</b>{ate ? <> até <b>{ate}</b></> : null}.
          {defContratado.id !== caps.id && (
            <>
              {" "}Depois, plano <b>{defContratado.nome}</b>.
            </>
          )}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">Revendedoras</span>
        <span className="font-semibold text-right">
          {uso.revendedoras} / {fmtLimite(limRev)}
          {emTrial && limDepois !== limRev && (
            <span className="block text-[11px] font-normal text-muted">
              {limDepois === 0
                ? `o ${defContratado.nome} não inclui revendedoras`
                : `${fmtLimite(limDepois)} no ${defContratado.nome}`}
            </span>
          )}
        </span>
      </div>
      {limRev !== Infinity && limRev > 0 && (
        <div className="h-1.5 rounded-full surface-alt overflow-hidden mt-1">
          <div
            className={`h-full rounded-full progress-fill ${pctRev >= 100 ? "bg-red-500" : "bg-brand-600"}`}
            style={{ width: pctRev + "%" }}
          />
        </div>
      )}
    </Link>
  );
}
