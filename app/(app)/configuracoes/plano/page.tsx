"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { usePlano, type SituacaoAssinatura } from "@/lib/usePlano";
import { fmtLimite, brlPreco, limiteDoRecurso } from "@/lib/plans";
import Guard from "@/components/Guard";
import { Aviso, EstadoVazio, PageHeader, Painel, Progresso, Selo, type Tom } from "@/components/ui";
import {
  Sparkles,
  Check,
  Lock,
  Users,
  UserCog,
  Truck,
  BarChart3,
  ArrowLeft,
  Crown,
  Loader2,
  CreditCard,
  AlertTriangle,
} from "lucide-react";

export default function PlanoAdminPage() {
  return (
    <Guard>
      <PlanoAdmin />
    </Guard>
  );
}

// Selo pela situação efetiva (lib/usePlano), não pelo status cru: sem linha de
// assinatura ou com o ciclo pago vencido a loja está no piso, não "Ativa".
const STATUS_LABEL: Record<SituacaoAssinatura, { txt: string; tom: Tom }> = {
  sem_assinatura: { txt: "Sem assinatura", tom: "neutral" },
  trial: { txt: "Teste grátis", tom: "brand" },
  trial_vencido: { txt: "Teste encerrado", tom: "bad" },
  ativa: { txt: "Ativa", tom: "ok" },
  pendente: { txt: "Pagamento pendente", tom: "warn" },
  cancelada: { txt: "Cancelada", tom: "bad" },
};

// Explicação do bloqueio para quem está no piso (recursos pagos desligados).
const MSG_BLOQUEIO: Partial<Record<SituacaoAssinatura, string>> = {
  sem_assinatura:
    "Sua loja ainda não tem um plano ativo. Revendedoras, vendedores, motoboys, ranking e analytics ficam bloqueados até você assinar.",
  trial_vencido:
    "Seu teste grátis terminou. Revendedoras, vendedores, motoboys, ranking e analytics estão bloqueados até você assinar um plano. Seus dados continuam salvos.",
  cancelada:
    "Sua assinatura foi cancelada. Revendedoras, vendedores, motoboys, ranking e analytics estão bloqueados até você assinar de novo. Seus dados continuam salvos.",
  pendente:
    "Não conseguimos receber o pagamento da sua assinatura. Os recursos pagos estão bloqueados até você atualizar o cartão ou pagar a fatura em Gerenciar pagamento.",
};

// Polling do /api/stripe/confirmar enquanto o 1º pagamento é processado.
const INTERVALO_CONFIRMAR_MS = 3000;
const TENTATIVAS_CONFIRMAR = 10; // ~30 s

