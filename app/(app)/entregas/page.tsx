"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { parseNumero } from "@/lib/csvProdutos";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/analytics";
import type { Entrega, StatusEntrega } from "@/lib/types";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import Modal from "@/components/Modal";
import { usePlano } from "@/lib/usePlano";
import { planoQueLibera, brlPreco } from "@/lib/plans";
import { Aviso, EstadoVazio, PageHeader, Painel, Segmentado, Selo, Stat, type Tom } from "@/components/ui";
import {
  Truck,
  Plus,
  MapPin,
  Phone,
  Check,
  Bike,
  Sparkles,
  Route,
  Clock,
  DollarSign,
  Users,
  BadgeCheck,
  Zap,
  ArrowRight,
  PackageCheck,
  Undo2,
  Inbox,
  CircleDashed,
} from "lucide-react";

export default function EntregasPage() {
  return (
    <Guard>
      <Entregas />
    </Guard>
  );
}

const STATUS_LABEL: Record<StatusEntrega, string> = {
  pendente: "Pendente",
  a_caminho: "A caminho",
  entregue: "Entregue",
};
const STATUS_TOM: Record<StatusEntrega, Tom> = {
  pendente: "warn",
  a_caminho: "info",
  entregue: "ok",
};
const STATUS_ICONE = { pendente: CircleDashed, a_caminho: Bike, entregue: Check } as const;

