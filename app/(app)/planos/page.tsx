"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlano } from "@/lib/usePlano";
import { useStore } from "@/lib/store";
import { ORDEM_PLANOS, PLANOS, brlPreco, type PlanoId } from "@/lib/plans";
import Guard from "@/components/Guard";
import { useMetricaAoAbrir } from "@/lib/metricas/cliente";
import { useDialog } from "@/components/Dialog";
import { Check, Sparkles, Star, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";

export default function PlanosPage() {
  useMetricaAoAbrir({ tipo: "planos_vistos" });
  return (
    <Guard>
      <Planos />
    </Guard>
  );
}

function Planos() {
  const router = useRouter();
  const { assinatura, planoContratado, planoEfetivo, emTrial, diasTrial, uso } = usePlano();
  // "plano atual" = pagando e com o plano valendo; trial vencido, cancelado ou
  // inadimplente precisa poder recontratar o mesmo plano
  const ehAtual = (id: PlanoId) =>
    id === planoContratado && assinatura?.status === "active" && planoEfetivo === id;
  const { confirm, alerta } = useDialog();
  const hydrate = useStore((s) => s.hydrate);
  const [salvando, setSalvando] = useState<PlanoId | null>(null);

  async function selecionar(novo: PlanoId) {
    if (ehAtual(novo)) return;
    const def = PLANOS[novo];

    // aviso de downgrade quando o uso atual estoura o novo limite
    const estourou: string[] = [];
    if (uso.revendedoras > def.maxRevendedoras)
      estourou.push(`${uso.revendedoras} revendedoras (limite ${def.maxRevendedoras})`);
    if (!def.allowVendedores && uso.vendedores > 0) estourou.push(`${uso.vendedores} vendedor(es)`);
    if (!def.allowMotoboys && uso.motoboys > 0) estourou.push(`${uso.motoboys} motoboy(s)`);

    if (estourou.length > 0) {
      const ok = await confirm({
        titulo: `Mudar para o plano ${def.nome}?`,
        mensagem: `Você tem ${estourou.join(
          ", "
        )}. Nada será apagado, mas novos cadastros ficam bloqueados até você ficar dentro do limite.`,
        confirmar: "Confirmar mudança",
        perigo: true,
      });
      if (!ok) return;
    }

    // assina pelo Stripe (redireciona p/ o checkout) ou troca o plano da assinatura atual
    setSalvando(novo);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: novo }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.url) {
        window.location.href = json.url; // checkout do Stripe
        return;
      }
      if (res.ok && json.atualizado) {
        await hydrate();
        setSalvando(null);
        await alerta({
          titulo: `Plano ${def.nome} ativo`,
          mensagem: "A diferença de valor é ajustada proporcionalmente na sua próxima fatura.",
        });
        router.push("/configuracoes/plano");
        return;
      }
      await alerta({ titulo: "Não foi possível iniciar o pagamento", mensagem: json.erro || "Tente novamente." });
      setSalvando(null);
    } catch {
      await alerta({ titulo: "Falha de conexão", mensagem: "Não consegui iniciar o pagamento. Tente novamente." });
      setSalvando(null);
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <header className="pt-1">
        <button onClick={() => router.back()} className="text-sm text-muted flex items-center gap-1 mb-2">
          <ArrowLeft size={15} /> Voltar
        </button>
        <h1 className="text-2xl font-bold">Planos & assinatura</h1>
        <p className="text-sm text-muted">Escolha o plano que acompanha o crescimento da sua loja.</p>
      </header>

      {emTrial && (
        <div className="card bg-brand-500/5 border-brand-500/30 flex items-center gap-3">
          <Sparkles className="text-brand-500 shrink-0" />
          <div className="text-sm">
            <b>Teste grátis ativo</b> - você está com acesso total (Expansão) por mais{" "}
            <b>{diasTrial} dia{diasTrial === 1 ? "" : "s"}</b>. Escolha um plano para continuar sem interrupção.
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start stagger">
        {ORDEM_PLANOS.map((id) => {
          const p = PLANOS[id];
          const atual = ehAtual(id);
          return (
            <div
              key={id}
              className={`card relative flex flex-col transition-transform duration-200 hover:-translate-y-1 ${
                p.destaque ? "ring-2 ring-brand-500 shadow-card lg:scale-[1.03] lg:hover:scale-[1.05]" : ""
              }`}
            >
              {p.destaque && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Star size={12} /> Mais vendido
                </span>
              )}

              <div className="text-center pt-2">
                <div className="font-bold text-lg">{p.nome}</div>
                <div className="text-xs text-muted">{p.publico}</div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold">{brlPreco(p.precoCentavos)}</span>
                  <span className="text-muted text-sm">/mês</span>
                </div>
              </div>

              <ul className="mt-4 space-y-2 flex-1">
                {p.beneficios.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="text-green-500 shrink-0 mt-0.5" /> {b}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => selecionar(id)}
                disabled={atual || salvando !== null}
                className={`mt-5 w-full ${
                  atual ? "btn-ghost opacity-70 cursor-default" : p.destaque ? "btn-primary" : "btn-ghost"
                }`}
              >
                {salvando === id ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Redirecionando…
                  </>
                ) : atual ? (
                  <>
                    <Check size={16} /> Plano atual
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Assinar {p.nome}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card flex items-start gap-3 text-sm text-muted">
        <ShieldCheck size={18} className="text-brand-500 shrink-0 mt-0.5" />
        <div>
          Pagamento seguro pelo <b>Stripe</b>. A cobrança é mensal e recorrente; você cancela quando
          quiser (
          <Link href="/cancelamento" className="font-medium text-brand-500 hover:underline">
            veja como cancelar
          </Link>
          ) e seus dados nunca são apagados. Ao assinar, você é levado ao ambiente seguro do Stripe para
          concluir o pagamento; o AutoManager não recebe o número do seu cartão.
        </div>
      </div>
    </div>
  );
}