function PlanoAdmin() {
  const role = useStore((s) => s.role);
  const hydrate = useStore((s) => s.hydrate);
  const { defContratado, caps, uso, emTrial, diasTrial, assinatura, situacao, bloqueado, assinadoNoTrial } = usePlano();

  const [retorno, setRetorno] = useState<null | { ok: boolean; msg: string }>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const [abrindoPortal, setAbrindoPortal] = useState(false);
  // a confirmação roda uma vez por visita (o StrictMode do dev monta o efeito duas
  // vezes e o 2º já não acharia o ?checkout, que é limpo da URL) e para ao sair da tela
  const confirmacaoIniciada = useRef(false);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // confirma o pagamento ao voltar do Checkout do Stripe (?checkout=sucesso&session_id=cs_...)
  useEffect(() => {
    if (confirmacaoIniciada.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "sucesso") return;
    confirmacaoIniciada.current = true;
    const sessionId = params.get("session_id");
    window.history.replaceState({}, "", "/configuracoes/plano"); // evita reprocessar no refresh

    if (!sessionId) {
      setRetorno({ ok: false, msg: "Pagamento não concluído. Você pode tentar novamente quando quiser." });
      return;
    }

    const confirmar = async () => {
      const r = await fetch("/api/stripe/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      return r.json().catch(() => ({ erro: "Resposta inválida do servidor ao confirmar o pagamento." }));
    };
    const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

    (async () => {
      setConfirmando("Confirmando seu pagamento com o Stripe…");
      try {
        for (let tentativa = 1; ; tentativa++) {
          const j = await confirmar();
          if (!montado.current) return;
          if (j?.plano) {
            await hydrate().catch(() => {});
            if (montado.current)
              setRetorno({
                ok: true,
                msg: j.emTrial
                  ? "Assinatura confirmada! Seu teste grátis continua, e a 1ª cobrança só acontece quando ele acabar."
                  : "Assinatura confirmada! Seu plano já está ativo.",
              });
            return;
          }
          const aguardando =
            j?.resultado === "aguardando_pagamento" || (!j?.erro && j?.status && j.status !== "active");
          if (!aguardando) {
            setRetorno({ ok: false, msg: j?.erro || "Não foi possível confirmar o pagamento agora." });
            return;
          }
          if (tentativa >= TENTATIVAS_CONFIRMAR) {
            // o webhook ativa o plano quando o pagamento for aprovado: relê o que já houver
            await hydrate().catch(() => {});
            if (montado.current)
              setRetorno({
                ok: false,
                msg: "Pagamento em processamento. Assim que for aprovado, seu plano é ativado automaticamente — atualize esta página em alguns minutos.",
              });
            return;
          }
          setConfirmando("Pagamento em processamento. Aguardando a aprovação do Stripe…");
          await esperar(INTERVALO_CONFIRMAR_MS);
          if (!montado.current) return;
        }
      } catch {
        if (montado.current)
          setRetorno({
            ok: false,
            msg: "Falha de conexão ao confirmar o pagamento. Se ele foi aprovado, seu plano é ativado automaticamente em instantes.",
          });
      } finally {
        if (montado.current) setConfirmando(null);
      }
    })();
  }, [hydrate]);

  // Customer Portal do Stripe: trocar cartão, ver faturas, cancelar
  async function abrirPortal() {
    if (abrindoPortal) return;
    setAbrindoPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.url) {
        window.location.href = j.url;
        return;
      }
      setRetorno({ ok: false, msg: j.erro || "Não foi possível abrir o portal de pagamento agora." });
    } catch {
      setRetorno({ ok: false, msg: "Falha de conexão. Tente novamente." });
    }
    setAbrindoPortal(false);
  }

  if (role !== "owner") {
    return (
      <div className="card p-0 mt-6">
        <EstadoVazio icone={Lock} titulo="Só o dono gerencia a assinatura." />
      </div>
    );
  }

  const status = STATUS_LABEL[situacao];
  const limRev = caps.maxRevendedoras;
  // limite 0 (Ambulante/piso): sem divisão por zero (NaN na largura da barra)
  const pctRev =
    limRev === Infinity ? 0 : limRev > 0 ? Math.min(100, (uso.revendedoras / limRev) * 100) : uso.revendedoras > 0 ? 100 : 0;
  const temPortal = !!assinatura?.status && (assinatura.status !== "trialing" || assinadoNoTrial);
  const botaoPortal = temPortal && (
    <button
      type="button"
      onClick={abrirPortal}
      disabled={abrindoPortal}
      className={`${situacao === "pendente" ? "btn-primary" : "btn-ghost"} flex-1 basis-56 text-center leading-snug`}
    >
      {abrindoPortal ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <CreditCard size={16} aria-hidden />}
      {situacao === "pendente" ? "Gerenciar pagamento (atualizar cartão)" : "Gerenciar pagamento, faturas ou cancelar"}
    </button>
  );

  return (
    <div className="space-y-4 md:space-y-5">
      <div>
        <Link href="/configuracoes" className="inline-flex items-center gap-1 min-h-[44px] text-sm text-muted hover:text-strong">
          <ArrowLeft size={15} aria-hidden /> Configurações
        </Link>
        <PageHeader titulo="Assinatura" />
      </div>

      {confirmando && (
        <Aviso tom="brand" icone={Loader2} className="[&>svg]:animate-spin">
          {confirmando}
        </Aviso>
      )}
      {retorno && (
        <Aviso tom={retorno.ok ? "ok" : "warn"} icone={retorno.ok ? Check : AlertTriangle}>
          {retorno.msg}
        </Aviso>
      )}

      {/* cartão do plano atual */}
      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid place-items-center h-10 w-10 shrink-0 rounded-lg tone-brand" aria-hidden>
              <Crown size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight truncate">
                {situacao === "sem_assinatura" ? "Nenhum plano" : `Plano ${defContratado.nome}`}
              </h2>
              {situacao !== "sem_assinatura" && (
                <p className="text-sm text-muted tnum">
                  {brlPreco(defContratado.precoCentavos)}/mês · {defContratado.publico}
                </p>
              )}
            </div>
          </div>
          <Selo tom={status.tom} className="shrink-0">
            {status.txt}
          </Selo>
        </div>
        {emTrial && (
          <Aviso tom="brand" icone={Sparkles}>
            Teste com acesso total por mais{" "}
            <b className="text-strong">
              {diasTrial} dia{diasTrial === 1 ? "" : "s"}
            </b>
            .
          </Aviso>
        )}
        {bloqueado && (
          <div role="alert">
            <Aviso tom="bad" icone={AlertTriangle} titulo="Recursos pagos bloqueados.">
              {MSG_BLOQUEIO[situacao]}
            </Aviso>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {/* inadimplente: o caminho é o portal (o checkout recusa trocar de plano com fatura pendente) */}
          {situacao === "pendente" && botaoPortal}
          <Link href="/planos" className={`${situacao === "pendente" ? "btn-ghost" : "btn-primary"} flex-1 basis-56`}>
            <Sparkles size={16} aria-hidden />{" "}
            {emTrial
              ? "Escolher meu plano"
              : situacao === "cancelada" || situacao === "trial_vencido" || situacao === "sem_assinatura"
                ? "Assinar um plano"
                : "Mudar de plano"}
          </Link>
          {situacao !== "pendente" && botaoPortal}
        </div>
      </section>

      {/* uso x limites */}
      <Painel titulo="Uso do plano" lista>
        {/* revendedoras */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <Users size={15} className="text-muted shrink-0" aria-hidden /> Revendedoras
            </span>
            <span className="font-semibold tnum shrink-0">
              {uso.revendedoras} / {fmtLimite(limRev)}
            </span>
          </div>
          {limRev !== Infinity && (
            <Progresso
              className="mt-2 h-1.5"
              pct={pctRev}
              tom={pctRev >= 100 ? "bad" : "brand"}
              rotulo="Revendedoras usadas do limite do plano"
            />
          )}
          {limRev === 0 ? (
            <p className="hint text-warn">
              {bloqueado
                ? "Revendedoras ficam bloqueadas até a assinatura ser regularizada."
                : "Seu plano não inclui revendedoras. Faça upgrade para cadastrar."}
            </p>
          ) : (
            limRev !== Infinity &&
            uso.revendedoras >= limRev && (
              <p className="hint text-warn">
                Limite atingido. Faça upgrade ou desative uma revendedora para cadastrar outra.
              </p>
            )
          )}
        </div>

        <LinhaRecurso
          icon={<UserCog size={15} aria-hidden />}
          nome="Vendedores internos"
          valor={`${uso.vendedores} / ${fmtLimite(limiteDoRecurso(caps, "vendedores"))}`}
          liberado={caps.allowVendedores}
        />
        <LinhaRecurso
          icon={<Truck size={15} aria-hidden />}
          nome="Motoboys / entregas"
          valor={`${uso.motoboys} / ${fmtLimite(limiteDoRecurso(caps, "motoboys"))}`}
          liberado={caps.allowMotoboys}
        />
        <LinhaRecurso icon={<BarChart3 size={15} aria-hidden />} nome="Ranking de revendedoras" liberado={caps.allowRanking} />
        <LinhaRecurso icon={<BarChart3 size={15} aria-hidden />} nome="Analytics de vendas" liberado={caps.allowAnalytics} />
        <LinhaRecurso
          icon={<BarChart3 size={15} aria-hidden />}
          nome="Analytics avançado (tendência + ruptura)"
          liberado={caps.allowAdvancedAnalytics}
        />
      </Painel>
    </div>
  );
}

function LinhaRecurso({
  icon,
  nome,
  valor,
  liberado,
}: {
  icon: React.ReactNode;
  nome: string;
  valor?: string;
  liberado: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-muted shrink-0">{icon}</span> {nome}
      </span>
      {valor ? (
        <span className={`font-semibold tnum shrink-0 ${liberado ? "" : "text-muted"}`}>{valor}</span>
      ) : liberado ? (
        <Selo tom="ok" icone={Check} className="shrink-0">
          Incluso
        </Selo>
      ) : (
        <Selo icone={Lock} className="shrink-0">
          Bloqueado
        </Selo>
      )}
    </div>
  );
}
