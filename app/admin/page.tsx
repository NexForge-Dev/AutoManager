"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { waLink } from "@/lib/contato";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { brlPreco, ORDEM_PLANOS, PLANOS, type PlanoId } from "@/lib/plans";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import { SkeletonMetrics, SkeletonList } from "@/components/Skeleton";
import { Aviso, EstadoVazio, PageHeader, Painel, Progresso, Segmentado, Selo, Stat, type Tom } from "@/components/ui";
import type { Chamado } from "@/lib/types";
import {
  AlertTriangle,
  Lock,
  LogOut,
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

const PLANO_TOM: Record<PlanoId, Tom> = {
  ambulante: "info",
  solo: "neutral",
  equipe: "brand",
  expansao: "warn",
};

const STATUS_INFO: Record<string, { txt: string; tom: Tom }> = {
  active: { txt: "Ativa", tom: "ok" },
  trialing: { txt: "Trial", tom: "brand" },
  past_due: { txt: "Pendente", tom: "warn" },
  canceled: { txt: "Cancelada", tom: "bad" },
  trial_vencido: { txt: "Trial vencido", tom: "warn" },
  cortesia: { txt: "Cortesia", tom: "info" },
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

const ACESSO_INFO: Record<Acesso, { txt: string; tom: Tom }> = {
  ativo: { txt: "Ativa", tom: "ok" },
  desativado: { txt: "Desativada", tom: "warn" },
  banido: { txt: "Banida", tom: "bad" },
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
  const router = useRouter();
  const { confirm } = useDialog();
  const listarChamados = useStore((s) => s.listarChamados);
  const resolverChamado = useStore((s) => s.resolverChamado);

  const autorizado = useStore((s) => s.superadmin);

  const [aba, setAba] = useState<"resumo" | "lojas" | "chamados" | "auditoria">("resumo");
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [logs, setLogs] = useState<AdminLog[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<"abertos" | "todos">("abertos");
  const [erroChamados, setErroChamados] = useState<string | null>(null);

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
    setChamados(lista.chamados);
    setErroChamados(lista.erro ?? null);
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
    const r = await resolverChamado(c.id, resolvido);
    if (!r.ok) {
      // volta ao estado anterior e avisa (antes ficava "resolvido" só na tela)
      setChamados((cs) => cs.map((x) => (x.id === c.id ? c : x)));
      setErroChamados(r.erro || "Não foi possível atualizar o chamado.");
    }
  }

  async function sair() {
    const ok = await confirm({
      titulo: "Sair da conta?",
      mensagem: "Você precisará entrar de novo com seu e-mail e senha.",
      confirmar: "Sair",
      perigo: true,
    });
    if (!ok) return;
    await createClient().auth.signOut();
    // não deixa os dados da conta na memória para o próximo login neste navegador
    useStore.getState().limpar();
    router.replace("/login");
  }

  if (!autorizado) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <div className="space-y-3 max-w-sm">
          <span className="mx-auto grid place-items-center h-11 w-11 rounded-xl tone-neutral" aria-hidden>
            <Lock size={21} />
          </span>
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
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        titulo="Admin"
        descricao="Painel da plataforma AutoManager"
        acoes={
          <>
            <button onClick={carregar} className="btn-ghost btn-sm" disabled={carregando}>
              <RefreshCw size={16} className={carregando ? "animate-spin" : ""} aria-hidden /> Atualizar
            </button>
            <button onClick={sair} className="btn-ghost btn-sm">
              <LogOut size={16} aria-hidden /> Sair
            </button>
          </>
        }
      />

      {/* abas */}
      <Segmentado
        rotulo="Seções do painel"
        valor={aba}
        onChange={setAba}
        opcoes={[
          ["resumo", "Resumo"],
          ["lojas", "Lojas & usuários"],
          ["chamados", `Chamados${abertos ? ` (${abertos})` : ""}`],
          ["auditoria", "Auditoria"],
        ] as const}
      />

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
          erro={erroChamados}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- RESUMO */
function ResumoView({ overview }: { overview: Overview | null }) {
  if (!overview)
    return (
      <div className="card p-0">
        <EstadoVazio icone={AlertTriangle} titulo="Não foi possível carregar o resumo." />
      </div>
    );
  const r = overview.resumo;

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat rotulo="Faturamento mensal (MRR)" icone={DollarSign} tom="brand" valorTom="brand" valor={brlPreco(r.mrrCentavos)} />
        <Stat rotulo="Projeção anual (ARR)" icone={TrendingUp} valor={brlPreco(r.arrCentavos)} />
        <Stat rotulo="Assinaturas ativas" icone={CheckCircle2} tom="ok" valor={r.ativas} />
        <Stat rotulo="Em teste grátis" icone={Sparkles} tom="info" valor={r.trial} />
        <Stat rotulo="Total de lojas" icone={Store} valor={r.totalLojas} />
        <Stat rotulo="Canceladas" icone={Ban} tom="bad" valor={r.canceladas} />
      </div>

      <Painel titulo="Faturamento por plano" icone={Crown}>
        <div className="space-y-3.5">
          {r.porPlano.map((p) => {
            const pct = r.mrrCentavos > 0 ? Math.round((p.mrrCentavos / r.mrrCentavos) * 100) : 0;
            return (
              <div key={p.plano}>
                <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                  <span className="flex items-center gap-2 min-w-0">
                    <Selo tom={PLANO_TOM[p.plano]}>{p.nome}</Selo>
                    <span className="text-muted truncate">{p.ativas} ativa(s)</span>
                  </span>
                  <span className="font-semibold tnum shrink-0">{brlPreco(p.mrrCentavos)}/mês</span>
                </div>
                <Progresso pct={pct} className="h-1.5" rotulo={`Participação do plano ${p.nome} no faturamento`} />
              </div>
            );
          })}
        </div>
      </Painel>
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
      mensagem: `"${l.nome}" — de ${PLANOS[l.plano].nome} para ${PLANOS[plano].nome}.\n\nA troca é aplicada na hora, sem cobrança e sem vencimento (cortesia), e encerra o teste grátis. Num plano menor, o que passar do limite (revendedoras, vendedores, motoboys/entregas) fica bloqueado — nada é apagado. Loja com assinatura ativa no Stripe não recebe plano manual: cancele a assinatura antes.`,
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

  if (!overview)
    return (
      <div className="card p-0">
        <EstadoVazio icone={AlertTriangle} titulo="Não foi possível carregar as lojas." />
      </div>
    );

  const termo = busca.trim().toLowerCase();
  const lojas = termo
    ? overview.lojas.filter(
        (l) =>
          l.nome.toLowerCase().includes(termo) ||
          (l.ownerEmail ?? "").toLowerCase().includes(termo) ||
          (l.slug ?? "").toLowerCase().includes(termo)
      )
    : overview.lojas;

  // selos, plano e moderação são os mesmos na tabela (desktop) e nas linhas (celular)
  const selos = (l: Loja) => {
    const st = STATUS_INFO[l.status] ?? STATUS_INFO.active;
    return (
      <>
        <Selo tom={st.tom}>{st.txt}</Selo>
        {l.acesso !== "ativo" && <Selo tom={ACESSO_INFO[l.acesso].tom}>{ACESSO_INFO[l.acesso].txt}</Selo>}
      </>
    );
  };

  // troca manual de plano (cortesia / suporte)
  const seletorPlano = (l: Loja, id: string) => (
    <select
      id={id}
      className="input min-h-[40px] xl:min-h-[36px] py-1 md:text-sm"
      aria-label={`Mudar plano de ${l.nome}`}
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
  );

  // moderação da conta
  const moderacao = (l: Loja) => (
    <>
      {l.acesso === "ativo" ? (
        <>
          <button onClick={() => moderar(l, "desativar")} disabled={salvando === l.orgId} className="btn-ghost btn-sm text-warn">
            <Power size={14} aria-hidden /> Desativar
          </button>
          <button onClick={() => moderar(l, "banir")} disabled={salvando === l.orgId} className="btn-danger btn-sm">
            <Ban size={14} aria-hidden /> Banir
          </button>
        </>
      ) : (
        <button onClick={() => moderar(l, "reativar")} disabled={salvando === l.orgId} className="btn-ghost btn-sm text-ok">
          <RotateCcw size={14} aria-hidden /> Reativar
        </button>
      )}
      <button onClick={() => moderar(l, "deletar")} disabled={salvando === l.orgId} className="btn-danger btn-sm">
        <Trash2 size={14} aria-hidden /> Deletar
      </button>
    </>
  );

  const linkLoja = (l: Loja) =>
    l.slug && (
      <a
        href={`/loja/${l.slug}`}
        className="inline-flex items-center gap-1 min-w-0 text-xs text-muted hover:text-accent"
        target="_blank"
        rel="noreferrer"
      >
        <Store size={12} className="shrink-0" aria-hidden /> <span className="truncate">/{l.slug}</span>
      </a>
    );

  return (
    <div className="space-y-3">
      <div>
        <input
          className="input"
          aria-label="Buscar lojas"
          placeholder="Buscar por loja, e-mail ou link…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <p className="hint">
          {lojas.length} loja(s){termo ? ` de ${overview.lojas.length}` : ""}
        </p>
      </div>

      {lojas.length === 0 ? (
        <div className="card p-0">
          {termo ? (
            <EstadoVazio compacto titulo="Nenhuma loja encontrada." />
          ) : (
            <EstadoVazio icone={Store} titulo="Nenhuma loja cadastrada ainda." />
          )}
        </div>
      ) : (
        <>
          {/* desktop: tabela */}
          <div className="card p-0 overflow-hidden hidden xl:block">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Loja</th>
                    <th>Situação</th>
                    <th className="min-w-[14.5rem]">Plano</th>
                    <th className="!text-right">Mensalidade</th>
                    <th className="!text-right">Moderação</th>
                  </tr>
                </thead>
                <tbody>
                  {lojas.map((l) => (
                    <tr key={l.orgId}>
                      <td className="max-w-[260px]">
                        <div className="font-semibold truncate">{l.nome}</div>
                        <div className="text-xs text-muted truncate">
                          {l.ownerEmail ?? "sem dono"} · {l.membros} usuário(s)
                        </div>
                        <div className="flex">{linkLoja(l)}</div>
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">{selos(l)}</div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {seletorPlano(l, `plano-t-${l.orgId}`)}
                          {salvando === l.orgId && <Loader2 size={14} className="animate-spin text-accent shrink-0" aria-hidden />}
                        </div>
                      </td>
                      <td className="num">
                        <div>{l.status === "active" ? `${brlPreco(l.precoCentavos)}/mês` : "-"}</div>
                        <div className="text-xs text-muted">desde {dataCurta(l.desde)}</div>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">{moderacao(l)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* celular e tablet: linhas */}
          <div className="card-list xl:hidden">
            {lojas.map((l) => (
              <div key={l.orgId} className="px-4 py-3 space-y-2.5">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{l.nome}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5 min-w-0">
                    <Users size={12} className="shrink-0" aria-hidden />
                    <span className="truncate">
                      {l.ownerEmail ?? "sem dono"} · {l.membros} usuário(s)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selos(l)}
                  <span className="text-xs text-muted tnum">
                    {l.status === "active" ? `${brlPreco(l.precoCentavos)}/mês` : "-"} · desde {dataCurta(l.desde)}
                  </span>
                </div>
                {linkLoja(l)}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted shrink-0">Mudar plano:</span>
                  {seletorPlano(l, `plano-l-${l.orgId}`)}
                  {salvando === l.orgId && <Loader2 size={14} className="animate-spin text-accent shrink-0" aria-hidden />}
                </div>
                <div className="flex items-center gap-2 flex-wrap [&>button:last-child]:ml-auto">{moderacao(l)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- AUDITORIA */
const ACAO_INFO: Record<string, { txt: string; tom: Tom }> = {
  desativar: { txt: "Desativou", tom: "warn" },
  banir: { txt: "Baniu", tom: "bad" },
  reativar: { txt: "Reativou", tom: "ok" },
  deletar: { txt: "Deletou", tom: "bad" },
  mudar_plano: { txt: "Mudou plano", tom: "brand" },
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
    return (
      <div className="card p-0">
        <EstadoVazio icone={AlertTriangle} titulo="Não foi possível carregar a auditoria." />
      </div>
    );
  if (logs.length === 0)
    return (
      <div className="card p-0">
        <EstadoVazio icone={ScrollText} titulo="Nenhuma ação registrada ainda." />
      </div>
    );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Registro das ações sensíveis da plataforma (moderação de contas e troca de plano). Somente leitura.
      </p>

      {/* desktop: tabela */}
      <div className="card p-0 overflow-hidden hidden lg:block">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ação</th>
                <th>Alvo</th>
                <th>Autor</th>
                <th>Detalhe</th>
                <th className="!text-right">Quando</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const info = ACAO_INFO[l.acao] ?? { txt: l.acao, tom: "neutral" as Tom };
                return (
                  <tr key={l.id}>
                    <td>
                      <Selo tom={info.tom}>{info.txt}</Selo>
                    </td>
                    <td className="max-w-[220px] truncate font-medium">{l.alvoDescricao ?? "—"}</td>
                    <td className="max-w-[220px] truncate text-muted">{l.actorEmail}</td>
                    <td className="text-muted">{detalheTexto(l.acao, l.detalhe) ?? "—"}</td>
                    <td className="num text-muted">{quando(l.criadoEm)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* celular e tablet: linhas */}
      <div className="card-list lg:hidden">
        {logs.map((l) => {
          const info = ACAO_INFO[l.acao] ?? { txt: l.acao, tom: "neutral" as Tom };
          const det = detalheTexto(l.acao, l.detalhe);
          return (
            <div key={l.id} className="px-4 py-3 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Selo tom={info.tom}>{info.txt}</Selo>
                <span className="text-xs text-muted tnum">{quando(l.criadoEm)}</span>
              </div>
              <div className="text-sm font-medium truncate">{l.alvoDescricao ?? "—"}</div>
              <div className="text-xs text-muted break-words">
                por {l.actorEmail}
                {det ? ` · ${det}` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- CHAMADOS */
const TIPO_TOM: Record<string, Tom> = { erro: "bad", sugestao: "warn", duvida: "brand" };

const FILTROS_CHAMADO = [
  ["abertos", "Abertos"],
  ["todos", "Todos"],
] as const;

function ChamadosView({
  chamados,
  filtro,
  setFiltro,
  alternar,
  erro,
}: {
  chamados: Chamado[];
  filtro: "abertos" | "todos";
  setFiltro: (f: "abertos" | "todos") => void;
  alternar: (c: Chamado) => void;
  erro: string | null;
}) {
  const lista = filtro === "abertos" ? chamados.filter((c) => c.status !== "resolvido") : chamados;

  return (
    <div className="space-y-3">
      <Segmentado rotulo="Filtrar chamados" opcoes={FILTROS_CHAMADO} valor={filtro} onChange={setFiltro} />

      {erro && (
        <div role="alert">
          <Aviso tom="bad" icone={AlertTriangle}>
            {erro}
          </Aviso>
        </div>
      )}
      {lista.length === 0 && !erro ? (
        <div className="card p-0">
          <EstadoVazio icone={Inbox} titulo={filtro === "abertos" ? "Nenhum chamado em aberto" : "Nenhum chamado ainda."} />
        </div>
      ) : lista.length > 0 ? (
        <div className="card-list">
          {lista.map((c) => (
            <article key={c.id} className="px-4 py-3.5 space-y-2">
              <div className={`space-y-2 ${c.status === "resolvido" ? "opacity-70" : ""}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Selo tom={TIPO_TOM[c.tipo] ?? "brand"}>{TIPO_LABEL[c.tipo] ?? c.tipo}</Selo>
                  {c.status === "resolvido" && <Selo tom="ok">Resolvido</Selo>}
                  <span className="text-xs text-muted tnum">{quando(c.criadoEm)}</span>
                </div>
                <h3 className="font-semibold truncate">{c.assunto}</h3>
                <p className="text-sm whitespace-pre-wrap break-words">{c.mensagem}</p>
                <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted flex-wrap">
                  {c.nomeLoja && (
                    <span className="flex items-center gap-1">
                      <Store size={13} aria-hidden /> {c.nomeLoja}
                    </span>
                  )}
                  {c.emailContato && (
                    <a href={`mailto:${c.emailContato}`} className="flex items-center gap-1 min-w-0 break-all hover:text-accent">
                      <Mail size={13} className="shrink-0" aria-hidden /> {c.emailContato}
                    </a>
                  )}
                  {c.whatsapp && (
                    <a href={waLink(c.whatsapp)} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ok">
                      <MessageCircle size={13} aria-hidden /> {c.whatsapp}
                    </a>
                  )}
                </div>
              </div>

              <button
                onClick={() => alternar(c)}
                className={`btn-ghost btn-sm ${c.status === "resolvido" ? "text-muted" : "text-ok"}`}
              >
                {c.status === "resolvido" ? (
                  <>
                    <RotateCcw size={15} aria-hidden /> Reabrir
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} aria-hidden /> Marcar como resolvido
                  </>
                )}
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
