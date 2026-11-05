"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { calcularMetricas, brl, brlKpi } from "@/lib/analytics";
import { usePlano } from "@/lib/usePlano";
import { fmtLimite } from "@/lib/plans";
import { FUSO_LOJA } from "@/lib/fuso";
import Guard from "@/components/Guard";
import Reporte from "@/components/Reporte";
import CountUp from "@/components/CountUp";
import { Aviso, EstadoVazio, LinkAcao, PageHeader, Painel as Bloco, Progresso, Selo, Stat, Variacao } from "@/components/ui";
import Link from "next/link";
// recharts é pesado: carrega só quando o painel monta, fora do bundle inicial.
const VendasArea = dynamic(() => import("@/components/charts/VendasArea"), {
  ssr: false,
  loading: () => <div style={{ height: 200 }} className="skeleton rounded-xl" />,
});
import {
  TrendingUp,
  Wallet,
  Package,
  AlertTriangle,
  Trophy,
  BarChart3,
  PackageX,
  Crown,
  Inbox,
  Lock,
  HandCoins,
  ShoppingBag,
  ChevronRight,
  Receipt,
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

  const hoje = new Date().toLocaleDateString("pt-BR", {
    timeZone: FUSO_LOJA,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const total14dias = m.vendasPorDia.reduce((a, d) => a + d.total, 0);
  const maiorRanking = m.rankingRevendedoras[0]?.total || 0;
  const maiorProduto = m.topProdutos[0]?.qtd || 0;
  const mostraRanking = caps.allowRanking && config.usaRevendedoras && m.rankingRevendedoras.length > 0;

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        titulo="Visão geral"
        descricao={<span className="first-letter:uppercase inline-block">{hoje}</span>}
        acoes={
          <Link href="/relatorios" className="btn-ghost btn-sm">
            <BarChart3 size={16} aria-hidden /> Relatórios
          </Link>
        }
      />

      <PlanoBloqueado />

      {/* primeiros passos: loja sem vendas ainda */}
      {vendas.length === 0 && (
        <div className="card p-0">
          <EstadoVazio
            icone={ShoppingBag}
            titulo="Registre sua primeira venda"
            acao={
              <Link href={produtos.length === 0 ? "/produtos" : "/vender"} className="btn-primary">
                {produtos.length === 0 ? "Cadastrar produto" : "Fazer uma venda"}
              </Link>
            }
          >
            {produtos.length === 0
              ? "Comece cadastrando um produto. Depois, a venda leva só um toque."
              : "É só um toque. Faturamento e lucro aparecem aqui assim que você vender."}
          </EstadoVazio>
        </div>
      )}

      {/* indicadores do mês */}
      <div className="grid-kpi lg:grid-cols-4 gap-3 stagger">
        <Stat
          rotulo="Faturamento do mês"
          icone={Wallet}
          tom="brand"
          valor={<CountUp value={m.faturamentoMes} format={brlKpi} />}
          apoio={variacao !== null ? <Variacao pct={variacao} sufixo="vs mês anterior" /> : "no mês atual"}
        />
        <Stat
          rotulo="Lucro estimado"
          icone={TrendingUp}
          tom={m.lucroMes < 0 ? "bad" : "ok"}
          valorTom={m.lucroMes < 0 ? "bad" : "ok"}
          valor={<CountUp value={m.lucroMes} format={brlKpi} />}
          apoio={
            m.faturamentoMes > 0
              ? `margem de ${Math.round((m.lucroMes / m.faturamentoMes) * 100)}% no mês`
              : "no mês atual"
          }
        />
        <Stat
          rotulo="Comissão pendente"
          icone={HandCoins}
          tom="warn"
          valor={<CountUp value={m.comissaoPendente} format={brlKpi} />}
          apoio="a repassar"
        />
        <Stat
          rotulo="Valor em estoque"
          icone={Package}
          valor={<CountUp value={m.valorEstoque} format={brlKpi} />}
          apoio="a preço de custo"
        />
      </div>

      {/* pendências que pedem ação */}
      {(recebimentosPendentes > 0 || m.qtdReposicao > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {/* só com pendências: não há importação automática de recebimentos */}
          {recebimentosPendentes > 0 && (
            <Aviso
              tom="brand"
              icone={Inbox}
              titulo={
                recebimentosPendentes === 1
                  ? "1 recebimento para confirmar"
                  : `${recebimentosPendentes} recebimentos para confirmar`
              }
              acao={<LinkAcao href="/recebimentos">Ver</LinkAcao>}
            >
              Confirme se foi venda para entrar no caixa.
            </Aviso>
          )}
          {m.qtdReposicao > 0 && (
            <Aviso
              tom="warn"
              icone={AlertTriangle}
              titulo={m.qtdReposicao === 1 ? "1 produto para repor" : `${m.qtdReposicao} produtos para repor`}
              acao={<LinkAcao href="/reposicao">Ver</LinkAcao>}
            >
              Veja o que comprar.
            </Aviso>
          )}
        </div>
      )}

      <div className="grid gap-4 md:gap-5 lg:grid-cols-3 items-start">
        <div className="space-y-4 md:space-y-5 lg:col-span-2 min-w-0">
          {/* gráfico */}
          {vendas.length > 0 && (
            <Bloco
              titulo="Vendas nos últimos 14 dias"
              acao={<span className="text-sm font-semibold tnum">{brl(total14dias)}</span>}
            >
              <VendasArea data={m.vendasPorDia} height={200} />
            </Bloco>
          )}

          <div className={`grid gap-4 md:gap-5 ${mostraRanking ? "xl:grid-cols-2" : ""}`}>
            {/* top produtos */}
            {m.topProdutos.length > 0 && (
              <Bloco titulo="Mais vendidos" icone={Receipt}>
                <div className="space-y-3">
                  {m.topProdutos.map((p) => (
                    <div key={p.nome}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium truncate">{p.nome}</span>
                        <span className="text-muted tnum shrink-0">{p.qtd} un</span>
                      </div>
                      <Progresso className="mt-1" pct={maiorProduto ? (p.qtd / maiorProduto) * 100 : 0} />
                    </div>
                  ))}
                </div>
              </Bloco>
            )}

            {/* ranking revendedoras (plano Equipe+) */}
            {mostraRanking && (
              <Bloco
                titulo="Ranking de revendedoras"
                icone={Trophy}
                acao={<LinkAcao href="/revendedoras">Ver</LinkAcao>}
              >
                <div className="space-y-3">
                  {m.rankingRevendedoras.map((r, i) => (
                    // nomes podem repetir (homônimas, "-" de revendedora removida): posição + nome
                    <div key={r.id ?? `${i}-${r.nome}`}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-muted tnum w-5 shrink-0">{i + 1}º</span>
                          <span className="font-medium truncate">{r.nome}</span>
                        </span>
                        <span className="tnum shrink-0">{brl(r.total)}</span>
                      </div>
                      <Progresso className="mt-1" pct={maiorRanking ? (r.total / maiorRanking) * 100 : 0} />
                    </div>
                  ))}
                </div>
              </Bloco>
            )}
          </div>
        </div>

        <div className="space-y-4 md:space-y-5 min-w-0">
          {/* estoque crítico: sempre visível quando há */}
          {criticos.length > 0 && (
            <Bloco titulo="Estoque crítico" icone={PackageX} lista acao={<LinkAcao href="/reposicao">Repor</LinkAcao>}>
              {criticos.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="truncate">{p.nome}</span>
                  <Selo tom={p.estoqueAtual <= 0 ? "bad" : "warn"} className="tnum shrink-0">
                    {p.estoqueAtual} un.
                  </Selo>
                </div>
              ))}
              {criticos.length > 6 && (
                <div className="px-4 py-2.5 text-xs text-muted">+ {criticos.length - 6} outros produtos</div>
              )}
            </Bloco>
          )}

          <PlanoCard />

          {/* suporte: reportar problema / abrir ticket */}
          <Reporte />
        </div>
      </div>
    </div>
  );
}

