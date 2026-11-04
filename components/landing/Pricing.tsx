import Link from "next/link";
import { ArrowRight, Check, Minus, Star } from "lucide-react";
import {
  ORDEM_PLANOS,
  PLANOS,
  brlPreco,
  fmtLimite,
  limiteDoRecurso,
  type PlanoDef,
  type PlanoId,
} from "@/lib/plans";

// nome, preço, limites e benefícios vêm de lib/plans.ts (fonte única)
const RESUMO: Record<PlanoId, string> = {
  ambulante: "Para quem vende na rua e quer controlar estoque e vendas no bolso.",
  solo: "Para quem vende sozinha e quer parar com o caderno.",
  equipe: "Para quem tem revendedoras e precisa de comissão no automático.",
  expansao: "Para quem está crescendo e quer escalar sem perder o controle.",
};

type Cel = boolean | string;
const limite = (n: number): Cel => (n === 0 ? false : n === Infinity ? "Ilimitado" : `Até ${fmtLimite(n)}`);

// linhas da comparação, calculadas a partir das capacidades de cada plano
const COMPARACAO: [string, (p: PlanoDef) => Cel][] = [
  ["Estoque em tempo real", () => true],
  ["Venda rápida (balcão e WhatsApp)", () => true],
  ["Relatórios de vendas e lucro", () => true],
  ["Vitrine online com link próprio", () => true],
  ["Chat com o cliente final", (p) => p.allowChat],
  ["Revendedoras com login próprio", (p) => limite(p.maxRevendedoras)],
  ["Vendedores internos", (p) => limite(limiteDoRecurso(p, "vendedores"))],
  ["Comissão automática", (p) => p.maxRevendedoras > 0],
  ["Ranking de revendedoras", (p) => p.allowRanking],
  ["Analytics de vendas (canal e produto)", (p) => p.allowAnalytics],
  ["Tendência e ruptura de estoque", (p) => p.allowAdvancedAnalytics],
  ["Controle de entregas e motoboy", (p) => p.allowEntregas],
  ["Suporte prioritário", (p) => p.beneficios.includes("Suporte prioritário")],
];

function Celula({ v }: { v: Cel }) {
  if (v === true) {
    return (
      <>
        <Check size={17} className="mx-auto text-accent" aria-hidden />
        <span className="sr-only">Incluso</span>
      </>
    );
  }
  if (v === false) {
    return (
      <>
        <Minus size={15} className="mx-auto text-muted opacity-50" aria-hidden />
        <span className="sr-only">Não incluso</span>
      </>
    );
  }
  return <span className="text-sm font-medium whitespace-nowrap">{v}</span>;
}

export default function Pricing() {
  const planos = ORDEM_PLANOS.map((id) => PLANOS[id]);
  return (
    <div>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {planos.map((p) => (
          <li
            key={p.id}
            className={`flex flex-col rounded-2xl border bg-[var(--surface)] p-5 ${
              p.destaque ? "border-brand-500" : "border-default"
            }`}
          >
            <div className="flex min-h-[1.75rem] items-center justify-between gap-2">
              <h3 className="text-lg font-bold">{p.nome}</h3>
              {p.destaque && (
                <span className="badge tone-brand">
                  <Star size={12} aria-hidden /> Recomendado
                </span>
              )}
            </div>
            <p className="mt-3">
              <span className="text-[2rem] font-bold leading-none tracking-tight tnum">{brlPreco(p.precoCentavos)}</span>
              <span className="text-sm text-muted">/mês</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{RESUMO[p.id]}</p>
            <ul className="mt-4 flex-1 space-y-2 border-t border-default pt-4 text-sm">
              {p.beneficios.map((b) => (
                <li key={b} className="flex gap-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden /> {b}
                </li>
              ))}
            </ul>
            <Link href={`/login?plano=${p.id}`} className={`mt-5 ${p.destaque ? "btn-primary" : "btn-ghost"}`}>
              Começar no {p.nome} <ArrowRight size={16} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">Em todos os planos: 1º mês grátis, sem cartão, cancela quando quiser.</p>

      <h3 className="mt-14 text-xl font-bold">Compare os planos</h3>
      <div className="relative mt-4 overflow-x-auto rounded-2xl border border-default">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
          <caption className="sr-only">Recursos incluídos em cada plano</caption>
          <thead>
            <tr className="bg-[var(--surface)]">
              <th scope="col" className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-3 font-medium text-muted">
                O que está incluso
              </th>
              {planos.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  className={`px-3 py-3 text-center font-semibold ${p.destaque ? "text-accent" : ""}`}
                >
                  {p.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARACAO.map(([rotulo, valor]) => (
              <tr key={rotulo} className="border-t border-default">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[11rem] bg-[var(--bg)] px-4 py-2.5 font-normal sm:max-w-none"
                >
                  {rotulo}
                </th>
                {planos.map((p) => (
                  <td key={p.id} className="px-3 py-2.5 text-center">
                    <Celula v={valor(p)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
