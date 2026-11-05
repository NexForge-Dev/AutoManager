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
import { Aviso, Avatar, EstadoVazio, PageHeader, Progresso, Selo, Stat, type Tom } from "@/components/ui";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeDollarSign,
  Check,
  CheckCheck,
  Clock,
  HandCoins,
  KeyRound,
  Link2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Power,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
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
    setComissao(r.comissaoPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
    setMeta(r.metaMensal ? r.metaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
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
  // comissão já acertada com a revendedora (só exibição)
  function comissaoPaga(id: string) {
    return vendas
      .filter((v) => v.revendedoraId === id && v.statusComissao === "paga")
      .reduce((a, v) => a + v.comissaoTotal, 0);
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
      valorInicial: atual ? atual.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
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

  // resumo da equipe: somas das mesmas funções usadas em cada linha
  const totalVendidoMes = revendedoras.reduce((a, r) => a + vendidoNoMes(r.id), 0);
  const comissoesAPagar = revendedoras.map((r) =>
    vendasPendentes(r.id).reduce((a, v) => a + v.comissaoTotal, 0)
  );
  const totalAPagar = comissoesAPagar.reduce((a, v) => a + v, 0);
  const qtdAPagar = comissoesAPagar.filter((v) => v > 0).length;
  const totalPago = revendedoras.reduce((a, r) => a + comissaoPaga(r.id), 0);
  const qtdComAcesso = revendedoras.filter((r) => r.temAcesso).length;
  const qtdAguardando = revendedoras.filter((r) => !r.temAcesso && r.acessoLiberado).length;

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        titulo="Revendedoras"
        descricao={
          <span className="tnum">
            {uso.revendedoras} / {fmtLimite(caps.maxRevendedoras)} no seu plano
          </span>
        }
        acoes={
          <button onClick={novaRevendedora} className="btn-primary btn-sm">
            <Plus size={17} aria-hidden /> Nova
          </button>
        }
      />

      {noLimite && (
        <Aviso
          tom="brand"
          icone={Users}
          acao={
            <button onClick={() => setUpsell(true)} className="btn-ghost btn-sm whitespace-nowrap">
              Fazer upgrade <ArrowRight size={15} aria-hidden />
            </button>
          }
        >
          {caps.maxRevendedoras === 0 ? (
            "Seu plano não inclui revendedoras."
          ) : (
            <>
              Você atingiu o limite de <b className="text-strong">{fmtLimite(caps.maxRevendedoras)}</b> revendedoras.
            </>
          )}
        </Aviso>
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

      {revendedoras.length === 0 ? (
        <div className="card p-0">
          <EstadoVazio
            icone={Users}
            titulo="Nenhuma revendedora ainda"
            acao={
              <button onClick={novaRevendedora} className="btn-primary">
                <Plus size={17} aria-hidden /> Cadastrar revendedora
              </button>
            }
          >
            Cadastre suas revendedoras para acompanhar vendas e comissões.
          </EstadoVazio>
        </div>
      ) : (
        <>
          <div className="grid-kpi lg:grid-cols-4 gap-3">
            <Stat rotulo="Vendido no mês" icone={TrendingUp} tom="brand" valor={brl(totalVendidoMes)} apoio="por toda a equipe" />
            <Stat
              rotulo="Comissão a pagar"
              icone={HandCoins}
              tom="warn"
              valorTom={totalAPagar > 0 ? "warn" : undefined}
              valor={brl(totalAPagar)}
              apoio={qtdAPagar > 0 ? `para ${qtdAPagar} revendedora(s)` : "nada pendente"}
            />
            <Stat rotulo="Comissão já paga" icone={CheckCheck} tom="ok" valor={brl(totalPago)} apoio="total acertado" />
            <Stat
              rotulo="Com acesso ativo"
              icone={ShieldCheck}
              tom="info"
              valor={`${qtdComAcesso} de ${revendedoras.length}`}
              apoio={qtdAguardando > 0 ? `${qtdAguardando} aguardando 1º acesso` : "entram com e-mail e senha"}
            />
          </div>

          <div className="card-list stagger">
            {revendedoras.map((r) => {
              const pendVendas = vendasPendentes(r.id);
              const pend = pendVendas.reduce((a, v) => a + v.comissaoTotal, 0);
              const paga = comissaoPaga(r.id);
              const vendMes = vendidoNoMes(r.id);
              const pct = r.metaMensal > 0 ? Math.min(100, (vendMes / r.metaMensal) * 100) : 0;
              const bateu = r.metaMensal > 0 && vendMes >= r.metaMensal;
              return (
                <div key={r.id} className={r.ativa ? "" : "opacity-70"}>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto] gap-x-2 md:gap-x-6 gap-y-3 px-4 pt-3.5 pb-3 xl:items-center">
                    {/* quem é */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar nome={r.nome} className="hidden min-[360px]:grid" />
                      <div className="min-w-0">
                        <div className="font-semibold leading-snug line-clamp-2 break-words">{r.nome}</div>
                        <div className="text-xs text-muted tnum flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {r.comissaoPercent.toLocaleString("pt-BR")}% de comissão
                          {!r.ativa && <Selo>Desativada</Selo>}
                        </div>
                      </div>
                    </div>

                    {/* ações */}
                    <div className="flex items-center justify-self-end -mr-2 xl:order-last">
                      {r.whatsapp && (
                        <a
                          href={`https://wa.me/${waNumero(r.whatsapp)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Conversar com ${r.nome} no WhatsApp`}
                          className="icon-btn !text-ok"
                        >
                          <MessageCircle size={18} aria-hidden />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => editarRevendedora(r)}
                        aria-label={`Editar ${r.nome}`}
                        title="Editar"
                        className="icon-btn"
                      >
                        <Pencil size={17} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarAtiva(r)}
                        aria-label={r.ativa ? `Desativar ${r.nome}` : `Reativar ${r.nome}`}
                        title={r.ativa ? "Desativar" : "Reativar"}
                        className={`icon-btn ${r.ativa ? "" : "!text-accent"}`}
                      >
                        <Power size={18} aria-hidden />
                      </button>
                    </div>

                    {/* vendas e meta mensal */}
                    <div className="col-span-2 md:col-span-1 min-w-0">
                      <div className="eyebrow">Vendeu no mês</div>
                      <div className="font-bold text-lg leading-snug tnum">{brl(vendMes)}</div>
                      {r.metaMensal > 0 && (
                        <Progresso
                          className="mt-1.5"
                          pct={pct}
                          tom={bateu ? "ok" : "brand"}
                          rotulo={`Meta do mês de ${r.nome}`}
                        />
                      )}
                      <div className="flex items-center justify-between gap-2 text-xs text-muted mt-1">
                        <span className="flex items-center gap-1 min-w-0 flex-wrap tnum">
                          <Target size={13} className="shrink-0" aria-hidden />
                          {r.metaMensal > 0 ? (
                            <>
                              Meta {brl(r.metaMensal)} · {pct.toFixed(0)}%
                              {bateu && (
                                <Selo tom="ok" icone={Check} className="ml-1">
                                  batida
                                </Selo>
                              )}
                            </>
                          ) : (
                            "Sem meta definida"
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => editarMeta(r.id, r.metaMensal)}
                          aria-label="Editar meta do mês"
                          className="icon-btn !text-accent -my-2.5 -mr-2"
                        >
                          <Pencil size={14} aria-hidden />
                        </button>
                      </div>
                    </div>

                    {/* comissão: quanto ela deve receber */}
                    <div className="col-span-2 md:col-span-1 flex items-center justify-between gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="eyebrow">Comissão a pagar</div>
                        <div className={`font-bold text-lg leading-snug tnum ${pend > 0 ? "text-warn" : "text-muted"}`}>
                          {brl(pend)}
                        </div>
                        <div className="text-xs text-muted tnum">Já pago: {brl(paga)}</div>
                      </div>
                      {pend > 0 && (
                        <button
                          onClick={() => pagarComissao(r.id, r.nome, pendVendas.map((v) => v.id), pend)}
                          disabled={pagando === r.id}
                          className="btn-ghost btn-sm shrink-0"
                        >
                          <BadgeDollarSign size={15} aria-hidden /> {pagando === r.id ? "Salvando…" : "Pagar"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* acesso da revendedora */}
                  <AcessoRevendedora r={r} onUpdate={updateRevendedora} />
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* link de acesso das revendedoras */}
      {revendedoras.some((r) => r.email) && (
        <Aviso tom="info" icone={Link2}>
          Libere o acesso e envie o link pelo WhatsApp: a revendedora toca no link e cria a senha. Depois ela entra
          pela tela de login normal, com o e-mail e a senha dela.
        </Aviso>
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
                maxLength={30}
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
                <p className="hint">Com e-mail, ela pode acessar o catálogo e registrar as próprias vendas.</p>
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
              <p className="hint !mt-0">
                A nova comissão vale para as próximas vendas; as já registradas mantêm o percentual da época.
              </p>
            )}
            <button onClick={salvar} disabled={salvandoRev} className="btn-primary w-full">
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
    if (res.emailEmUso)
      alerta({
        titulo: "Este e-mail já tem conta",
        mensagem: `${r.nome} não vai conseguir ativar com esse e-mail, porque ele já tem uma conta no AutoManager. Cadastre outro e-mail dela e gere um novo código.`,
      });
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
  let status: { txt: string; tom: Tom; icone: LucideIcon };
  if (r.temAcesso) status = { txt: "Acesso ativo", tom: "ok", icone: ShieldCheck };
  else if (r.acessoLiberado) status = { txt: "Aguardando 1º acesso", tom: "warn", icone: Clock };
  else status = { txt: "Sem acesso", tom: "neutral", icone: KeyRound };

  return (
    <div className="border-t border-dashed border-default px-4 py-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Selo tom={status.tom} icone={status.icone} className="shrink-0">
          {status.txt}
        </Selo>

        {editando ? (
          <div className="flex gap-2 flex-1 basis-56 min-w-0 max-w-md">
            <input
              className="input flex-1 min-w-0"
              type="email"
              placeholder="email@dela.com"
              aria-label={`E-mail de acesso de ${r.nome}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              onClick={salvarEmail}
              disabled={salvando}
              aria-label="Salvar e-mail"
              className="btn-ghost !px-0 w-11 shrink-0"
            >
              {salvando ? "…" : <Check size={16} aria-hidden />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-1 basis-40 min-w-0 text-sm">
            <span className="flex items-center gap-1.5 text-muted min-w-0">
              <Mail size={13} className="shrink-0" aria-hidden /> <span className="truncate">{r.email}</span>
            </span>
            <button
              type="button"
              onClick={() => setEditando(true)}
              aria-label="Editar e-mail"
              className="icon-btn !text-accent -my-2"
            >
              <Pencil size={14} aria-hidden />
            </button>
          </div>
        )}

        {r.email && !r.temAcesso && (
          <button
            onClick={r.acessoLiberado ? revogar : liberar}
            disabled={liberando}
            className="btn-ghost btn-sm w-full sm:w-auto"
          >
            {liberando ? (r.acessoLiberado ? "Cancelando…" : "Gerando…") : r.acessoLiberado ? "Cancelar liberação" : "Liberar acesso (gerar código)"}
          </button>
        )}
      </div>

      {/* código recém-gerado: mostrado uma vez, para o dono copiar e enviar */}
      {codigo && !r.temAcesso && (
        <div
          className="bg-brand-500/[.06] border border-brand-500/30 p-3 space-y-2"
          style={{ borderRadius: "var(--r-input)" }}
        >
          <div className="sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div>
              <div className="eyebrow">Código de acesso (válido por 7 dias)</div>
              <span className="block font-mono text-xl font-bold tracking-[0.25em] text-accent">{codigo}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 sm:mt-0 sm:shrink-0">
              <a href={whatsLink} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">
                <MessageCircle size={15} aria-hidden /> WhatsApp
              </a>
              <button onClick={copiar} className="btn-ghost btn-sm whitespace-nowrap">
                {copiado ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />}{" "}
                {copiado ? "Copiado" : "Copiar convite"}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted">
            O link já leva o e-mail e o código: ela só toca e cria a senha. Só aparece agora — some quando ela ativar.
          </p>
        </div>
      )}

      {r.email && !r.temAcesso && r.acessoLiberado && !codigo && (
        <p className="text-xs text-muted">
          Acesso liberado. Se ela perdeu o código, clique em <b>Cancelar liberação</b> e libere de novo para gerar um novo.
        </p>
      )}
    </div>
  );
}
