"use client";
import { useState } from "react";
import { waNumero } from "@/lib/contato";
import { useStore } from "@/lib/store";
import { parseNumero } from "@/lib/csvProdutos";
import { brl } from "@/lib/analytics";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import { Plus, MessageCircle, Power, BadgeDollarSign, Target, Pencil, KeyRound, Check, Mail, Link2 } from "lucide-react";
import { linkConvite, mensagemConvite } from "@/lib/acessoRevendedora";
import type { Revendedora } from "@/lib/types";
import type { Resultado } from "@/lib/store";
import { usePlano } from "@/lib/usePlano";
import { UpgradeModal } from "@/components/UpgradeGate";
import { planoQueLibera, fmtLimite } from "@/lib/plans";
import { inicioDoMes } from "@/lib/fuso";

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
  // null = cadastro novo; id = editando uma revendedora existente
  const [editId, setEditId] = useState<string | null>(null);
  const [salvandoRev, setSalvandoRev] = useState(false);
  const [pagando, setPagando] = useState<string | null>(null);
  const [upsell, setUpsell] = useState(false);
  const [nome, setNome] = useState("");
  const [whats, setWhats] = useState("");
  const [emailNova, setEmailNova] = useState("");
  const [comissao, setComissao] = useState(String(config.comissaoPadrao));
  const [meta, setMeta] = useState("");

  const noLimite = limiteAtingido("revendedoras");
  const planoUpgrade = planoQueLibera((p) => p.maxRevendedoras > uso.revendedoras);

  function novaRevendedora() {
    if (noLimite) {
      setUpsell(true);
      return;
    }
    setEditId(null);
    setNome("");
    setWhats("");
    setEmailNova("");
    setComissao(String(config.comissaoPadrao));
    setMeta("");
    setAberto(true);
  }

  function editarRevendedora(r: Revendedora) {
    setEditId(r.id);
    setNome(r.nome);
    setWhats(r.whatsapp ?? "");
    setComissao(String(r.comissaoPercent).replace(".", ","));
    setMeta(r.metaMensal ? String(r.metaMensal).replace(".", ",") : "");
    setAberto(true);
  }

  // mês corrente no fuso da loja (America/Sao_Paulo), como o resto do app
  const inicioMes = inicioDoMes(Date.now());

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
    if (salvandoRev) return;
    if (!nome.trim()) {
      alerta({ titulo: "Falta o nome", mensagem: "Informe o nome da revendedora." });
      return;
    }
    // vazio = comissão padrão da loja; 0% é um valor válido (não cai no padrão)
    const c = comissao.trim() === "" ? config.comissaoPadrao : parseNumero(comissao);
    if (!Number.isFinite(c) || c < 0 || c > 100) {
      alerta({ titulo: "Comissão inválida", mensagem: "Informe uma comissão entre 0% e 100%." });
      return;
    }
    const m = meta.trim() === "" ? 0 : parseNumero(meta);
    if (!Number.isFinite(m) || m < 0) {
      alerta({ titulo: "Meta inválida", mensagem: "Informe a meta em reais (ex.: 1.500,00) ou deixe em branco." });
      return;
    }
    setSalvandoRev(true);
    const res = editId
      ? await updateRevendedora(editId, { nome: nome.trim(), whatsapp: whats.trim(), comissaoPercent: c, metaMensal: m })
      : await addRevendedora({
          nome: nome.trim(),
          whatsapp: whats.trim(),
          email: emailNova.trim().toLowerCase() || null,
          comissaoPercent: c,
          metaMensal: m,
        });
    setSalvandoRev(false);
    if (!res.ok) {
      alerta({
        titulo: editId ? "Não foi possível salvar" : "Não foi possível cadastrar",
        mensagem: res.erro || "Tente novamente.",
      });
      return;
    }
    setEditId(null);
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
      valorInicial: atual ? String(atual).replace(".", ",") : "",
      tipo: "text",
      inputMode: "decimal",
      confirmar: "Salvar",
    });
    if (v === null) return;
    const m = v.trim() === "" ? 0 : parseNumero(v);
    if (!Number.isFinite(m) || m < 0) {
      alerta({ titulo: "Meta inválida", mensagem: "Informe a meta em reais (ex.: 1.500,00) ou deixe em branco." });
      return;
    }
    const res = await updateRevendedora(id, { metaMensal: m });
    if (!res.ok) alerta({ titulo: "Não foi possível salvar a meta", mensagem: res.erro || "Tente novamente." });
  }

  async function alternarAtiva(r: Revendedora) {
    const desativar = r.ativa;
    if (!desativar && noLimite) {
      setUpsell(true);
      return;
    }
    const ok = await confirm({
      titulo: desativar ? `Desativar ${r.nome}?` : `Reativar ${r.nome}?`,
      mensagem: desativar
        ? "Ela deixa de contar no limite de revendedoras ativas do seu plano. O histórico de vendas e comissões continua guardado e você pode reativar quando quiser."
        : "Ela volta a contar no limite de revendedoras ativas do seu plano.",
      confirmar: desativar ? "Desativar" : "Reativar",
      perigo: desativar,
    });
    if (!ok) return;
    const res = await updateRevendedora(r.id, { ativa: !desativar });
    if (!res.ok)
      alerta({
        titulo: desativar ? "Não foi possível desativar" : "Não foi possível reativar",
        mensagem: res.erro || "Tente novamente.",
      });
  }

  // congela a lista de vendas somadas no momento do clique: só elas são pagas
  async function pagarComissao(id: string, nome: string, vendaIds: string[], valor: number) {
    const ok = await confirm({
      titulo: "Confirmar pagamento",
      mensagem: `Marcar ${brl(valor)} (${vendaIds.length} venda(s)) como pago para ${nome}?`,
      confirmar: "Marcar como pago",
    });
    if (!ok) return;
    setPagando(id);
    const res = await marcarComissaoPaga(id, vendaIds);
    setPagando(null);
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
            {caps.maxRevendedoras === 0 ? (
              "Seu plano não inclui revendedoras."
            ) : (
              <>
                Você atingiu o limite de <b>{fmtLimite(caps.maxRevendedoras)}</b> revendedoras.
              </>
            )}
          </span>
          <span className="text-brand-500 text-sm font-semibold">Fazer upgrade →</span>
        </button>
      )}

      <UpgradeModal
        aberto={upsell}
        onClose={() => setUpsell(false)}
        titulo={caps.maxRevendedoras === 0 ? "Revendedoras não incluídas" : "Limite de revendedoras atingido"}
        descricao={
          caps.maxRevendedoras === 0
            ? "Seu plano não inclui revendedoras. Faça upgrade para cadastrar e acompanhar a sua equipe de vendas."
            : `Seu plano permite até ${fmtLimite(caps.maxRevendedoras)} revendedoras ativas. Faça upgrade para cadastrar mais.`
        }
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
            <div key={r.id} className={`card space-y-2 ${r.ativa ? "" : "opacity-70"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    <span className="truncate">{r.nome}</span>
                    {!r.ativa && (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 surface-alt text-muted">
                        Desativada
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {r.comissaoPercent}% · vendeu {brl(vendMes)} no mês
                  </div>
                </div>
                <div className="flex items-center shrink-0 -mr-2">
                  {r.whatsapp && (
                    <a
                      href={`https://wa.me/${waNumero(r.whatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Conversar com ${r.nome} no WhatsApp`}
                      className="grid place-items-center h-11 w-11 rounded-full text-green-600 hover:bg-[var(--hover)]"
                    >
                      <MessageCircle />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => editarRevendedora(r)}
                    aria-label={`Editar ${r.nome}`}
                    title="Editar"
                    className="grid place-items-center h-11 w-11 rounded-full text-muted hover:bg-[var(--hover)]"
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => alternarAtiva(r)}
                    aria-label={r.ativa ? `Desativar ${r.nome}` : `Reativar ${r.nome}`}
                    title={r.ativa ? "Desativar" : "Reativar"}
                    className={`grid place-items-center h-11 w-11 rounded-full hover:bg-[var(--hover)] ${
                      r.ativa ? "text-muted" : "text-brand-500"
                    }`}
                  >
                    <Power size={18} />
                  </button>
                </div>
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
                  <button
                    type="button"
                    onClick={() => editarMeta(r.id, r.metaMensal)}
                    aria-label="Editar meta do mês"
                    className="grid place-items-center h-11 w-11 -my-3 -mr-3 rounded-full text-brand-500 hover:bg-[var(--hover)]"
                  >
                    <Pencil size={14} />
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
                    disabled={pagando === r.id}
                    className="text-xs btn-primary py-1.5 px-2 disabled:opacity-60"
                  >
                    <BadgeDollarSign size={14} /> {pagando === r.id ? "Salvando…" : "Pagar"}
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
          Libere o acesso e envie o link pelo WhatsApp: a revendedora toca no link e cria a senha. Depois ela entra
          pela tela de login normal, com o e-mail e a senha dela.
        </div>
      )}

      {aberto && (
        <Modal onClose={() => setAberto(false)} titulo={editId ? "Editar revendedora" : "Nova revendedora"}>
            <div>
              <label className="label" htmlFor="rev-nome">Nome</label>
              <input id="rev-nome" className="input" maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="rev-whats">WhatsApp (opcional)</label>
              <input
                id="rev-whats"
                className="input"
                placeholder="DDD + número"
                inputMode="tel"
                value={whats}
                onChange={(e) => setWhats(e.target.value)}
              />
            </div>
            {!editId && (
              <div>
                <label className="label" htmlFor="rev-email">E-mail de acesso (opcional)</label>
                <input
                  id="rev-email"
                  className="input"
                  placeholder="email@dela.com"
                  type="email"
                  value={emailNova}
                  onChange={(e) => setEmailNova(e.target.value)}
                />
                <p className="text-xs text-muted mt-1">Com e-mail, ela pode acessar o catálogo e registrar as próprias vendas.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="rev-comissao">Comissão (%)</label>
                <input
                  id="rev-comissao"
                  className="input"
                  inputMode="decimal"
                  value={comissao}
                  onChange={(e) => setComissao(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="rev-meta">Meta mensal (R$)</label>
                <input
                  id="rev-meta"
                  className="input"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={meta}
                  onChange={(e) => setMeta(e.target.value)}
                />
              </div>
            </div>
            {editId && (
              <p className="text-xs text-muted">
                A nova comissão vale para as próximas vendas; as já registradas mantêm o percentual da época.
              </p>
            )}
            <button onClick={salvar} disabled={salvandoRev} className="btn-primary w-full disabled:opacity-60">
              {salvandoRev ? "Salvando…" : "Salvar"}
            </button>
        </Modal>
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
  const { liberarAcessoRevendedora } = useStore();
  const nomeLoja = useStore((s) => s.config.nomeLoja);
  const { alerta, confirm } = useDialog();
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

  // Pede confirmação e mostra o erro se o banco recusar. Chama a RPC direto
  // (o revogarAcessoRevendedora do store engole o erro) e só então atualiza a lista.
  async function revogar() {
    const ok = await confirm({
      titulo: "Cancelar liberação?",
      mensagem: `O código enviado para ${r.nome} deixa de funcionar. Você pode liberar de novo depois para gerar outro.`,
      confirmar: "Cancelar liberação",
      cancelar: "Manter",
      perigo: true,
    });
    if (!ok) return;
    setLiberando(true);
    const { error } = await createClient().rpc("revogar_revendedora", { p_id: r.id });
    setLiberando(false);
    if (error) {
      alerta({ titulo: "Não foi possível cancelar a liberação", mensagem: "Tente novamente em instantes." });
      return;
    }
    setCodigo(null);
    useStore.setState((s) => ({
      revendedoras: s.revendedoras.map((x) => (x.id === r.id ? { ...x, acessoLiberado: false } : x)),
    }));
  }

  // link com e-mail e código já preenchidos: ela só toca e cria a senha
  const link = codigo && r.email ? linkConvite(window.location.origin, r.email, codigo) : null;
  const mensagem = link && codigo ? mensagemConvite({ nomeRevendedora: r.nome, nomeLoja, link, codigo }) : "";
  const whatsLink = r.whatsapp
    ? `https://wa.me/${waNumero(r.whatsapp)}?text=${encodeURIComponent(mensagem)}`
    : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponível (http, permissão negada): mostra o texto para copiar à mão
      alerta({
        titulo: "Copie o convite",
        mensagem: `Não deu para copiar automaticamente. Selecione e copie o texto abaixo:\n\n${mensagem}`,
        ok: "Fechar",
      });
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
          <button
            onClick={salvarEmail}
            disabled={salvando}
            aria-label="Salvar e-mail"
            className="btn-primary px-3 py-2 text-sm min-w-[44px] min-h-[44px]"
          >
            {salvando ? "…" : <Check size={15} />}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted truncate">
            <Mail size={13} /> {r.email}
          </span>
          <button
            type="button"
            onClick={() => setEditando(true)}
            aria-label="Editar e-mail"
            className="grid place-items-center h-11 w-11 -my-3 -mr-3 shrink-0 rounded-full text-brand-500 hover:bg-[var(--hover)]"
          >
            <Pencil size={14} />
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
          {liberando ? (r.acessoLiberado ? "Cancelando…" : "Gerando…") : r.acessoLiberado ? "Cancelar liberação" : "Liberar acesso (gerar código)"}
        </button>
      )}

      {/* código recém-gerado: mostrado uma vez, para o dono copiar e enviar */}
      {codigo && !r.temAcesso && (
        <div className="rounded-lg bg-brand-500/10 border border-brand-500/30 p-3 space-y-1.5">
          <div className="text-[11px] text-muted">Código de acesso (válido por 7 dias)</div>
          <span className="block font-mono text-xl font-bold tracking-[0.25em] text-brand-600">{codigo}</span>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href={whatsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary py-2 text-sm flex items-center justify-center gap-1.5"
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
            <button onClick={copiar} className="btn-ghost py-2 text-sm flex items-center justify-center gap-1.5 whitespace-nowrap">
              {copiado ? <Check size={15} /> : <Link2 size={15} />} {copiado ? "Copiado" : "Copiar convite"}
            </button>
          </div>
          <p className="text-[11px] text-muted">
            O link já leva o e-mail e o código: ela só toca e cria a senha. Só aparece agora — some quando ela ativar.
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

