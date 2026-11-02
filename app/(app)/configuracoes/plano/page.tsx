"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { usePlano, type SituacaoAssinatura } from "@/lib/usePlano";
import { fmtLimite, brlPreco, limiteDoRecurso } from "@/lib/plans";
import Guard from "@/components/Guard";
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
const STATUS_LABEL: Record<SituacaoAssinatura, { txt: string; cls: string }> = {
  sem_assinatura: { txt: "Sem assinatura", cls: "surface-alt text-muted" },
  trial: { txt: "Teste grátis", cls: "bg-brand-500/15 text-brand-500" },
  trial_vencido: { txt: "Teste encerrado", cls: "bg-red-500/15 text-red-600" },
  ativa: { txt: "Ativa", cls: "bg-green-500/15 text-green-600" },
  pendente: { txt: "Pagamento pendente", cls: "bg-amber-500/15 text-amber-600" },
  cancelada: { txt: "Cancelada", cls: "bg-red-500/15 text-red-600" },
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
  const { defContratado, caps, uso, emTrial, diasTrial, assinatura, situacao, bloqueado } = usePlano();

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
            if (montado.current) setRetorno({ ok: true, msg: "Assinatura confirmada! Seu plano já está ativo." });
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
    return <div className="card text-center text-muted mt-6">Só o dono gerencia a assinatura.</div>;
  }

  const status = STATUS_LABEL[situacao];
  const limRev = caps.maxRevendedoras;
  // limite 0 (Ambulante/piso): sem divisão por zero (NaN na largura da barra)
  const pctRev =
    limRev === Infinity ? 0 : limRev > 0 ? Math.min(100, (uso.revendedoras / limRev) * 100) : uso.revendedoras > 0 ? 100 : 0;
  const temPortal = !!assinatura?.status && assinatura.status !== "trialing";
  const botaoPortal = temPortal && (
    <button
      type="button"
      onClick={abrirPortal}
      disabled={abrindoPortal}
      className={`${situacao === "pendente" ? "btn-primary" : "btn-ghost"} w-full`}
    >
      {abrindoPortal ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
      {situacao === "pendente" ? "Gerenciar pagamento (atualizar cartão)" : "Gerenciar pagamento, faturas ou cancelar"}
    </button>
  );

  return (
    <div className="space-y-4 pb-10">
      <header className="pt-1">
        <Link href="/configuracoes" className="text-sm text-muted flex items-center gap-1 mb-2">
          <ArrowLeft size={15} /> Configurações
        </Link>
        <h1 className="text-2xl font-bold">Assinatura</h1>
      </header>

      {confirmando && (
        <div className="card flex items-center gap-3 text-sm bg-brand-500/5 border-brand-500/30">
          <Loader2 size={18} className="animate-spin text-brand-500 shrink-0" />
          {confirmando}
        </div>
      )}
      {retorno && (
        <div
          className={`card flex items-start gap-3 text-sm ${
            retorno.ok
              ? "bg-green-500/10 border-green-500/30"
              : "bg-amber-500/10 border-amber-500/30"
          }`}
        >
          {retorno.ok ? (
            <Check size={18} className="text-green-600 shrink-0 mt-0.5" />
          ) : (
            <Sparkles size={18} className="text-amber-600 shrink-0 mt-0.5" />
          )}
          <span>{retorno.msg}</span>
        </div>
      )}

      {/* cartão do plano atual */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Crown size={20} className="text-brand-500 shrink-0" />
            <span className="text-lg font-bold truncate">
              {situacao === "sem_assinatura" ? "Nenhum plano" : `Plano ${defContratado.nome}`}
            </span>
          </div>
          <span className={`shrink-0 whitespace-nowrap text-xs font-semibold px-2.5 py-1 rounded-full ${status.cls}`}>
            {status.txt}
          </span>
        </div>
        {situacao !== "sem_assinatura" && (
          <div className="text-sm text-muted">
            {brlPreco(defContratado.precoCentavos)}/mês · {defContratado.publico}
          </div>
        )}
        {emTrial && (
          <div className="rounded-xl bg-brand-500/5 border border-brand-500/30 px-3 py-2 text-sm flex items-center gap-2">
            <Sparkles size={15} className="text-brand-500 shrink-0" />
            <span>
              Teste com acesso total por mais <b>{diasTrial} dia{diasTrial === 1 ? "" : "s"}</b>.
            </span>
          </div>
        )}
        {bloqueado && (
          <div
            role="alert"
            className="rounded-xl bg-red-500/5 border border-red-500/30 px-3 py-2 text-sm flex items-start gap-2"
          >
            <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <span>
              <b>Recursos pagos bloqueados.</b> {MSG_BLOQUEIO[situacao]}
            </span>
          </div>
        )}
        {/* inadimplente: o caminho é o portal (o checkout recusa trocar de plano com fatura pendente) */}
        {situacao === "pendente" && botaoPortal}
        <Link href="/planos" className={`${situacao === "pendente" ? "btn-ghost" : "btn-primary"} w-full`}>
          <Sparkles size={16} />{" "}
          {emTrial
            ? "Escolher meu plano"
            : situacao === "cancelada" || situacao === "trial_vencido" || situacao === "sem_assinatura"
              ? "Assinar um plano"
              : "Mudar de plano"}
        </Link>
        {situacao !== "pendente" && botaoPortal}
      </section>

      {/* uso x limites */}
      <section className="card space-y-4">
        <div className="font-semibold">Uso do plano</div>

        {/* revendedoras */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="flex items-center gap-2">
              <Users size={15} className="text-brand-500" /> Revendedoras
            </span>
            <span className="font-semibold">
              {uso.revendedoras} / {fmtLimite(limRev)}
            </span>
          </div>
          {limRev !== Infinity && (
            <div className="h-2 rounded-full surface-alt overflow-hidden">
              <div
                className={`h-full rounded-full ${pctRev >= 100 ? "bg-red-500" : "bg-brand-600"}`}
                style={{ width: `${pctRev}%` }}
              />
            </div>
          )}
          {limRev === 0 ? (
            <p className="text-xs text-amber-600 mt-1">
              {bloqueado
                ? "Revendedoras ficam bloqueadas até a assinatura ser regularizada."
                : "Seu plano não inclui revendedoras. Faça upgrade para cadastrar."}
            </p>
          ) : (
            limRev !== Infinity &&
            uso.revendedoras >= limRev && (
              <p className="text-xs text-amber-600 mt-1">
                Limite atingido. Faça upgrade ou desative uma revendedora para cadastrar outra.
              </p>
            )
          )}
        </div>

        <LinhaRecurso
          icon={<UserCog size={15} />}
          nome="Vendedores internos"
          valor={`${uso.vendedores} / ${fmtLimite(limiteDoRecurso(caps, "vendedores"))}`}
          liberado={caps.allowVendedores}
        />
        <LinhaRecurso
          icon={<Truck size={15} />}
          nome="Motoboys / entregas"
          valor={`${uso.motoboys} / ${fmtLimite(limiteDoRecurso(caps, "motoboys"))}`}
          liberado={caps.allowMotoboys}
        />
        <LinhaRecurso icon={<BarChart3 size={15} />} nome="Ranking de revendedoras" liberado={caps.allowRanking} />
        <LinhaRecurso icon={<BarChart3 size={15} />} nome="Analytics de vendas" liberado={caps.allowAnalytics} />
        <LinhaRecurso
          icon={<BarChart3 size={15} />}
          nome="Analytics avançado (tendência + ruptura)"
          liberado={caps.allowAdvancedAnalytics}
        />
      </section>
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
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2">
        <span className="text-brand-500">{icon}</span> {nome}
      </span>
      {valor ? (
        <span className={`font-semibold ${liberado ? "" : "text-muted"}`}>{valor}</span>
      ) : liberado ? (
        <span className="text-green-600 flex items-center gap-1 text-xs font-semibold">
          <Check size={14} /> Incluso
        </span>
      ) : (
        <span className="text-muted flex items-center gap-1 text-xs font-semibold">
          <Lock size={13} /> Bloqueado
        </span>
      )}
    </div>
  );
}