function Entregas() {
  const {
    entregas,
    membros,
    role,
    usuarioId,
    addEntrega,
    atribuirMotoboy,
    setStatusEntrega,
    pegarEntrega,
    devolverEntrega,
    recarregarEntregas,
  } = useStore();
  const { caps } = usePlano();
  const { alerta } = useDialog();
  const dono = role === "owner";
  // entrega com gravação em andamento (desliga os botões do card; a store desfaz o
  // otimista se o banco recusar, então o erro PRECISA aparecer, senão o status
  // "volta sozinho" sem explicação)
  const [ocupada, setOcupada] = useState<string | null>(null);
  async function executar(id: string, acao: () => Promise<{ ok: boolean; erro?: string }>) {
    if (ocupada) return;
    setOcupada(id);
    const r = await acao();
    setOcupada(null);
    if (!r.ok) alerta({ titulo: "Não foi possível atualizar a entrega", mensagem: r.erro || "Tente novamente." });
  }
  const atribuir = (id: string, motoboyId: string | null) => executar(id, () => atribuirMotoboy(id, motoboyId));
  const mudarStatus = (id: string, st: StatusEntrega) => executar(id, () => setStatusEntrega(id, st));
  const devolver = (id: string) => executar(id, () => devolverEntrega(id));

  // realtime: o balcão e os status ficam vivos (nova entrega, alguém pegou, mudou status)
  useEffect(() => {
    const client = createClient();
    let ch: ReturnType<typeof client.channel> | null = null;
    let cancelado = false;
    (async () => {
      const { data } = await client.auth.getSession();
      if (cancelado) return;
      if (data.session) client.realtime.setAuth(data.session.access_token);
      ch = client
        .channel(`entregas-live-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "entrega" }, () => {
          recarregarEntregas();
        })
        .subscribe();
    })();
    return () => {
      cancelado = true;
      if (ch) client.removeChannel(ch);
    };
  }, [recarregarEntregas]);

  // hooks antes de qualquer return condicional (regra dos hooks: o plano/papel
  // carregam depois e mudariam a ordem dos hooks entre renders -> crash)
  const [aberto, setAberto] = useState(false);

  // owner em plano sem entregas vê o pitch de upgrade (entregas só no Expansão)
  if (dono && !caps.allowEntregas) {
    return <PitchEntregas />;
  }

  // motoboy: painel próprio com balcão de disponíveis + as suas
  if (!dono) {
    return (
      <MotoboyEntregas
        entregas={entregas}
        usuarioId={usuarioId}
        onPegar={pegarEntrega}
        onDevolver={devolver}
        onStatus={mudarStatus}
        ocupada={ocupada}
      />
    );
  }

  const motoboys = membros.filter((m) => m.role === "motoboy");

  const ativas = entregas.filter((e) => e.status !== "entregue");
  const concluidas = entregas.filter((e) => e.status === "entregue");

  const qtdPendentes = entregas.filter((e) => e.status === "pendente").length;
  const qtdACaminho = entregas.filter((e) => e.status === "a_caminho").length;

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        titulo="Entregas"
        descricao="Distribua as entregas entre os motoboys e acompanhe cada pedido."
        acoes={
          <button onClick={() => setAberto(true)} className="btn-primary btn-sm">
            <Plus size={17} aria-hidden /> Entrega
          </button>
        }
      />

      {entregas.length === 0 ? (
        <div className="card p-0">
          <EstadoVazio
            icone={Truck}
            titulo="Nenhuma entrega ainda."
            acao={
              <button onClick={() => setAberto(true)} className="btn-primary">
                <Plus size={17} aria-hidden /> Nova entrega
              </button>
            }
          >
            Crie uma entrega com o cliente e o endereço para acompanhar até a porta do cliente.
          </EstadoVazio>
        </div>
      ) : (
        <>
          <div className="grid-kpi lg:grid-cols-3 gap-3">
            <Stat rotulo="Pendentes" icone={CircleDashed} tom="warn" valor={qtdPendentes} apoio="aguardando saída" />
            <Stat rotulo="A caminho" icone={Bike} tom="info" valor={qtdACaminho} apoio="na rua agora" />
            <Stat
              className="col-span-2 lg:col-span-1"
              rotulo="Entregues"
              icone={Check}
              tom="ok"
              valor={concluidas.length}
              apoio="confirmadas e fechadas"
            />
          </div>

          <div className="grid gap-4 md:gap-5 lg:grid-cols-3 items-start">
            <div className="lg:col-span-2 min-w-0 space-y-2">
              <h2 className="section-title">Em aberto ({ativas.length})</h2>
              {ativas.length > 0 ? (
                <div className="card-list stagger">
                  {ativas.map((e) => (
                    <EntregaCard
                      key={e.id}
                      e={e}
                      dono={dono}
                      motoboys={motoboys}
                      nomeMotoboy={membros.find((m) => m.id === e.motoboyId)?.nome}
                      onAtribuir={atribuir}
                      onStatus={mudarStatus}
                      ocupada={ocupada === e.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="card p-0">
                  <EstadoVazio compacto titulo="Nenhuma entrega em aberto." />
                </div>
              )}
            </div>

            {concluidas.length > 0 && (
              <div className="min-w-0 space-y-2">
                <h2 className="section-title">Entregues ({concluidas.length})</h2>
                <div className="card-list stagger">
                  {concluidas.map((e) => (
                    <EntregaCard
                      key={e.id}
                      e={e}
                      dono={dono}
                      motoboys={motoboys}
                      nomeMotoboy={membros.find((m) => m.id === e.motoboyId)?.nome}
                      onAtribuir={atribuir}
                      onStatus={mudarStatus}
                      ocupada={ocupada === e.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {aberto && (
        <NovaEntrega
          motoboys={motoboys}
          onClose={() => setAberto(false)}
          onSalvar={async (dados) => {
            const r = await addEntrega(dados);
            if (r.ok) setAberto(false);
            return r;
          }}
        />
      )}
    </div>
  );
}

// Tela de venda do módulo de entregas para quem ainda não tem o plano.
function PitchEntregas() {
  const plano = planoQueLibera((p) => p.allowEntregas);
  const preco = plano ? brlPreco(plano.precoCentavos) : null;

  const recursos = [
    {
      icon: Users,
      titulo: "Motoboys com painel próprio",
      desc: "Cada entregador acessa só as entregas dele, com endereço, telefone e taxa. Sem grupo de WhatsApp, sem print, sem confusão.",
    },
    {
      icon: Route,
      titulo: "Atribuição em 1 toque",
      desc: "Distribua as entregas para o motoboy certo direto da tela. Quem está livre, quem está na rua — tudo organizado.",
    },
    {
      icon: Clock,
      titulo: "Acompanhamento em tempo real",
      desc: "Pendente → A caminho → Entregue. Você sabe o status de cada pedido sem precisar ligar e perguntar “já saiu?”.",
    },
    {
      icon: DollarSign,
      titulo: "Taxa de entrega no caixa",
      desc: "Cada entrega registra a taxa cobrada. No fim do dia você sabe exatamente quanto entrou de frete.",
    },
  ];

  const fluxo: { tom: Tom; label: string; desc: string }[] = [
    { tom: "warn", label: "Pendente", desc: "Pedido criado, aguardando saída" },
    { tom: "info", label: "A caminho", desc: "Motoboy saiu para entregar" },
    { tom: "ok", label: "Entregue", desc: "Confirmado e fechado" },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader titulo="Entregas" />

      {/* HERO */}
      <section className="card px-5 py-7 md:px-8 md:py-9">
        <div className="max-w-2xl space-y-4">
          <Selo tom="brand" icone={Sparkles}>
            Disponível no plano {plano?.nome ?? "Expansão"}
          </Selo>
          <h2 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight">
            Pare de gerenciar entrega no grito.
            <br />
            <span className="text-accent">Tenha uma operação de verdade.</span>
          </h2>
          <p className="text-sm md:text-base text-muted">
            Print no grupo, áudio de 3 minutos, “qual era mesmo o endereço?”. Cada entrega bagunçada é
            cliente irritado e dinheiro escapando. Coloque seus motoboys, suas rotas e suas taxas dentro
            da plataforma — e durma tranquilo sabendo onde está cada pedido.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/planos" className="btn-primary max-w-full">
              <Zap size={16} aria-hidden />
              {preco ? `Liberar entregas por ${preco}/mês` : "Ver planos"}
            </Link>
            <p className="text-xs text-muted flex items-center gap-1.5">
              <BadgeCheck size={13} className="text-accent shrink-0" aria-hidden /> Ativa na hora · cancele quando quiser
            </p>
          </div>
        </div>
      </section>

      {/* RECURSOS */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {recursos.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.titulo} className="card space-y-2">
              <span className="grid place-items-center h-9 w-9 rounded-lg tone-brand" aria-hidden>
                <Icon size={18} />
              </span>
              <div className="font-semibold">{r.titulo}</div>
              <p className="text-sm text-muted">{r.desc}</p>
            </div>
          );
        })}
      </section>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-3 items-start">
        {/* FLUXO */}
        <Painel titulo="Do pedido à porta do cliente" icone={Route} lista>
          {fluxo.map((f, i) => (
            <div key={f.label} className="flex items-start gap-3 px-4 py-3">
              <span className="text-xs font-bold text-muted tnum shrink-0 mt-0.5">{i + 1}</span>
              <div className="min-w-0">
                <Selo tom={f.tom}>{f.label}</Selo>
                <div className="text-sm text-muted mt-1">{f.desc}</div>
              </div>
            </div>
          ))}
        </Painel>

        {/* PROVA DE VALOR + CTA FINAL */}
        <section className="card lg:col-span-2 min-w-0 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold">Quanto custa NÃO ter isso?</h2>
            <p className="text-sm text-muted">
              Uma única entrega trocada de endereço já paga o plano. Some o tempo que você perde no
              WhatsApp coordenando motoboy e o cliente que não compra de novo porque “demorou e ninguém
              soube dizer onde estava”. {preco ? `Por ${preco}/mês` : "Por menos do que um delivery atrasado"}, você
              transforma a parte mais caótica da sua loja na mais organizada.
            </p>
          </div>
          {plano && (
            <div className="border border-default surface-alt p-4" style={{ borderRadius: "var(--r-input)" }}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">Plano {plano.nome}</span>
                <span className="text-accent font-bold tnum whitespace-nowrap">{brlPreco(plano.precoCentavos)}/mês</span>
              </div>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {plano.beneficios.map((b) => (
                  <li key={b} className="text-xs text-muted flex items-center gap-1.5">
                    <ArrowRight size={12} className="text-accent shrink-0" aria-hidden /> {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link href="/planos" className="btn-primary w-full">
            <Sparkles size={16} aria-hidden /> Quero gerenciar minhas entregas
          </Link>
        </section>
      </div>
    </div>
  );
}

// ----------------------------------------------------------- painel do motoboy
function MotoboyEntregas({
  entregas,
  usuarioId,
  onPegar,
  onDevolver,
  onStatus,
  ocupada,
}: {
  entregas: Entrega[];
  usuarioId: string | null;
  onPegar: (id: string) => Promise<{ ok: boolean; erro?: string }>;
  onDevolver: (id: string) => void;
  onStatus: (id: string, s: StatusEntrega) => void;
  ocupada: string | null;
}) {
  const { alerta } = useDialog();
  const [aba, setAba] = useState<"disponiveis" | "minhas">("disponiveis");
  const [ocupado, setOcupado] = useState<string | null>(null);

  const minhas = entregas.filter((e) => e.motoboyId === usuarioId);
  const disponiveis = entregas.filter((e) => !e.motoboyId && e.status !== "entregue");
  const minhasAtivas = minhas.filter((e) => e.status !== "entregue");
  const minhasFeitas = minhas.filter((e) => e.status === "entregue");

  async function pegar(id: string) {
    setOcupado(id);
    const r = await onPegar(id);
    setOcupado(null);
    if (!r.ok) alerta({ titulo: "Não deu para pegar", mensagem: r.erro || "Tente outra entrega." });
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader titulo="Minhas entregas" />

      <Segmentado
        rotulo="Lista de entregas"
        valor={aba}
        onChange={setAba}
        opcoes={
          [
            ["disponiveis", `Disponíveis (${disponiveis.length})`],
            ["minhas", `Minhas (${minhasAtivas.length})`],
          ] as const
        }
      />

      {aba === "disponiveis" ? (
        disponiveis.length === 0 ? (
          <div className="card p-0">
            <EstadoVazio icone={Inbox} titulo="Nenhuma entrega no balcão agora." />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">Toque em “Pegar” para assumir a entrega. Ela sai do balcão e vai para “Minhas”.</p>
            <div className="card-list stagger">
              {disponiveis.map((e) => (
                <div key={e.id} className="px-4 py-3.5 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <EntregaInfo e={e} />
                  </div>
                  <button
                    disabled={ocupado === e.id}
                    onClick={() => pegar(e.id)}
                    className="btn-primary w-full sm:w-auto shrink-0"
                  >
                    <PackageCheck size={16} aria-hidden /> {ocupado === e.id ? "Pegando…" : "Pegar entrega"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )
      ) : (
        <>
          {minhasAtivas.length === 0 && minhasFeitas.length === 0 && (
            <div className="card p-0">
              <EstadoVazio icone={Bike} titulo="Você ainda não pegou nenhuma entrega.">
                Veja o balcão em “Disponíveis”.
              </EstadoVazio>
            </div>
          )}
          {minhasAtivas.length > 0 && (
            <div className="space-y-2">
              <h2 className="section-title">Em aberto ({minhasAtivas.length})</h2>
              <div className="card-list stagger">
                {minhasAtivas.map((e) => (
                  <MinhaEntregaCard key={e.id} e={e} onStatus={onStatus} onDevolver={onDevolver} ocupada={ocupada === e.id} />
                ))}
              </div>
            </div>
          )}
          {minhasFeitas.length > 0 && (
            <div className="space-y-2">
              <h2 className="section-title">Entregues ({minhasFeitas.length})</h2>
              <div className="card-list stagger">
                {minhasFeitas.map((e) => (
                  <MinhaEntregaCard key={e.id} e={e} onStatus={onStatus} onDevolver={onDevolver} ocupada={ocupada === e.id} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// bloco de dados da entrega (cliente, endereço, telefone, taxa, status) reutilizado
function EntregaInfo({ e }: { e: Entrega }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-semibold truncate">{e.clienteNome || "Cliente"}</div>
        {e.endereco && (
          <div className="text-sm text-muted flex items-start gap-1.5 mt-0.5">
            <MapPin size={14} className="shrink-0 mt-0.5" aria-hidden />
            <span className="min-w-0 break-words">{e.endereco}</span>
          </div>
        )}
        {e.telefone && (
          <a
            href={`tel:${e.telefone}`}
            className="text-sm text-accent inline-flex items-center gap-1.5 min-h-[44px] tnum hover:underline"
          >
            <Phone size={14} aria-hidden /> {e.telefone}
          </a>
        )}
        {e.observacao && <div className="text-xs text-muted mt-0.5">{e.observacao}</div>}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Selo tom={STATUS_TOM[e.status]} icone={STATUS_ICONE[e.status]}>
          {STATUS_LABEL[e.status]}
        </Selo>
        {e.taxa > 0 && <div className="text-sm font-semibold tnum">{brl(e.taxa)}</div>}
      </div>
    </div>
  );
}

function MinhaEntregaCard({
  e,
  onStatus,
  onDevolver,
  ocupada,
}: {
  e: Entrega;
  onStatus: (id: string, s: StatusEntrega) => void;
  onDevolver: (id: string) => void;
  ocupada: boolean;
}) {
  return (
    <div className="px-4 py-3.5 space-y-3">
      <EntregaInfo e={e} />
      {e.status !== "entregue" && (
        <div className="flex flex-wrap gap-2">
          {e.status === "pendente" && (
            <button disabled={ocupada} onClick={() => onStatus(e.id, "a_caminho")} className="btn-ghost btn-sm !min-h-[44px] flex-auto whitespace-nowrap">
              <Bike size={16} aria-hidden /> Saí para entrega
            </button>
          )}
          <button disabled={ocupada} onClick={() => onStatus(e.id, "entregue")} className="btn-primary btn-sm !min-h-[44px] flex-auto whitespace-nowrap">
            <Check size={16} aria-hidden /> Entregue
          </button>
        </div>
      )}
      {e.status === "pendente" && (
        <button
          disabled={ocupada}
          onClick={() => onDevolver(e.id)}
          className="w-full min-h-[44px] text-sm text-muted hover:text-strong flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <Undo2 size={14} aria-hidden /> Devolver ao balcão
        </button>
      )}
    </div>
  );
}

function EntregaCard({
  e,
  dono,
  motoboys,
  nomeMotoboy,
  onAtribuir,
  onStatus,
  ocupada,
}: {
  e: Entrega;
  dono: boolean;
  motoboys: { id: string; nome: string | null }[];
  nomeMotoboy?: string | null;
  onAtribuir: (id: string, motoboyId: string | null) => void;
  onStatus: (id: string, s: StatusEntrega) => void;
  ocupada: boolean;
}) {
  return (
    <div className="px-4 py-3.5 space-y-3">
      <EntregaInfo e={e} />

      {!dono && nomeMotoboy && (
        <div className="text-xs text-muted flex items-center gap-1">
          <Bike size={12} aria-hidden /> {nomeMotoboy}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {dono && (
          <select
            className="input py-1.5 flex-1 basis-40 min-w-0"
            aria-label="Motoboy da entrega"
            disabled={ocupada}
            value={e.motoboyId ?? ""}
            onChange={(ev) => onAtribuir(e.id, ev.target.value || null)}
          >
            <option value="">Sem motoboy</option>
            {motoboys.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome || "Motoboy"}
              </option>
            ))}
          </select>
        )}

        {e.status !== "entregue" && (
          <div className="flex flex-wrap gap-2 flex-1 basis-56 sm:flex-none sm:basis-auto">
            {e.status === "pendente" && (
              <button
                disabled={ocupada}
                onClick={() => onStatus(e.id, "a_caminho")}
                className="btn-ghost btn-sm flex-auto whitespace-nowrap sm:flex-none"
              >
                <Bike size={15} aria-hidden /> Saí para entrega
              </button>
            )}
            <button
              disabled={ocupada}
              onClick={() => onStatus(e.id, "entregue")}
              className="btn-ghost btn-sm flex-auto whitespace-nowrap sm:flex-none"
            >
              <Check size={15} aria-hidden /> Entregue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NovaEntrega({
  motoboys,
  onClose,
  onSalvar,
}: {
  motoboys: { id: string; nome: string | null }[];
  onClose: () => void;
  onSalvar: (d: {
    clienteNome: string;
    endereco: string;
    telefone?: string;
    taxa?: number;
    motoboyId?: string | null;
    observacao?: string;
  }) => Promise<{ ok: boolean; erro?: string }>;
}) {
  const [cliente, setCliente] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [taxa, setTaxa] = useState("");
  const [motoboyId, setMotoboyId] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  return (
    <Modal onClose={onClose} titulo="Nova entrega">
        <div>
          <label className="label" htmlFor="ent-cliente">Cliente</label>
          <input id="ent-cliente" maxLength={120} className="input" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="ent-endereco">Endereço</label>
          <input id="ent-endereco" maxLength={300} className="input" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ent-telefone">Telefone</label>
            <input id="ent-telefone" maxLength={30} className="input" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ent-taxa">Taxa (R$)</label>
            <input id="ent-taxa" className="input" inputMode="decimal" placeholder="0,00" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
          </div>
        </div>
        {motoboys.length > 0 && (
          <div>
            <label className="label" htmlFor="ent-motoboy">Motoboy</label>
            <select id="ent-motoboy" className="input" value={motoboyId} onChange={(e) => setMotoboyId(e.target.value)}>
              <option value="">Atribuir depois</option>
              {motoboys.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome || "Motoboy"}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="ent-obs">Observação</label>
          <input id="ent-obs" maxLength={300} className="input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: ponto de referência" />
        </div>
        {erro && (
          <div role="alert"><Aviso tom="bad" className="!py-2">
            <span className="text-bad">{erro}</span>
          </Aviso></div>
        )}
        <button
          disabled={salvando}
          onClick={async () => {
            if (!cliente.trim() && !endereco.trim()) {
              setErro("Informe o cliente ou o endereço da entrega.");
              return;
            }
            const taxaNum = taxa.trim() ? parseNumero(taxa) : 0;
            if (!Number.isFinite(taxaNum) || taxaNum < 0) {
              setErro("Informe a taxa em reais (ex.: 8,00) ou deixe em branco.");
              return;
            }
            setErro(null);
            setSalvando(true);
            const r = await onSalvar({
              clienteNome: cliente,
              endereco,
              telefone: telefone || undefined,
              taxa: taxaNum,
              motoboyId: motoboyId || null,
              observacao: obs || undefined,
            });
            setSalvando(false);
            if (!r.ok) setErro(r.erro || "Não foi possível criar a entrega.");
          }}
          className="btn-primary w-full"
        >
          {salvando ? "Criando…" : "Criar entrega"}
        </button>
    </Modal>
  );
}

