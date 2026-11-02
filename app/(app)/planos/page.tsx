"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlano } from "@/lib/usePlano";
import { useStore } from "@/lib/store";
import { ORDEM_PLANOS, PLANOS, brlPreco, type PlanoId } from "@/lib/plans";
import Guard from "@/components/Guard";
import { useMetricaAoAbrir } from "@/lib/metricas/cliente";
import { useDialog } from "@/components/Dialog";
import { FUSO_LOJA } from "@/lib/fuso";
import { Check, Sparkles, Star, Loader2, ArrowLeft, ShieldCheck, Info, X } from "lucide-react";

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
  const { assinatura, planoContratado, planoEfetivo, emTrial, diasTrial, cobrancaNoFimDoTrial, uso } = usePlano();
  // "plano atual" = pagando e com o plano valendo; trial vencido, cancelado ou
  // inadimplente precisa poder recontratar o mesmo plano
  const ehAtual = (id: PlanoId) =>
    id === planoContratado && assinatura?.status === "active" && planoEfetivo === id;
  const { confirm, alerta } = useDialog();
  const hydrate = useStore((s) => s.hydrate);
  const [salvando, setSalvando] = useState<PlanoId | null>(null);
  const [abrindoPortal, setAbrindoPortal] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // trava síncrona: o disabled só vale no próximo render e um duplo clique rápido
  // abriria dois checkouts
  const ocupadoRef = useRef(false);
  const ocupado = salvando !== null || abrindoPortal;

  // fim do teste (= 1ª cobrança ao assinar agora), no fuso da loja
  const fimTrial =
    emTrial && assinatura?.trialAte
      ? new Date(assinatura.trialAte).toLocaleDateString("pt-BR", {
          timeZone: FUSO_LOJA,
          day: "2-digit",
          month: "2-digit",
        })
      : null;

  // volta do Checkout do Stripe sem pagar (cancel_url = /planos?checkout=cancelado)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "cancelado") return;
    window.history.replaceState({}, "", "/planos");
    setAviso("Pagamento não concluído. Nenhuma cobrança foi feita.");
  }, []);

  // Customer Portal do Stripe: regularizar cartão/fatura pendente
  async function abrirPortal() {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setAbrindoPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.url) {
        window.location.href = j.url;
        return; // continua travado enquanto o navegador sai da página
      }
      await alerta({
        titulo: "Não foi possível abrir o portal de pagamento",
        mensagem: j.erro || "Tente novamente em instantes.",
      });
    } catch {
      await alerta({ titulo: "Falha de conexão", mensagem: "Não consegui abrir o portal de pagamento. Tente novamente." });
    }
    ocupadoRef.current = false;
    setAbrindoPortal(false);
  }

  async function selecionar(novo: PlanoId) {
    if (ehAtual(novo) || ocupadoRef.current) return;
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
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setSalvando(novo);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: novo }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.url) {
        window.location.href = json.url; // checkout do Stripe (continua travado até sair da página)
        return;
      }
      if (res.ok && json.atualizado) {
        // o plano já mudou no servidor: falha ao recarregar não é falha da troca
        await hydrate().catch(() => {});
        ocupadoRef.current = false;
        setSalvando(null);
        await alerta({
          titulo: `Plano ${def.nome} ativo`,
          // a troca usa proration "always_invoice": a diferença é faturada na hora
          mensagem: "Se houver diferença de valor, ela é cobrada (ou creditada) proporcionalmente agora.",
        });
        router.push("/configuracoes/plano");
        return;
      }
      ocupadoRef.current = false;
      setSalvando(null);
      // pagamento pendente / cartão recusado: só dá para resolver no portal do Stripe
      if (json.portal === true) {
        const abrir = await confirm({
          titulo: "Regularize o pagamento",
          mensagem: json.erro || "Há um pagamento pendente na sua assinatura.",
          confirmar: "Gerenciar pagamento",
          cancelar: "Agora não",
        });
        if (abrir) await abrirPortal();
        return;
      }
      await alerta({
        titulo: "Não foi possível iniciar o pagamento",
        mensagem: json.erro || "Tente novamente em instantes.",
      });
    } catch {
      ocupadoRef.current = false;
      setSalvando(null);
      await alerta({ titulo: "Falha de conexão", mensagem: "Não consegui iniciar o pagamento. Tente novamente." });
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <header className="pt-1">
        {/* destino fixo: router.back() depois de cancelar no Stripe voltaria ao Checkout */}
        <Link href="/configuracoes/plano" className="text-sm text-muted flex items-center gap-1 mb-2 w-fit">
          <ArrowLeft size={15} /> Voltar
        </Link>
        <h1 className="text-2xl font-bold">Planos & assinatura</h1>
        <p className="text-sm text-muted">Escolha o plano que acompanha o crescimento da sua loja.</p>
      </header>

      {aviso && (
        <div role="status" className="card flex items-start gap-3 text-sm bg-amber-500/10 border-amber-500/30">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <span className="flex-1">{aviso}</span>
          <button
            type="button"
            onClick={() => setAviso(null)}
            aria-label="Fechar aviso"
            className="text-muted hover:text-strong shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {emTrial && (
        <div className="card bg-brand-500/5 border-brand-500/30 flex items-center gap-3">
          <Sparkles className="text-brand-500 shrink-0" />
          <div className="text-sm">
            <b>Teste grátis ativo</b> - você está com acesso total (Expansão) por mais{" "}
            <b>{diasTrial} dia{diasTrial === 1 ? "" : "s"}</b>.{" "}
            {cobrancaNoFimDoTrial ? (
              <>
                Assine agora sem custo: a 1ª cobrança só acontece quando o teste acabar
                {fimTrial ? <>, em <b>{fimTrial}</b></> : null}.
              </>
            ) : (
              <>Seu teste está no fim: ao assinar, a 1ª cobrança é feita na hora.</>
            )}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 pt-3 items-start stagger">
        {ORDEM_PLANOS.map((id) => {
          const p = PLANOS[id];
          const atual = ehAtual(id);
          return (
            <div
              key={id}
              className={`card relative flex flex-col transition-transform duration-200 hover:-translate-y-1 ${
                p.destaque ? "ring-2 ring-brand-500 shadow-card xl:scale-[1.03] xl:hover:scale-[1.05]" : ""
              }`}
            >
              {p.destaque && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
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
                {cobrancaNoFimDoTrial && !atual && (
                  <div className="text-xs text-brand-500 font-medium mt-1">
                    Grátis até o fim do teste{fimTrial ? ` (${fimTrial})` : ""}
                  </div>
                )}
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
                disabled={atual || ocupado}
                className={`mt-5 w-full whitespace-nowrap ${
                  atual ? "btn-ghost opacity-70 cursor-default" : p.destaque ? "btn-primary" : "btn-ghost"
                }`}
              >
                {salvando === id ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Aguarde…
                  </>
                ) : atual ? (
                  <>
                    <Check size={16} /> Plano atual
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> {cobrancaNoFimDoTrial ? "Escolher" : "Assinar"} {p.nome}
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
          Pagamento seguro pelo <b>Stripe</b>. A cobrança é mensal e recorrente
          {cobrancaNoFimDoTrial ? " e só começa no fim do teste grátis" : ""}; você cancela quando
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
