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
import { Aviso, PageHeader, Selo } from "@/components/ui";
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
  const { assinatura, planoContratado, planoEfetivo, emTrial, assinadoNoTrial, diasTrial, cobrancaNoFimDoTrial, uso } =
    usePlano();
  // "plano atual" = pagando e com o plano valendo; trial vencido, cancelado ou
  // inadimplente precisa poder recontratar o mesmo plano
  const ehAtual = (id: PlanoId) =>
    id === planoContratado && (assinadoNoTrial || (assinatura?.status === "active" && planoEfetivo === id));
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
    <div className="space-y-4 md:space-y-5">
      <div>
        {/* destino fixo: router.back() depois de cancelar no Stripe voltaria ao Checkout */}
        <Link href="/configuracoes/plano" className="inline-flex items-center gap-1 min-h-[36px] w-fit text-sm text-muted hover:text-strong">
          <ArrowLeft size={15} aria-hidden /> Voltar
        </Link>
        <PageHeader titulo="Planos & assinatura" descricao="Escolha o plano que acompanha o crescimento da sua loja." />
      </div>

      {aviso && (
        <div role="status">
          <Aviso
            tom="warn"
            icone={Info}
            acao={
              <button
                type="button"
                onClick={() => setAviso(null)}
                aria-label="Fechar aviso"
                className="icon-btn -my-2 -mr-2"
              >
                <X size={16} aria-hidden />
              </button>
            }
          >
            {aviso}
          </Aviso>
        </div>
      )}

      {emTrial && (
        <Aviso tom="brand" icone={Sparkles} titulo="Teste grátis ativo">
          Você está com acesso total (Expansão) por mais{" "}
          <b className="text-strong">
            {diasTrial} dia{diasTrial === 1 ? "" : "s"}
          </b>
          .{" "}
          {assinadoNoTrial ? (
            <>
              Você já assinou o plano <b className="text-strong">{PLANOS[planoContratado].nome}</b>: ele começa quando o teste
              acabar{fimTrial ? <>, em <b className="text-strong tnum">{fimTrial}</b></> : null}, e só então vem a 1ª cobrança.
            </>
          ) : cobrancaNoFimDoTrial ? (
            <>
              Assine agora sem custo: a 1ª cobrança só acontece quando o teste acabar
              {fimTrial ? <>, em <b className="text-strong tnum">{fimTrial}</b></> : null}.
            </>
          ) : (
            <>Seu teste está no fim: ao assinar, a 1ª cobrança é feita na hora.</>
          )}
        </Aviso>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        {ORDEM_PLANOS.map((id) => {
          const p = PLANOS[id];
          const atual = ehAtual(id);
          return (
            <section
              key={id}
              className={`card flex flex-col min-w-0 ${p.destaque ? "border-brand-500/60 ring-1 ring-brand-500/60" : ""}`}
            >
              <div className="flex items-center justify-between gap-2 min-h-[24px]">
                <h2 className="text-lg font-bold leading-tight">{p.nome}</h2>
                {p.destaque && (
                  <Selo tom="brand" icone={Star}>
                    Mais vendido
                  </Selo>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5 min-h-[2rem]">{p.publico}</p>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="figure text-3xl">{brlPreco(p.precoCentavos)}</span>
                <span className="text-muted text-sm">/mês</span>
              </div>
              {cobrancaNoFimDoTrial && !atual && (
                <div className="text-xs text-accent font-medium mt-1">
                  Grátis até o fim do teste{fimTrial ? ` (${fimTrial})` : ""}
                </div>
              )}

              <ul className="mt-4 pt-4 border-t border-default space-y-2 flex-1">
                {p.beneficios.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <Check size={15} className="text-ok shrink-0 mt-0.5" aria-hidden /> {b}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => selecionar(id)}
                disabled={atual || ocupado}
                className={`mt-5 w-full whitespace-nowrap ${
                  atual ? "btn-ghost cursor-default" : p.destaque ? "btn-primary" : "btn-ghost"
                }`}
              >
                {salvando === id ? (
                  <>
                    <Loader2 className="animate-spin" size={18} aria-hidden /> Aguarde…
                  </>
                ) : atual ? (
                  <>
                    <Check size={16} aria-hidden /> Plano atual
                  </>
                ) : (
                  <>
                    <Sparkles size={16} aria-hidden /> {cobrancaNoFimDoTrial ? "Escolher" : "Assinar"} {p.nome}
                  </>
                )}
              </button>
            </section>
          );
        })}
      </div>

      <div className="flex items-start gap-3 px-1 text-sm text-muted">
        <ShieldCheck size={18} className="text-ok shrink-0 mt-0.5" aria-hidden />
        <p className="max-w-3xl">
          Pagamento seguro pelo <b className="text-strong">Stripe</b>. A cobrança é mensal e recorrente
          {cobrancaNoFimDoTrial ? " e só começa no fim do teste grátis" : ""}; você cancela quando
          quiser (
          <Link href="/cancelamento" className="font-medium text-accent hover:underline">
            veja como cancelar
          </Link>
          ) e seus dados não são apagados ao cancelar. Ao assinar, você é levado ao ambiente seguro do Stripe para
          concluir o pagamento; o AutoManager não recebe o número do seu cartão.
        </p>
      </div>
    </div>
  );
}
