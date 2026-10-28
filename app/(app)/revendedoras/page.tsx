"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { brl } from "@/lib/analytics";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import { Plus, X, MessageCircle, BadgeDollarSign, Target, Pencil, KeyRound, Check, Mail } from "lucide-react";
import type { Revendedora } from "@/lib/types";
import type { Resultado } from "@/lib/store";
import { usePlano } from "@/lib/usePlano";
import { UpgradeModal } from "@/components/UpgradeGate";
import { planoQueLibera, fmtLimite } from "@/lib/plans";

export default function RevendedorasPage() {
  return (
    <Guard>
      <Revendedoras />
    </Guard>
  );
}

function Revendedoras() {
  const { revendedoras, vendas, config, addRevendedora, updateRevendedora, marcarComissaoPaga } =
    useStore();
  const { caps, uso, limiteAtingido } = usePlano();
  const { prompt, confirm, alerta } = useDialog();
  const [aberto, setAberto] = useState(false);
  const [upsell, setUpsell] = useState(false);
  const [nome, setNome] = useState("");
  const [whats, setWhats] = useState("");
  const [emailNova, setEmailNova] = useState("");
  const [comissao, setComissao] = useState(String(config.comissaoPadrao));
  const [meta, setMeta] = useState("");

  const noLimite = limiteAtingido("revendedoras");
  const planoUpgrade = planoQueLibera((p) => p.maxRevendedoras > uso.revendedoras);

  function novaRevendedora() {
    if (noLimite) setUpsell(true);
    else setAberto(true);
  }

  const inicioMes = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  })();

  // vendas com comissão a pagar (as MESMAS que são somadas e depois marcadas)
  function vendasPendentes(id: string) {
    return vendas.filter(
      (v) =>
        v.revendedoraId === id &&
        v.statusComissao === "pendente" &&
        v.statusPagamento !== "cancelada"
    );
  }
  function vendidoNoMes(id: string) {
    return vendas
      .filter(
        (v) =>
          v.revendedoraId === id && v.statusPagamento !== "cancelada" && v.data >= inicioMes
      )
      .reduce((a, v) => a + v.total, 0);
  }

  async function salvar() {
    if (!nome) return;
    const res = await addRevendedora({
      nome,
      whatsapp: whats,
      email: emailNova.trim().toLowerCase() || null,
      comissaoPercent: parseFloat(comissao) || config.comissaoPadrao,
      metaMensal: parseFloat(meta) || 0,
    });
    if (!res.ok) {
      alerta({ titulo: "Não foi possível cadastrar", mensagem: res.erro || "Tente novamente." });
      return;
    }
    setNome("");
    setWhats("");
    setEmailNova("");
    setMeta("");
    setAberto(false);
  }

  async function editarMeta(id: string, atual: number) {
    const v = await prompt({
      titulo: "Meta do mês",
      mensagem: "Defina a meta de vendas mensal (R$):",
      valorInicial: String(atual || ""),
      tipo: "number",
      inputMode: "decimal",
      confirmar: "Salvar",
    });
    if (v === null) return;
    const res = await updateRevendedora(id, { metaMensal: parseFloat(v) || 0 });
    if (!res.ok) alerta({ titulo: "Não foi possível salvar a meta", mensagem: res.erro || "Tente novamente." });
  }

  // congela a lista de vendas somadas no momento do clique: só elas são pagas
  async function pagarComissao(id: string, nome: string, vendaIds: string[], valor: number) {
    const ok = await confirm({
      titulo: "Confirmar pagamento",
      mensagem: `Marcar ${brl(valor)} (${vendaIds.length} venda(s)) como pago para ${nome}?`,
      confirmar: "Marcar como pago",
    });
    if (!ok) return;
    const res = await marcarComissaoPaga(id, vendaIds);
    if (!res.ok) alerta({ titulo: "Não foi possível marcar como pago", mensagem: res.erro || "Tente novamente." });
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-2xl font-bold">Revendedoras</h1>
          <p className="text-xs text-muted">
            {uso.revendedoras} / {fmtLimite(caps.maxRevendedoras)} no seu plano
          </p>
        </div>
        <button onClick={novaRevendedora} className="btn-primary py-2 px-3 text-sm">
          <Plus size={18} /> Nova
        </button>
      </header>

      {noLimite && (
        <button
          onClick={() => setUpsell(true)}
          className="card w-full text-left bg-brand-500/5 border-brand-500/30 flex items-center justify-between"
        >
          <span className="text-sm">
            Você atingiu o limite de <b>{fmtLimite(caps.maxRevendedoras)}</b> revendedoras.
          </span>
          <span className="text-brand-500 text-sm font-semibold">Fazer upgrade →</span>
        </button>
      )}

      <UpgradeModal
        aberto={upsell}
        onClose={() => setUpsell(false)}
        titulo="Limite de revendedoras atingido"
        descricao={`Seu plano permite até ${fmtLimite(
          caps.maxRevendedoras
        )} revendedoras ativas. Faça upgrade para cadastrar mais.`}
        planoNecessario={planoUpgrade}
      />

      {revendedoras.length === 0 && (
        <div className="card text-center text-muted">
          Cadastre suas revendedoras para acompanhar vendas e comissões.
        </div>
      )}

      <div className="space-y-2 stagger">
        {revendedoras.map((r) => {
          const pendVendas = vendasPendentes(r.id);
          const pend = pendVendas.reduce((a, v) => a + v.comissaoTotal, 0);
          const vendMes = vendidoNoMes(r.id);
          const pct = r.metaMensal > 0 ? Math.min(100, (vendMes / r.metaMensal) * 100) : 0;
          const bateu = r.metaMensal > 0 && vendMes >= r.metaMensal;
          return (
            <div key={r.id} className="card space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{r.nome}</div>
                  <div className="text-xs text-muted">
                    {r.comissaoPercent}% · vendeu {brl(vendMes)} no mês
                  </div>
                </div>
                {r.whatsapp && (
                  <a
                    href={`https://wa.me/${r.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    className="text-green-600"
                  >
                    <MessageCircle />
                  </a>
                )}
              </div>

              {/* meta mensal */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1 text-muted">
                    <Target size={13} />
                    {r.metaMensal > 0 ? (
                      <>
                        Meta {brl(r.metaMensal)} · {pct.toFixed(0)}%
                        {bateu && <span className="text-green-500 font-semibold"> ✓ batida</span>}
                      </>
                    ) : (
                      "Sem meta definida"
                    )}
                  </span>
                  <button onClick={() => editarMeta(r.id, r.metaMensal)} className="text-brand-500">
                    <Pencil size={13} />
                  </button>
                </div>
                {r.metaMensal > 0 && (
                  <div className="h-2 rounded-full surface-alt overflow-hidden">
                    <div
                      className={`h-full rounded-full ${bateu ? "bg-green-500" : "bg-brand-600"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between bg-brand-500/10 rounded-xl px-3 py-2">
                <span className="text-sm text-brand-500">
                  Comissão pendente: <b>{brl(pend)}</b>
                </span>
                {pend > 0 && (
                  <button
                    onClick={() => pagarComissao(r.id, r.nome, pendVendas.map((v) => v.id), pend)}
                    className="text-xs btn-primary py-1.5 px-2"
                  >
                    <BadgeDollarSign size={14} /> Pagar
                  </button>
                )}
              </div>

              {/* acesso da revendedora */}
              <AcessoRevendedora r={r} onUpdate={updateRevendedora} />
            </div>
          );
        })}
      </div>

      {/* link de acesso das revendedoras */}
      {revendedoras.some((r) => r.email) && (
        <div className="card text-xs text-muted">
          As revendedoras acessam pela página{" "}
          <span className="font-mono text-brand-500">/acesso</span> com o e-mail cadastrado.
        </div>
      )}

      {aberto && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center">
          <div className="surface w-full max-w-md rounded-t-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Nova revendedora</h2>
              <button onClick={() => setAberto(false)}>
                <X />
              </button>
            </div>
            <div>
              <label className="label">Nome</label>
              <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <label className="label">WhatsApp (opcional)</label>
              <input
                className="input"
                placeholder="DDD + número"
                inputMode="tel"
                value={whats}
                onChange={(e) => setWhats(e.target.value)}
              />
            </div>
            <div>
              <label className="label">E-mail de acesso (opcional)</label>
              <input
                className="input"
                placeholder="email@dela.com"
                type="email"
                value={emailNova}
                onChange={(e) => setEmailNova(e.target.value)}
              />
              <p className="text-xs text-muted mt-1">Com e-mail, ela pode acessar o catálogo e registrar as próprias vendas.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Comissão (%)</label>
                <input
                  className="input"
                  inputMode="decimal"
                  value={comissao}
                  onChange={(e) => setComissao(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Meta mensal (R$)</label>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={meta}
                  onChange={(e) => setMeta(e.target.value)}
                />
              </div>
            </div>
            <button onClick={salvar} className="btn-primary w-full">
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AcessoRevendedora({
  r,
  onUpdate,
}: {
  r: Revendedora;
  onUpdate: (id: string, patch: Partial<Revendedora>) => Promise<Resultado>;
}) {
  const { liberarAcessoRevendedora, revogarAcessoRevendedora } = useStore();
  const { alerta } = useDialog();
  const [editando, setEditando] = useState(!r.email);
  const [email, setEmail] = useState(r.email ?? "");
  const [salvando, setSalvando] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null); // só disponível logo após gerar
  const [copiado, setCopiado] = useState(false);

  async function salvarEmail() {
    setSalvando(true);
    const res = await onUpdate(r.id, { email: email.trim().toLowerCase() || null });
    setSalvando(false);
    if (!res.ok) {
      alerta({ titulo: "Não foi possível salvar o e-mail", mensagem: res.erro || "Tente novamente." });
      return;
    }
    if (email.trim()) setEditando(false);
  }

  async function liberar() {
    setLiberando(true);
    const res = await liberarAcessoRevendedora(r.id);
    setLiberando(false);
    if (!res.ok) {
      alerta({ titulo: "Não foi possível liberar", mensagem: res.erro || "Tente novamente." });
      return;
    }
    setCodigo(res.codigo ?? null);
    setCopiado(false);
  }

  async function revogar() {
    setCodigo(null);
    await revogarAcessoRevendedora(r.id);
  }

  async function copiar() {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard indisponível: o código segue visível para copiar à mão */
    }
  }

  // estado do acesso
  let status: { txt: string; cls: string };
  if (r.temAcesso) status = { txt: "Acesso ativo", cls: "text-green-600" };
  else if (r.acessoLiberado) status = { txt: "Aguardando 1º acesso", cls: "text-amber-600" };
  else status = { txt: "Sem acesso", cls: "text-muted" };

  return (
    <div className="rounded-xl border border-default p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <KeyRound size={14} className="text-brand-500" /> Acesso da revendedora
        </span>
        <span className={`text-xs font-semibold ${status.cls}`}>{status.txt}</span>
      </div>

      {editando ? (
        <div className="flex gap-2">
          <input
            className="input flex-1"
            type="email"
            placeholder="email@dela.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button onClick={salvarEmail} disabled={salvando} className="btn-primary px-3 py-2 text-sm">
            {salvando ? "…" : <Check size={15} />}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted truncate">
            <Mail size={13} /> {r.email}
          </span>
          <button onClick={() => setEditando(true)} className="text-brand-500 text-xs">
            <Pencil size={13} />
          </button>
        </div>
      )}

      {r.email && !r.temAcesso && (
        <button
          onClick={r.acessoLiberado ? revogar : liberar}
          disabled={liberando}
          className={`w-full rounded-lg py-2 text-sm font-semibold disabled:opacity-60 ${
            r.acessoLiberado ? "surface-alt text-muted" : "btn-primary"
          }`}
        >
          {liberando ? "Gerando…" : r.acessoLiberado ? "Cancelar liberação" : "Liberar acesso (gerar código)"}
        </button>
      )}

      {/* código recém-gerado: mostrado uma vez, para o dono copiar e enviar */}
      {codigo && !r.temAcesso && (
        <div className="rounded-lg bg-brand-500/10 border border-brand-500/30 p-3 space-y-1.5">
          <div className="text-[11px] text-muted">Código de acesso (válido por 7 dias)</div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xl font-bold tracking-[0.25em] text-brand-600">{codigo}</span>
            <button onClick={copiar} className="btn-ghost py-1.5 px-3 text-xs whitespace-nowrap">
              {copiado ? <Check size={14} /> : "Copiar"}
            </button>
          </div>
          <p className="text-[11px] text-muted">
            Envie para ela junto do link <b>/acesso</b>. Some assim que ela ativar — só aparece agora.
          </p>
        </div>
      )}

      {r.email && !r.temAcesso && r.acessoLiberado && !codigo && (
        <p className="text-[11px] text-muted">
          Acesso liberado. Se ela perdeu o código, clique em <b>Cancelar liberação</b> e libere de novo para gerar um novo.
        </p>
      )}
    </div>
  );
}