// sem assinatura / teste vencido / cancelada / inadimplente: a loja está no piso
function PlanoBloqueado() {
  const { defContratado, situacao, bloqueado } = usePlano();
  if (!bloqueado) return null;
  const motivoBloqueio =
    situacao === "sem_assinatura"
      ? "Sem assinatura"
      : situacao === "trial_vencido"
        ? "Teste encerrado"
        : situacao === "cancelada"
          ? "Assinatura cancelada"
          : "Pagamento pendente";
  return (
    <Aviso
      tom="bad"
      icone={Lock}
      titulo={
        <span className="flex flex-wrap items-center gap-2">
          {situacao === "sem_assinatura" ? "Nenhum plano ativo" : `Plano ${defContratado.nome}`}
          <Selo tom="bad">{motivoBloqueio}</Selo>
        </span>
      }
      acao={
        <Link href="/planos" className="btn-primary btn-sm">
          {situacao === "pendente" ? "Regularizar pagamento" : "Assinar um plano"}
        </Link>
      }
    >
      Revendedoras, vendedores, motoboys, ranking e analytics estão bloqueados. Seus dados continuam salvos.
    </Aviso>
  );
}

function PlanoCard() {
  const { defContratado, caps, uso, emTrial, diasTrial, assinatura, bloqueado } = usePlano();
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
  if (bloqueado) return null; // já avisado no topo da tela
  return (
    <Link href="/configuracoes/plano" className="card block">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold min-w-0">
          <Crown size={16} className="text-muted shrink-0" aria-hidden />
          {emTrial ? (
            <span className="truncate">Teste grátis</span>
          ) : (
            <span className="truncate">Plano {defContratado.nome}</span>
          )}
          {emTrial && (
            <Selo tom="brand" className="shrink-0">
              {diasTrial} dia{diasTrial === 1 ? "" : "s"}
            </Selo>
          )}
        </div>
        <span className="shrink-0 text-sm text-accent font-medium flex items-center">
          Gerenciar <ChevronRight size={15} aria-hidden />
        </span>
      </div>
      {emTrial && (
        <p className="mt-1.5 text-xs text-muted">
          Recursos do <b>{caps.nome}</b>{ate ? <> até <b>{ate}</b></> : null}.
          {defContratado.id !== caps.id && (
            <>
              {" "}Depois, plano <b>{defContratado.nome}</b>.
            </>
          )}
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">Revendedoras</span>
        <span className="font-semibold text-right tnum">
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
        <Progresso className="mt-1.5" pct={pctRev} tom={pctRev >= 100 ? "bad" : "brand"} rotulo="Revendedoras em uso" />
      )}
    </Link>
  );
}
