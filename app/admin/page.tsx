"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { linkWhatsappSuporte } from "@/lib/admin";
import { brlPreco, ORDEM_PLANOS, PLANOS, type PlanoId } from "@/lib/plans";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import { SkeletonMetrics, SkeletonList } from "@/components/Skeleton";
import type { Chamado } from "@/lib/types";
import {
  ShieldCheck,
  Lock,
  RefreshCw,
  CheckCircle2,
  RotateCcw,
  Mail,
  MessageCircle,
  Store,
  Inbox,
  DollarSign,
  Users,
  TrendingUp,
  Sparkles,
  Ban,
  Crown,
  Loader2,
  Power,
  Trash2,
  ScrollText,
} from "lucide-react";

export default function AdminPage() {
  return (
    <Guard>
      <Admin />
    </Guard>
  );
}

const TIPO_LABEL: Record<string, string> = {
  erro: "Erro",
  duvida: "Dúvida",
  sugestao: "Sugestão",
};

const PLANO_CLS: Record<PlanoId, string> = {
  ambulante: "bg-teal-500/15 text-teal-600",
  solo: "bg-slate-500/15 text-slate-500",
  equipe: "bg-brand-500/15 text-brand-600",
  expansao: "bg-amber-500/15 text-amber-600",
};

const STATUS_INFO: Record<string, { txt: string; cls: string }> = {
  active: { txt: "Ativa", cls: "bg-green-500/15 text-green-600" },
  trialing: { txt: "Trial", cls: "bg-brand-500/15 text-brand-600" },
  past_due: { txt: "Pendente", cls: "bg-amber-500/15 text-amber-600" },
  canceled: { txt: "Cancelada", cls: "bg-red-500/15 text-red-600" },
};

type Acesso = "ativo" | "desativado" | "banido";

type Loja = {
  orgId: string;
  nome: string;
  slug: string | null;
  acesso: Acesso;
  plano: PlanoId;
  status: string;
  precoCentavos: number;
  ownerEmail: string | null;
  membros: number;
  desde: string | null;
};

const ACESSO_INFO: Record<Acesso, { txt: string; cls: string }> = {
  ativo: { txt: "Ativa", cls: "bg-green-500/15 text-green-600" },
  desativado: { txt: "Desativada", cls: "bg-amber-500/15 text-amber-600" },
  banido: { txt: "Banida", cls: "bg-red-500/15 text-red-600" },
};

type AdminLog = {
  id: string;
  actorEmail: string;
  acao: string;
  alvoOrgId: string | null;
  alvoDescricao: string | null;
  detalhe: Record<string, unknown> | null;
  criadoEm: number;
};

type Overview = {
  resumo: {
    totalLojas: number;
    ativas: number;
    trial: number;
    canceladas: number;
    mrrCentavos: number;
    arrCentavos: number;
    porPlano: { plano: PlanoId; nome: string; ativas: number; mrrCentavos: number }[];
  };
  lojas: Loja[];
};

