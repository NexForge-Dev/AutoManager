"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/analytics";
import type { Entrega, StatusEntrega } from "@/lib/types";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import { usePlano } from "@/lib/usePlano";
import { planoQueLibera, brlPreco } from "@/lib/plans";
import {
  Truck,
  Plus,
  X,
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
const STATUS_COR: Record<StatusEntrega, string> = {
  pendente: "text-amber-500",
  a_caminho: "text-blue-500",
  entregue: "text-green-500",
};

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
  const dono = role === "owner";

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
        .channel("entregas-live")
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
        onDevolver={devolverEntrega}
        onStatus={setStatusEntrega}
      />
    );
  }

  const motoboys = membros.filter((m) => m.role === "motoboy");

  const ativas = entregas.filter((e) => e.status !== "entregue");
  const concluidas = entregas.filter((e) => e.status === "entregue");

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Truck className="text-brand-600" />
          <h1 className="text-2xl font-bold">Entregas</h1>
        </div>
        {dono && (
          <button onClick={() => setAberto(true)} className="btn-primary py-2 px-3 text-sm">
            <Plus size={18} /> Entrega
          </button>
        )}
      </header>

      {entregas.length === 0 && (
        <div className="card text-center text-muted">
          {dono ? "Nenhuma entrega ainda." : "Nenhuma entrega atribuída a você."}
        </div>
      )}

      {ativas.length > 0 && (
        <div className="space-y-2 stagger">
          <h2 className="text-sm font-semibold text-muted">Em aberto ({ativas.length})</h2>
          {ativas.map((e) => (
            <EntregaCard
              key={e.id}
              e={e}
              dono={dono}
              motoboys={motoboys}
              nomeMotoboy={membros.find((m) => m.id === e.motoboyId)?.nome}
              onAtribuir={atribuirMotoboy}
              onStatus={setStatusEntrega}
            />
          ))}
        </div>
      )}

      {concluidas.length > 0 && (
        <div className="space-y-2 stagger">
          <h2 className="text-sm font-semibold text-muted">Entregues ({concluidas.length})</h2>
          {concluidas.map((e) => (
            <EntregaCard
              key={e.id}
              e={e}
              dono={dono}
              motoboys={motoboys}
              nomeMotoboy={membros.find((m) => m.id === e.motoboyId)?.nome}
              onAtribuir={atribuirMotoboy}
              onStatus={setStatusEntrega}
            />
          ))}
        </div>
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

  const fluxo = [
    { cor: "text-amber-500", label: "Pendente", desc: "Pedido criado, aguardando saída" },
    { cor: "text-blue-500", label: "A caminho", desc: "Motoboy saiu para entregar" },
    { cor: "text-green-500", label: "Entregue", desc: "Confirmado e fechado" },
  ];

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2 pt-1">
        <Truck className="text-brand-600" />
        <h1 className="text-2xl font-bold">Entregas</h1>
      </header>

      {/* HERO */}
      <section className="card relative overflow-hidden text-center py-10 px-6 space-y-4">
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-brand-500/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-brand-500/10 blur-2xl" />
        <div className="relative space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 text-brand-500 text-xs font-bold px-3 py-1">
            <Sparkles size={13} /> Disponível no plano {plano?.nome ?? "Expansão"}
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold leading-tight max-w-xl mx-auto">
            Pare de gerenciar entrega no grito.
            <br />
            <span className="text-brand-500">Tenha uma operação de verdade.</span>
          </h2>
          <p className="text-sm md:text-base text-muted max-w-lg mx-auto">
            Print no grupo, áudio de 3 minutos, “qual era mesmo o endereço?”. Cada entrega bagunçada é
            cliente irritado e dinheiro escapando. Coloque seus motoboys, suas rotas e suas taxas dentro
            da plataforma — e durma tranquilo sabendo onde está cada pedido.
          </p>
          <Link href="/planos" className="btn-primary inline-flex w-auto px-7 mx-auto">
            <Zap size={16} />
            {preco ? `Liberar entregas por ${preco}/mês` : "Ver planos"}
          </Link>
          <p className="text-xs text-muted flex items-center justify-center gap-1.5">
            <BadgeCheck size={13} className="text-brand-500" /> Ativa na hora · cancele quando quiser
          </p>
        </div>
      </section>

      {/* RECURSOS */}
      <section className="grid gap-3 sm:grid-cols-2">
        {recursos.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.titulo} className="card space-y-2">
              <div className="h-10 w-10 rounded-xl bg-brand-500/10 grid place-items-center">
                <Icon size={20} className="text-brand-500" />
              </div>
              <div className="font-semibold">{r.titulo}</div>
              <p className="text-sm text-muted">{r.desc}</p>
            </div>
          );
        })}
      </section>

      {/* FLUXO */}
      <section className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Route size={18} className="text-brand-500" /> Do pedido à porta do cliente
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {fluxo.map((f, i) => (
            <div key={f.label} className="surface-alt rounded-xl p-3 flex items-start gap-2">
              <span className="text-xs font-bold text-muted shrink-0">{i + 1}</span>
              <div>
                <div className={`text-sm font-semibold ${f.cor}`}>{f.label}</div>
                <div className="text-xs text-muted">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PROVA DE VALOR + CTA FINAL */}
      <section className="card space-y-4">
        <div className="space-y-1">
          <div className="text-lg font-bold">Quanto custa NÃO ter isso?</div>
          <p className="text-sm text-muted">
            Uma única entrega trocada de endereço já paga o plano. Some o tempo que você perde no
            WhatsApp coordenando motoboy e o cliente que não compra de novo porque “demorou e ninguém
            soube dizer onde estava”. {preco ? `Por ${preco}/mês` : "Por menos do que um delivery atrasado"}, você
            transforma a parte mais caótica da sua loja na mais organizada.
          </p>
        </div>
        {plano && (
          <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold">Plano {plano.nome}</span>
              <span className="text-brand-500 font-bold">{brlPreco(plano.precoCentavos)}/mês</span>
            </div>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {plano.beneficios.map((b) => (
                <li key={b} className="text-xs text-muted flex items-center gap-1.5">
                  <ArrowRight size={12} className="text-brand-500 shrink-0" /> {b}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link href="/planos" className="btn-primary w-full">
          <Sparkles size={16} /> Quero gerenciar minhas entregas
        </Link>
      </section>
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
}: {
  entregas: Entrega[];
  usuarioId: string | null;
  onPegar: (id: string) => Promise<{ ok: boolean; erro?: string }>;
  onDevolver: (id: string) => void;
  onStatus: (id: string, s: StatusEntrega) => void;
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

  function tab(id: "disponiveis" | "minhas", label: string) {
    return (
      <button
        onClick={() => setAba(id)}
        className={`chip ${aba === id ? "bg-brand-600 text-white border-brand-600" : "border-default"}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center gap-2 pt-1">
        <Truck className="text-brand-600" />
        <h1 className="text-2xl font-bold">Minhas entregas</h1>
      </header>

      <div className="flex gap-2">
        {tab("disponiveis", `Disponíveis (${disponiveis.length})`)}
        {tab("minhas", `Minhas (${minhasAtivas.length})`)}
      </div>

      {aba === "disponiveis" ? (
        disponiveis.length === 0 ? (
          <div className="card text-center text-muted py-8 flex flex-col items-center gap-2">
            <Inbox size={28} /> Nenhuma entrega no balcão agora.
          </div>
        ) : (
          <>
            <p className="text-xs text-muted">Toque em “Pegar” para assumir a entrega. Ela sai do balcão e vai para “Minhas”.</p>
            <div className="space-y-2 stagger">
              {disponiveis.map((e) => (
                <div key={e.id} className="card space-y-2">
                  <EntregaInfo e={e} />
                  <button
                    disabled={ocupado === e.id}
                    onClick={() => pegar(e.id)}
                    className="btn-primary w-full py-2 text-sm disabled:opacity-60"
                  >
                    <PackageCheck size={16} /> {ocupado === e.id ? "Pegando…" : "Pegar entrega"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )
      ) : (
        <>
          {minhasAtivas.length === 0 && minhasFeitas.length === 0 && (
            <div className="card text-center text-muted py-8">
              Você ainda não pegou nenhuma entrega. Veja o balcão em “Disponíveis”.
            </div>
          )}
          {minhasAtivas.length > 0 && (
            <div className="space-y-2 stagger">
              <h2 className="text-sm font-semibold text-muted">Em aberto ({minhasAtivas.length})</h2>
              {minhasAtivas.map((e) => (
                <MinhaEntregaCard key={e.id} e={e} onStatus={onStatus} onDevolver={onDevolver} />
              ))}
            </div>
          )}
          {minhasFeitas.length > 0 && (
            <div className="space-y-2 stagger">
              <h2 className="text-sm font-semibold text-muted">Entregues ({minhasFeitas.length})</h2>
              {minhasFeitas.map((e) => (
                <MinhaEntregaCard key={e.id} e={e} onStatus={onStatus} onDevolver={onDevolver} />
              ))}
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
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="font-semibold truncate">{e.clienteNome || "Cliente"}</div>
        {e.endereco && (
          <div className="text-xs text-muted flex items-center gap-1">
            <MapPin size={12} /> {e.endereco}
          </div>
        )}
        {e.telefone && (
          <a href={`tel:${e.telefone}`} className="text-xs text-brand-500 flex items-center gap-1">
            <Phone size={12} /> {e.telefone}
          </a>
        )}
        {e.observacao && <div className="text-xs text-muted mt-0.5">{e.observacao}</div>}
      </div>
      <div className="text-right shrink-0">
        {e.taxa > 0 && <div className="text-sm font-semibold">{brl(e.taxa)}</div>}
        <div className={`text-xs font-medium ${STATUS_COR[e.status]}`}>{STATUS_LABEL[e.status]}</div>
      </div>
    </div>
  );
}

function MinhaEntregaCard({
  e,
  onStatus,
  onDevolver,
}: {
  e: Entrega;
  onStatus: (id: string, s: StatusEntrega) => void;
  onDevolver: (id: string) => void;
}) {
  return (
    <div className="card space-y-2">
      <EntregaInfo e={e} />
      {e.status !== "entregue" && (
        <div className="flex gap-2">
          {e.status === "pendente" && (
            <button onClick={() => onStatus(e.id, "a_caminho")} className="btn-ghost flex-1 py-2 text-sm">
              <Bike size={16} /> Saí para entrega
            </button>
          )}
          <button onClick={() => onStatus(e.id, "entregue")} className="btn-primary flex-1 py-2 text-sm">
            <Check size={16} /> Entregue
          </button>
        </div>
      )}
      {e.status === "pendente" && (
        <button onClick={() => onDevolver(e.id)} className="w-full py-1.5 text-xs text-muted flex items-center justify-center gap-1">
          <Undo2 size={14} /> Devolver ao balcão
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
}: {
  e: Entrega;
  dono: boolean;
  motoboys: { id: string; nome: string | null }[];
  nomeMotoboy?: string | null;
  onAtribuir: (id: string, motoboyId: string | null) => void;
  onStatus: (id: string, s: StatusEntrega) => void;
}) {
  return (
    <div className="card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold truncate">{e.clienteNome || "Cliente"}</div>
          {e.endereco && (
            <div className="text-xs text-muted flex items-center gap-1">
              <MapPin size={12} /> {e.endereco}
            </div>
          )}
          {e.telefone && (
            <a href={`tel:${e.telefone}`} className="text-xs text-brand-500 flex items-center gap-1">
              <Phone size={12} /> {e.telefone}
            </a>
          )}
          {e.observacao && <div className="text-xs text-muted mt-0.5">{e.observacao}</div>}
        </div>
        <div className="text-right shrink-0">
          {e.taxa > 0 && <div className="text-sm font-semibold">{brl(e.taxa)}</div>}
          <div className={`text-xs font-medium ${STATUS_COR[e.status]}`}>
            {STATUS_LABEL[e.status]}
          </div>
        </div>
      </div>

      {dono && (
        <select
          className="input py-1.5 text-sm"
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
      {!dono && nomeMotoboy && (
        <div className="text-xs text-muted flex items-center gap-1">
          <Bike size={12} /> {nomeMotoboy}
        </div>
      )}

      {e.status !== "entregue" && (
        <div className="flex gap-2">
          {e.status === "pendente" && (
            <button
              onClick={() => onStatus(e.id, "a_caminho")}
              className="btn-ghost flex-1 py-2 text-sm"
            >
              <Bike size={16} /> Saí para entrega
            </button>
          )}
          <button
            onClick={() => onStatus(e.id, "entregue")}
            className="btn-primary flex-1 py-2 text-sm"
          >
            <Check size={16} /> Entregue
          </button>
        </div>
      )}
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
    <div className="fixed inset-0 bg-black/40 z-40 flex items-end md:items-center justify-center">
      <div className="surface w-full max-w-md rounded-t-3xl md:rounded-3xl p-5 space-y-3 max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Nova entrega</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <div>
          <label className="label">Cliente</label>
          <input className="input" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        </div>
        <div>
          <label className="label">Endereço</label>
          <input className="input" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Telefone</label>
            <input className="input" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
          <div>
            <label className="label">Taxa (R$)</label>
            <input className="input" inputMode="decimal" placeholder="0,00" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
          </div>
        </div>
        {motoboys.length > 0 && (
          <div>
            <label className="label">Motoboy</label>
            <select className="input" value={motoboyId} onChange={(e) => setMotoboyId(e.target.value)}>
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
          <label className="label">Observação</label>
          <input className="input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: ponto de referência" />
        </div>
        {erro && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-xl px-3 py-2">{erro}</p>
        )}
        <button
          disabled={salvando}
          onClick={async () => {
            if (!cliente && !endereco) return;
            setErro(null);
            setSalvando(true);
            const r = await onSalvar({
              clienteNome: cliente,
              endereco,
              telefone: telefone || undefined,
              taxa: parseFloat(taxa) || 0,
              motoboyId: motoboyId || null,
              observacao: obs || undefined,
            });
            setSalvando(false);
            if (!r.ok) setErro(r.erro || "Não foi possível criar a entrega.");
          }}
          className="btn-primary w-full disabled:opacity-60"
        >
          {salvando ? "Criando…" : "Criar entrega"}
        </button>
      </div>
    </div>
  );
}
