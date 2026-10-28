"use client";

import Link from "next/link";
import { Check, X, ArrowRight, Star } from "lucide-react";
import { ORDEM_PLANOS, PLANOS as PLANOS_DEF, type PlanoId } from "@/lib/plans";

type Plano = {
  id: PlanoId;
  nome: string;
  preco: number;
  resumo: string;
  para: string;
  destaque?: boolean;
  badge?: string;
  cta: string;
};

// textos de marketing por plano; nome, preço e destaque vêm de lib/plans.ts (fonte única)
const TEXTOS: Record<PlanoId, { resumo: string; para: string }> = {
  ambulante: { resumo: "Para quem vende na rua e quer controlar estoque e vendas no bolso.", para: "Vendedor ambulante" },
  solo: { resumo: "Para quem vende sozinha e quer parar com o caderno.", para: "Loja de 1 pessoa" },
  equipe: { resumo: "Para quem tem revendedoras e precisa de comissão no automático.", para: "Loja com equipe e revendedoras" },
  expansao: { resumo: "Para quem está crescendo e quer escalar sem perder o controle.", para: "Várias revendedoras + entregas" },
};

const PLANOS: Plano[] = ORDEM_PLANOS.map((id) => {
  const def = PLANOS_DEF[id];
  const nome = def.nome.toUpperCase();
  return {
    id,
    nome,
    preco: def.precoCentavos / 100,
    ...TEXTOS[id],
    destaque: def.destaque,
    badge: def.destaque ? "⭐ RECOMENDADO" : undefined,
    cta: `Começar no ${nome}`,
  };
});

// linha de comparação: [recurso, ambulante, solo, equipe, expansao]
type Cel = boolean | string;
const COMPARACAO: [string, Cel, Cel, Cel, Cel][] = [
  ["Estoque em tempo real", true, true, true, true],
  ["Venda rápida (balcão + WhatsApp)", true, true, true, true],
  ["Relatórios de vendas e lucro", true, true, true, true],
  ["Vitrine online com link próprio", true, true, true, true],
  ["Chat com o cliente final", true, true, true, true],
  ["Revendedoras com login próprio", "-", "Até 3", "Até 15", "Ilimitado"],
  ["Vendedores internos", "-", "-", "Até 3", "Ilimitado"],
  ["Comissão automática", "-", true, true, true],
  ["Ranking de revendedoras", "-", "-", true, true],
  ["Analytics de vendas (canal/produto)", "-", "-", true, true],
  ["Tendência e ruptura de estoque", "-", "-", "-", true],
  ["Controle de entregas / motoboy", "-", "-", "-", true],
  ["Suporte prioritário", "-", "-", "-", true],
];

function Celula({ v }: { v: boolean | string }) {
  if (v === true) return <Check size={17} className="mx-auto text-brand-600" />;
  if (v === false || v === "-") return <X size={15} className="mx-auto text-muted opacity-40" />;
  return <span className="text-sm font-medium text-strong">{v}</span>;
}

export default function Pricing() {
  return (
    <div>
      {/* cards de plano */}
      <div className="mt-10 grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PLANOS.map((p) => {
          const mensal = p.preco;
          return (
            <div
              key={p.nome}
              className={`card relative flex flex-col transition-all duration-200 hover:-translate-y-1.5 ${
                p.destaque
                  ? "border-brand-500 ring-2 ring-brand-500/40 shadow-pop lg:-mt-3 lg:mb-3 lg:scale-[1.03]"
                  : "hover:border-brand-500/30"
              }`}
            >
              {p.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
                  {p.badge}
                </span>
              )}
              <h3 className="mt-1 text-lg font-bold text-strong">{p.nome}</h3>
              <p className="text-sm text-muted">{p.para}</p>

              <div className="mt-4 flex items-end gap-1">
                <span className="text-sm text-muted">R$</span>
                <span className="text-4xl font-extrabold text-strong">{mensal}</span>
                <span className="mb-1 text-sm text-muted">/mês</span>
              </div>

              <p className="mt-4 text-sm text-muted">{p.resumo}</p>

              <Link
                href={`/login?plano=${p.id}`}
                className={`mt-6 px-5 py-3 text-sm ${p.destaque ? "btn-primary" : "btn-ghost"}`}
              >
                {p.cta} <ArrowRight size={16} />
              </Link>
              <p className="mt-3 text-center text-xs text-muted">
                Teste grátis · sem cartão · cancela quando quiser
              </p>
            </div>
          );
        })}
      </div>

      {/* tabela de comparação */}
      <div className="mt-12 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-default">
              <th className="py-3 pr-4 text-sm font-semibold text-muted">O que está incluso</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-strong">{PLANOS[0].nome}</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-strong">{PLANOS[1].nome}</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-brand-600">
                <span className="inline-flex items-center gap-1">
                  <Star size={13} className="fill-brand-500 text-brand-500" /> {PLANOS[2].nome}
                </span>
              </th>
              <th className="px-4 py-3 text-center text-sm font-bold text-strong">{PLANOS[3].nome}</th>
            </tr>
          </thead>
          <tbody>
            {COMPARACAO.map((linha) => (
              <tr key={linha[0]} className="border-b border-default/60">
                <td className="py-3 pr-4 text-sm text-strong">{linha[0]}</td>
                <td className="px-4 py-3 text-center">
                  <Celula v={linha[1]} />
                </td>
                <td className="px-4 py-3 text-center">
                  <Celula v={linha[2]} />
                </td>
                <td className="bg-brand-500/[0.04] px-4 py-3 text-center">
                  <Celula v={linha[3]} />
                </td>
                <td className="px-4 py-3 text-center">
                  <Celula v={linha[4]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* empurrão psicológico para o upgrade */}
      <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted">
        Tem revendedoras? O <strong className="text-strong">EQUIPE</strong> calcula a comissão de
        cada venda sozinho — <strong className="text-strong">uma comissão paga errada</strong> por
        mês já pode custar mais que a mensalidade.
      </p>
    </div>
  );
}