function quando(ms: number) {
  return new Date(ms).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function dataCurta(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function Admin() {
  const listarChamados = useStore((s) => s.listarChamados);
  const resolverChamado = useStore((s) => s.resolverChamado);

  const autorizado = useStore((s) => s.superadmin);

  const [aba, setAba] = useState<"resumo" | "lojas" | "chamados" | "auditoria">("resumo");
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [logs, setLogs] = useState<AdminLog[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<"abertos" | "todos">("abertos");

  async function carregar() {
    setCarregando(true);
    const [lista, res, logsRes] = await Promise.all([
      listarChamados(),
      fetch("/api/admin/overview")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/admin/logs")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);
    setChamados(lista);
    setOverview(res);
    setLogs(logsRes?.logs ?? null);
    setCarregando(false);
  }

  useEffect(() => {
    if (autorizado) carregar();
    else setCarregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorizado]);

  async function alternar(c: Chamado) {
    const resolvido = c.status !== "resolvido";
    setChamados((cs) =>
      cs.map((x) =>
        x.id === c.id
          ? { ...x, status: resolvido ? "resolvido" : "aberto", resolvidoEm: resolvido ? Date.now() : null }
          : x
      )
    );
    await resolverChamado(c.id, resolvido);
  }

  if (!autorizado) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <div className="space-y-3 max-w-sm">
          <Lock size={40} className="text-muted mx-auto" />
          <h1 className="text-xl font-bold">Área restrita</h1>
          <p className="text-muted text-sm">
            Esta tela é exclusiva da administração do AutoManager. Sua conta não tem acesso.
          </p>
        </div>
      </div>
    );
  }

  const abertos = chamados.filter((c) => c.status !== "resolvido").length;

  return (
    <div className="space-y-4">
      <header className="pt-1 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-brand-600 font-bold text-2xl">
            <ShieldCheck size={24} /> Admin
          </div>
          <p className="text-sm text-muted">Painel da plataforma AutoManager</p>
        </div>
        <button onClick={carregar} className="btn-ghost flex items-center gap-2 text-sm" disabled={carregando}>
          <RefreshCw size={16} className={carregando ? "animate-spin" : ""} /> Atualizar
        </button>
      </header>

      {/* abas */}
      <div className="flex gap-2 overflow-x-auto">
        {([
          ["resumo", "Resumo"],
          ["lojas", "Lojas & usuários"],
          ["chamados", `Chamados${abertos ? ` (${abertos})` : ""}`],
          ["auditoria", "Auditoria"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium border transition ${
              aba === id ? "bg-brand-600 text-white border-brand-600" : "border-default text-muted hover:surface-alt"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {carregando ? (
        <>
          <SkeletonMetrics count={4} />
          <SkeletonList count={4} />
        </>
      ) : aba === "resumo" ? (
        <ResumoView overview={overview} />
      ) : aba === "lojas" ? (
        <LojasView overview={overview} recarregar={carregar} />
      ) : aba === "auditoria" ? (
        <AuditoriaView logs={logs} />
      ) : (
        <ChamadosView
          chamados={chamados}
          filtro={filtro}
          setFiltro={setFiltro}
          alternar={alternar}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- RESUMO */
function ResumoView({ overview }: { overview: Overview | null }) {
  if (!overview) return <div className="card text-center text-muted py-10">Não foi possível carregar o resumo.</div>;
  const r = overview.resumo;

  const cards = [
    { icon: DollarSign, label: "Faturamento mensal (MRR)", valor: brlPreco(r.mrrCentavos), destaque: true },
    { icon: TrendingUp, label: "Projeção anual (ARR)", valor: brlPreco(r.arrCentavos) },
    { icon: CheckCircle2, label: "Assinaturas ativas", valor: String(r.ativas) },
    { icon: Sparkles, label: "Em teste grátis", valor: String(r.trial) },
    { icon: Store, label: "Total de lojas", valor: String(r.totalLojas) },
    { icon: Ban, label: "Canceladas", valor: String(r.canceladas) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={`card ${c.destaque ? "bg-brand-600 text-white" : ""}`}>
            <div className={`flex items-center gap-2 text-xs ${c.destaque ? "text-brand-50" : "text-muted"}`}>
              <c.icon size={15} /> {c.label}
            </div>
            <div className={`mt-1 text-2xl font-extrabold ${c.destaque ? "" : ""}`}>{c.valor}</div>
          </div>
        ))}
      </div>

      <div className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Crown size={18} className="text-brand-500" /> Faturamento por plano
        </div>
        {r.porPlano.map((p) => {
          const pct = r.mrrCentavos > 0 ? Math.round((p.mrrCentavos / r.mrrCentavos) * 100) : 0;
          return (
            <div key={p.plano}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PLANO_CLS[p.plano]}`}>
                    {p.nome}
                  </span>
                  <span className="text-muted">{p.ativas} ativa(s)</span>
                </span>
                <span className="font-semibold">{brlPreco(p.mrrCentavos)}/mês</span>
              </div>
              <div className="h-2 rounded-full surface-alt overflow-hidden">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- LOJAS */
function LojasView({
  overview,
  recarregar,
}: {
  overview: Overview | null;
  recarregar: () => Promise<void>;
}) {
  const { confirm, alerta } = useDialog();
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);

  async function moderar(l: Loja, acao: "desativar" | "banir" | "reativar" | "deletar") {
    const dono = l.ownerEmail ?? "sem dono";
    const textos: Record<typeof acao, { titulo: string; mensagem: string; confirmar: string }> = {
      desativar: {
        titulo: `Desativar "${l.nome}"?`,
        mensagem: `${dono}\n\nTodos os usuários dela ficam sem conseguir entrar até você reativar.`,
        confirmar: "Desativar",
      },
      banir: {
        titulo: `Banir "${l.nome}"?`,
        mensagem: `${dono}\n\nO acesso de todos os usuários é bloqueado. Você ainda pode reativar depois.`,
        confirmar: "Banir",
      },
      reativar: {
        titulo: `Reativar "${l.nome}"?`,
        mensagem: `${dono}\n\nOs usuários voltam a conseguir entrar.`,
        confirmar: "Reativar",
      },
      deletar: {
        titulo: `Deletar "${l.nome}"?`,
        mensagem: `${dono}\n\nIsso APAGA a loja, todos os dados (produtos, vendas, etc.) e as contas dos usuários. Esta ação é IRREVERSÍVEL.`,
        confirmar: "Deletar tudo",
      },
    };
    const t = textos[acao];
    const ok = await confirm({ ...t, perigo: acao !== "reativar" });
    if (!ok) return;
    // segunda confirmação para a ação destrutiva
    if (
      acao === "deletar" &&
      !(await confirm({
        titulo: "Tem certeza absoluta?",
        mensagem: "Não há como desfazer. Confirme para apagar definitivamente.",
        confirmar: "Sim, apagar para sempre",
        perigo: true,
      }))
    )
      return;

    setSalvando(l.orgId);
    try {
      const res = await fetch("/api/admin/usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: l.orgId, acao }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        await alerta({ titulo: "Não foi possível concluir", mensagem: json.erro || "erro" });
        return;
      }
      await recarregar();
    } catch {
      await alerta({ titulo: "Falha de conexão" });
    } finally {
      setSalvando(null);
    }
  }

  async function mudarPlano(l: Loja, plano: PlanoId) {
    if (plano === l.plano) return;
    const ok = await confirm({
      titulo: `Mudar para ${PLANOS[plano].nome}?`,
      mensagem: `"${l.nome}" — de ${PLANOS[l.plano].nome} para ${PLANOS[plano].nome}.\n\nA troca é aplicada na hora, sem cobrança pelo Mercado Pago. Se a loja tiver uma assinatura ativa no MP, ela continua valendo lá.`,
      confirmar: "Mudar plano",
    });
    if (!ok) return;
    setSalvando(l.orgId);
    try {
      const res = await fetch("/api/admin/plano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: l.orgId, plano }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        await alerta({ titulo: "Não foi possível mudar o plano", mensagem: json.erro || "erro" });
        return;
      }
      await recarregar();
    } catch {
      await alerta({ titulo: "Falha de conexão ao mudar o plano" });
    } finally {
      setSalvando(null);
    }
  }

  if (!overview) return <div className="card text-center text-muted py-10">Não foi possível carregar as lojas.</div>;

  const termo = busca.trim().toLowerCase();
  const lojas = termo
    ? overview.lojas.filter(
        (l) =>
          l.nome.toLowerCase().includes(termo) ||
          (l.ownerEmail ?? "").toLowerCase().includes(termo) ||
          (l.slug ?? "").toLowerCase().includes(termo)
      )
    : overview.lojas;

  return (
    <div className="space-y-3">
      <input
        className="input"
        placeholder="Buscar por loja, e-mail ou link…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <p className="text-xs text-muted">
        {lojas.length} loja(s){termo ? ` de ${overview.lojas.length}` : ""}
      </p>

      {lojas.map((l) => {
        const st = STATUS_INFO[l.status] ?? STATUS_INFO.active;
        return (
          <div key={l.orgId} className="card space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{l.nome}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
                  <Users size={12} /> {l.ownerEmail ?? "sem dono"} · {l.membros} usuário(s)
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PLANO_CLS[l.plano]}`}>
                  {l.plano.toUpperCase()}
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.txt}</span>
                {l.acesso !== "ativo" && (
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ACESSO_INFO[l.acesso].cls}`}>
                    {ACESSO_INFO[l.acesso].txt}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                {l.status === "active" ? `${brlPreco(l.precoCentavos)}/mês` : "-"} · desde {dataCurta(l.desde)}
              </span>
              {l.slug && (
                <a
                  href={`/loja/${l.slug}`}
                  className="flex items-center gap-1 hover:text-brand-600"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Store size={12} /> /{l.slug}
                </a>
              )}
            </div>

            {/* troca manual de plano (cortesia / suporte) */}
            <div className="flex items-center gap-2 pt-1 border-t border-default/60">
              <span className="text-xs text-muted shrink-0">Mudar plano:</span>
              <select
                className="input py-1 text-xs flex-1"
                value={l.plano}
                disabled={salvando === l.orgId}
                onChange={(e) => mudarPlano(l, e.target.value as PlanoId)}
              >
                {ORDEM_PLANOS.map((id) => (
                  <option key={id} value={id}>
                    {PLANOS[id].nome} · {brlPreco(PLANOS[id].precoCentavos)}/mês
                  </option>
                ))}
              </select>
              {salvando === l.orgId && <Loader2 size={14} className="animate-spin text-brand-600 shrink-0" />}
            </div>

            {/* moderação da conta */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-default/60">
              {l.acesso === "ativo" ? (
                <>
                  <button
                    onClick={() => moderar(l, "desativar")}
                    disabled={salvando === l.orgId}
                    className="btn-ghost text-xs py-1.5 px-3 text-amber-600 disabled:opacity-60"
                  >
                    <Power size={14} /> Desativar
                  </button>
                  <button
                    onClick={() => moderar(l, "banir")}
                    disabled={salvando === l.orgId}
                    className="btn-ghost text-xs py-1.5 px-3 text-red-600 disabled:opacity-60"
                  >
                    <Ban size={14} /> Banir
                  </button>
                </>
              ) : (
                <button
                  onClick={() => moderar(l, "reativar")}
                  disabled={salvando === l.orgId}
                  className="btn-ghost text-xs py-1.5 px-3 text-green-600 disabled:opacity-60"
                >
                  <RotateCcw size={14} /> Reativar
                </button>
              )}
              <button
                onClick={() => moderar(l, "deletar")}
                disabled={salvando === l.orgId}
                className="btn-ghost text-xs py-1.5 px-3 text-red-600 ml-auto disabled:opacity-60"
              >
                <Trash2 size={14} /> Deletar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- AUDITORIA */
const ACAO_INFO: Record<string, { txt: string; cls: string }> = {
  desativar: { txt: "Desativou", cls: "bg-amber-500/15 text-amber-600" },
  banir: { txt: "Baniu", cls: "bg-red-500/15 text-red-600" },
  reativar: { txt: "Reativou", cls: "bg-green-500/15 text-green-600" },
  deletar: { txt: "Deletou", cls: "bg-red-500/15 text-red-600" },
  mudar_plano: { txt: "Mudou plano", cls: "bg-brand-500/15 text-brand-600" },
};

function detalheTexto(acao: string, d: Record<string, unknown> | null): string | null {
  if (!d) return null;
  if (acao === "mudar_plano" && (d.de || d.para)) return `${d.de ?? "?"} → ${d.para ?? "?"}`;
  if (typeof d.usuarios_removidos === "number") return `${d.usuarios_removidos} usuário(s) removido(s)`;
  if (typeof d.usuarios_afetados === "number") return `${d.usuarios_afetados} usuário(s) afetado(s)`;
  return null;
}

function AuditoriaView({ logs }: { logs: AdminLog[] | null }) {
  if (!logs)
    return <div className="card text-center text-muted py-10">Não foi possível carregar a auditoria.</div>;
  if (logs.length === 0)
    return (
      <div className="card text-center text-muted py-10 flex flex-col items-center gap-2">
        <ScrollText size={32} />
        Nenhuma ação registrada ainda.
      </div>
    );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        Registro das ações sensíveis da plataforma (moderação de contas e troca de plano). Somente leitura.
      </p>
      {logs.map((l) => {
        const info = ACAO_INFO[l.acao] ?? { txt: l.acao, cls: "bg-slate-500/15 text-slate-500" };
        const det = detalheTexto(l.acao, l.detalhe);
        return (
          <div key={l.id} className="card space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${info.cls}`}>{info.txt}</span>
              <span className="text-xs text-muted">{quando(l.criadoEm)}</span>
            </div>
            <div className="text-sm font-medium truncate">{l.alvoDescricao ?? "—"}</div>
            <div className="text-xs text-muted">
              por {l.actorEmail}
              {det ? ` · ${det}` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- CHAMADOS */
function ChamadosView({
  chamados,
  filtro,
  setFiltro,
  alternar,
}: {
  chamados: Chamado[];
  filtro: "abertos" | "todos";
  setFiltro: (f: "abertos" | "todos") => void;
  alternar: (c: Chamado) => void;
}) {
  const lista = filtro === "abertos" ? chamados.filter((c) => c.status !== "resolvido") : chamados;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["abertos", "todos"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-xl px-4 py-2 text-sm font-medium border transition ${
              filtro === f ? "bg-brand-600 text-white border-brand-600" : "border-default text-muted hover:surface-alt"
            }`}
          >
            {f === "abertos" ? "Abertos" : "Todos"}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="card text-center text-muted py-10 flex flex-col items-center gap-2">
          <Inbox size={32} />
          {filtro === "abertos" ? "Nenhum chamado em aberto 🎉" : "Nenhum chamado ainda."}
        </div>
      ) : (
        lista.map((c) => (
          <div key={c.id} className={`card space-y-2 ${c.status === "resolvido" ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      c.tipo === "erro"
                        ? "bg-red-500/15 text-red-500"
                        : c.tipo === "sugestao"
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-brand-500/15 text-brand-600"
                    }`}
                  >
                    {TIPO_LABEL[c.tipo] ?? c.tipo}
                  </span>
                  {c.status === "resolvido" && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-600">
                      Resolvido
                    </span>
                  )}
                  <span className="text-xs text-muted">{quando(c.criadoEm)}</span>
                </div>
                <div className="font-semibold mt-1 truncate">{c.assunto}</div>
              </div>
            </div>

            <p className="text-sm whitespace-pre-wrap break-words">{c.mensagem}</p>

            <div className="flex items-center gap-3 text-xs text-muted flex-wrap pt-1">
              {c.nomeLoja && (
                <span className="flex items-center gap-1">
                  <Store size={13} /> {c.nomeLoja}
                </span>
              )}
              {c.emailContato && (
                <a href={`mailto:${c.emailContato}`} className="flex items-center gap-1 hover:text-brand-600">
                  <Mail size={13} /> {c.emailContato}
                </a>
              )}
              {c.whatsapp && (
                <a href={linkWhatsappSuporte()} className="flex items-center gap-1 hover:text-green-600">
                  <MessageCircle size={13} /> {c.whatsapp}
                </a>
              )}
            </div>

            <div className="pt-1">
              <button
                onClick={() => alternar(c)}
                className={`text-sm flex items-center gap-1.5 font-medium ${
                  c.status === "resolvido" ? "text-muted" : "text-green-600"
                }`}
              >
                {c.status === "resolvido" ? (
                  <>
                    <RotateCcw size={15} /> Reabrir
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} /> Marcar como resolvido
                  </>
                )}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
