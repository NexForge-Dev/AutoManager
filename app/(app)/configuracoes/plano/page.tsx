"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { usePlano } from "@/lib/usePlano";
import { fmtLimite, brlPreco, limiteDoRecurso } from "@/lib/plans";
import Guard from "@/components/Guard";
import { Sparkles, Check, Lock, Users, UserCog, Truck, BarChart3, ArrowLeft, Crown, Loader2, CreditCard } from "lucide-react";

export default function PlanoAdminPage() {
  return (
    <Guard>
      <PlanoAdmin />
    </Guard>
  );
}

const STATUS_LABEL: Record<string, { txt: string; cls: string }> = {
  trialing: { txt: "Teste grátis", cls: "bg-brand-500/15 text-brand-500" },
  active: { txt: "Ativa", cls: "bg-green-500/15 text-green-600" },
  past_due: { txt: "Pagamento pendente", cls: "bg-amber-500/15 text-amber-600" },
  canceled: { txt: "Cancelada", cls: "bg-red-500/15 text-red-600" },
};

function PlanoAdmin() {
  const role = useStore((s) => s.role);
  const hydrate = useStore((s) => s.hydrate);
  const { defContratado, caps, uso, emTrial, diasTrial, assinatura } = usePlano();

  const [retorno, setRetorno] = useState<null | { ok: boolean; msg: string }>(null);
  const [confirmando, setConfirmando] = useState(false);

  const [abrindoPortal, setAbrindoPortal] = useState(false);

  // confirma o pagamento ao voltar do Checkout do Stripe (?checkout=sucesso&session_id=cs_...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "sucesso") return;
    const sessionId = params.get("session_id");
    window.history.replaceState({}, "", "/configuracoes/plano"); // evita reprocessar no refresh

    if (!sessionId) {
      setRetorno({ ok: false, msg: "Pagamento não concluído. Você pode tentar novamente quando quiser." });
      return;
    }
    setConfirmando(true);
    fetch("/api/stripe/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then(async (j) => {
        if (j?.plano) {
          await hydrate();
          setRetorno({ ok: true, msg: "Assinatura confirmada! Seu plano já está ativo." });
        } else if (j?.resultado === "aguardando_pagamento" || (j?.status && j.status !== "active")) {
          setRetorno({
            ok: false,
            msg: "Pagamento em processamento. Assim que for aprovado, seu plano é ativado automaticamente.",
          });
        } else {
          setRetorno({ ok: false, msg: j?.erro || "Não foi possível confirmar o pagamento agora." });
        }
      })
      .catch(() => setRetorno({ ok: false, msg: "Falha ao confirmar o pagamento." }))
      .finally(() => setConfirmando(false));
  }, [hydrate]);

  // Customer Portal do Stripe: trocar cartão, ver faturas, cancelar
  async function abrirPortal() {
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

  const status = STATUS_LABEL[assinatura?.status ?? "active"] || STATUS_LABEL.active;
  const limRev = caps.maxRevendedoras;
  const pctRev = limRev === Infinity ? 0 : Math.min(100, (uso.revendedoras / limRev) * 100);

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
          Confirmando seu pagamento com o Stripe…
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={20} className="text-brand-500" />
            <span className="text-lg font-bold">Plano {defContratado.nome}</span>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.cls}`}>{status.txt}</span>
        </div>
        <div className="text-sm text-muted">
          {brlPreco(defContratado.precoCentavos)}/mês · {defContratado.publico}
        </div>
        {emTrial && (
          <div className="rounded-xl bg-brand-500/5 border border-brand-500/30 px-3 py-2 text-sm flex items-center gap-2">
            <Sparkles size={15} className="text-brand-500" />
            Teste com acesso total por mais <b>{diasTrial} dia{diasTrial === 1 ? "" : "s"}</b>.
          </div>
        )}
        <Link href="/planos" className="btn-primary w-full">
          <Sparkles size={16} /> {emTrial ? "Escolher meu plano" : "Mudar de plano"}
        </Link>
        {assinatura?.status && assinatura.status !== "trialing" && (
          <button onClick={abrirPortal} disabled={abrindoPortal} className="btn-ghost w-full">
            {abrindoPortal ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
            Gerenciar pagamento, faturas ou cancelar
          </button>
        )}
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
          {limRev !== Infinity && uso.revendedoras >= limRev && (
            <p className="text-xs text-amber-600 mt-1">
              Limite atingido. Faça upgrade ou desative uma revendedora para cadastrar outra.
            </p>
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
