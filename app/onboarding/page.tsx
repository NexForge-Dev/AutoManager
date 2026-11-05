"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { SEGMENTOS } from "@/lib/seed";
import type { Canal } from "@/lib/types";
import { usePlano } from "@/lib/usePlano";
import { createClient } from "@/lib/supabase/client";
import { destinoPosLogin } from "@/lib/destinoPosLogin";
import { falhaDeRedeAuth } from "@/lib/cargaLoja";
import { apagarRascunho, gravarRascunho, lerRascunho } from "@/lib/rascunho";
import { TelaFalhaCarga } from "@/components/FalhaCarga";
import { registrarMetrica, type Etapa } from "@/lib/metricas/cliente";

// Passos desta tela -> etapas do funil no Painel NexForge ("descricao" faz parte de "loja").
const ETAPA_METRICA: Record<string, Etapa> = {
  nome: "loja",
  conteudo: "segmento",
  plano: "plano",
  revendedoras: "revendedoras",
  lucro: "margem",
  contato: "contato",
};
import {
  fmtLimite,
  planoDef,
  PLANOS,
  ORDEM_PLANOS,
  planoValido,
  brlPreco,
  type PlanoId,
} from "@/lib/plans";
import {
  ArrowLeft,
  BarChart3,
  Bike,
  Check,
  ChevronRight,
  Facebook,
  Gem,
  Gift,
  Instagram,
  Loader2,
  Mail,
  MessageCircle,
  Music2,
  Search,
  Settings2,
  Store,
  Users,
  Wallet,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { Aviso, Progresso, Selo } from "@/components/ui";

// Quantidade de revendedoras oferecida no onboarding, limitada ao que o
// plano escolhido permite (ambulante nem chega a perguntar).
const REV_BUCKETS: Record<string, string[]> = {
  solo: ["0", "1-3"],
  equipe: ["0", "1-5", "6-15"],
  expansao: ["0", "1-5", "6-20", "20+"],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Passo = { icone: LucideIcon; title: string; sub: string; ms: number };

const CHAVE_RASCUNHO = "am_onboarding";

export default function Onboarding() {
  const router = useRouter();
  const { setConfig, completarOnboarding, hydrate, tentarDeNovo } = useStore();
  const ready = useStore((s) => s.ready);
  const falhaEssencial = useStore((s) => s.falhaEssencial);
  const completo = useStore((s) => s.config.onboardingCompleto);
  const { planoContratado } = usePlano();
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (!ready) hydrate();
  }, [ready, hydrate]);

  // Só o DONO da loja faz o onboarding. Visitante anônimo (chat da loja),
  // revendedora, conta sem loja ou membro da equipe vai para o próprio destino.
  const [liberado, setLiberado] = useState(false);
  // leitura falhou: não se sabe quem é. Nem libera (sobrescreveria a loja) nem manda embora.
  const [falhaLeitura, setFalhaLeitura] = useState(false);
  useEffect(() => {
    if (!ready || liberado || falhaEssencial || falhaLeitura) return;
    let ativo = true;
    (async () => {
      const { data, error } = await createClient().auth.getUser();
      if (!ativo) return;
      if (falhaDeRedeAuth(error)) {
        setFalhaLeitura(true);
        return;
      }
      if (!data.user || data.user.is_anonymous) {
        router.replace("/login");
        return;
      }
      const { semOrg, role } = useStore.getState();
      if (semOrg || role !== "owner") {
        let destino: string;
        try {
          destino = await destinoPosLogin();
        } catch {
          if (ativo) setFalhaLeitura(true);
          return;
        }
        if (ativo) router.replace(destino === "/onboarding" ? "/login" : destino);
        return;
      }
      setLiberado(true);
    })().catch(() => {
      if (ativo) setFalhaLeitura(true);
    });
    return () => {
      ativo = false;
    };
  }, [ready, liberado, falhaEssencial, falhaLeitura, router]);

  // onboarding já concluído: sai daqui (evita re-rodar / sobrescrever a config).
  // Durante a geração NÃO redireciona aqui — a tela de carregamento controla o
  // momento de ir pro painel; senão o redirect cortava a animação no meio.
  useEffect(() => {
    if (ready && liberado && completo && !gerando) router.replace("/painel");
  }, [ready, liberado, completo, gerando, router]);

  // rascunho desta aba: refresh no meio não perde o que já foi respondido
  const [rascunho] = useState(() => lerRascunho<Record<string, any>>(CHAVE_RASCUNHO) ?? {});
  const [step, setStep] = useState<number>(rascunho.step ?? 0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");

  // respostas
  const [nomeLoja, setNomeLoja] = useState<string>(rascunho.nomeLoja ?? "");
  const [descricao, setDescricao] = useState<string>(rascunho.descricao ?? "");
  const [segmento, setSegmento] = useState<string>(rascunho.segmento ?? "semijoias");
  const [planoEscolhido, setPlanoEscolhido] = useState<PlanoId>(
    planoValido(rascunho.planoEscolhido) ? rascunho.planoEscolhido : planoContratado || "solo"
  );
  // plano escolhido na landing (guardado pelo /login?plano=...)
  useEffect(() => {
    if (rascunho.planoEscolhido) return; // já decidiu aqui: a escolha do rascunho vale
    try {
      const p = sessionStorage.getItem("am_plano_landing");
      if (planoValido(p)) setPlanoEscolhido(p);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [qtdRev, setQtdRev] = useState<string>(rascunho.qtdRev ?? "1-3");
  const [margem, setMargem] = useState<number>(rascunho.margem ?? 100);
  const [comissao, setComissao] = useState<number>(rascunho.comissao ?? 30);
  const [whatsapp, setWhatsapp] = useState<string>(rascunho.whatsapp ?? "");
  const [instagram, setInstagram] = useState<string>(rascunho.instagram ?? "");
  const [facebook, setFacebook] = useState<string>(rascunho.facebook ?? "");
  const [tiktok, setTiktok] = useState<string>(rascunho.tiktok ?? "");
  const [email, setEmail] = useState<string>(rascunho.email ?? "");

  useEffect(() => {
    if (completo) apagarRascunho(CHAVE_RASCUNHO);
    else
      gravarRascunho(CHAVE_RASCUNHO, {
        step, nomeLoja, descricao, segmento, planoEscolhido, qtdRev, margem, comissao,
        whatsapp, instagram, facebook, tiktok, email,
      });
  }, [completo, step, nomeLoja, descricao, segmento, planoEscolhido, qtdRev, margem, comissao, whatsapp, instagram, facebook, tiktok, email]);

  // escopo de perguntas conforme o PLANO ESCOLHIDO no onboarding
  const plano = planoDef(planoEscolhido);
  const temRevendedoras = plano.maxRevendedoras > 0;
  const temEquipe = plano.allowVendedores;
  const temEntregas = plano.allowEntregas;
  const revBuckets = REV_BUCKETS[plano.id] ?? ["0", "1-5", "6-20", "20+"];

  // Sequência de passos (a etapa de revendedoras só entra se o plano tiver).
  const steps = [
    "nome",
    "descricao",
    "conteudo",
    "plano",
    ...(temRevendedoras ? ["revendedoras"] : []),
    "lucro",
    "contato",
  ];
  const totalSteps = steps.length;
  const stepKey = steps[Math.min(step, totalSteps - 1)];
  // Progresso exibido com total FIXO (todos os passos possíveis): escolher um
  // plano sem revendedoras não muda mais o "de N" no meio do caminho — o passo
  // pulado só avança a barra.
  const PASSOS_VISIVEIS = ["nome", "descricao", "conteudo", "plano", "revendedoras", "lucro", "contato"];
  const totalVisivel = PASSOS_VISIVEIS.length;
  const passoVisivel = Math.max(0, PASSOS_VISIVEIS.indexOf(stepKey));
  const usaRevendedoras = temRevendedoras && qtdRev !== "0";

  // garante que a quantidade de revendedoras seja uma opção válida do plano
  useEffect(() => {
    const buckets = REV_BUCKETS[plano.id];
    if (buckets && !buckets.includes(qtdRev)) setQtdRev(buckets[1] ?? "0");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plano.id]);

  // Trabalho real (gravação no store + plano). Desacoplado da animação.
  async function executar() {
    // trava de segurança: nunca sobrescreve a config se já concluiu
    if (useStore.getState().config.onboardingCompleto) return;

    const canais: Canal[] = ["whatsapp"];
    if (instagram.trim()) canais.push("instagram");

    const cfg = await setConfig({
      nomeLoja: nomeLoja || "Minha Loja",
      lojaDescricao: descricao.trim() || null,
      segmento,
      canais,
      usaRevendedoras,
      margemPadrao: margem,
      comissaoPadrao: comissao,
      lojaWhatsapp: whatsapp.trim() || null,
      lojaInstagram: instagram.trim() || null,
      lojaFacebook: facebook.trim() || null,
      lojaTiktok: tiktok.trim() || null,
      lojaEmail: email.trim() || null,
    });
    if (!cfg.ok) throw new Error(cfg.erro || "Não foi possível salvar os dados da loja.");

    // define o plano escolhido como trial de 1 mês (grátis); a rota é idempotente,
    // então "tentar de novo" pode repetir sem estender o trial
    let res: Response;
    try {
      res = await fetch("/api/onboarding/plano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: planoEscolhido }),
      });
    } catch {
      throw new Error("Sem conexão para ativar o teste grátis. Confira a internet e tente de novo.");
    }
    // 409 = a loja já tem plano definido (assinatura paga ou cortesia do admin): segue o onboarding
    if (!res.ok && res.status !== 409) {
      const json = await res.json().catch(() => ({}));
      throw new Error(
        typeof json?.erro === "string" && json.erro
          ? `Não foi possível ativar o teste grátis: ${json.erro}`
          : "Não foi possível ativar o teste grátis."
      );
    }
    await hydrate(); // recarrega a assinatura pro painel já refletir o trial

    const fim = await completarOnboarding();
    if (!fim.ok) throw new Error(fim.erro || "Não foi possível concluir a configuração.");
    registrarMetrica({ tipo: "etapa", etapa: "contato" });
    registrarMetrica({ tipo: "onboarding" });
  }

  // Passos da tela de carregamento — personalizados pelas respostas.
  function montarPassos(): Passo[] {
    const segLabel = (SEGMENTOS.find((s) => s.id === segmento)?.label || "loja").toLowerCase();
    const loja = nomeLoja.trim() || "sua loja";
    const passos: Passo[] = [
      { icone: Search, title: "Analisando seu perfil", sub: `Entendendo sua ${segLabel}`, ms: 1100 },
      { icone: Store, title: "Criando sua loja", sub: `Montando a vitrine de ${loja}`, ms: 1200 },
      { icone: Gift, title: "Ativando seu mês grátis", sub: `Plano ${plano.nome} — 30 dias por nossa conta`, ms: 1100 },
    ];
    if (usaRevendedoras)
      passos.push({ icone: Wallet, title: "Configurando comissões", sub: "Cálculo automático das revendedoras", ms: 1050 });
    if (temEquipe)
      passos.push({ icone: Users, title: "Preparando sua equipe", sub: "Acessos de vendedores e ranking", ms: 1000 });
    if (temEntregas)
      passos.push({ icone: Bike, title: "Ativando as entregas", sub: "Rotas e acompanhamento de motoboys", ms: 1000 });
    passos.push({ icone: Settings2, title: "Criando seu sistema admin", sub: "Ligando seu painel de controle", ms: 1200 });
    passos.push({ icone: BarChart3, title: "Preparando seus relatórios", sub: "Lucro, vendas e estoque em tempo real", ms: 1000 });
    return passos;
  }

  const next = () => {
    const etapa = ETAPA_METRICA[steps[step]];
    if (etapa) registrarMetrica({ tipo: "etapa", etapa });
    setDir("fwd");
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };
  const back = () => {
    setDir("back");
    setStep((s) => Math.max(s - 1, 0));
  };

  if (falhaEssencial || falhaLeitura)
    return (
      <TelaFalhaCarga
        onTentar={() => {
          setFalhaLeitura(false);
          void tentarDeNovo();
        }}
      />
    );

  if (!liberado && !gerando) {
    return (
      <div className="min-h-screen grid place-items-center text-accent" role="status" aria-label="Carregando">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (gerando) {
    return (
      <GeneratingScreen
        passos={montarPassos()}
        loja={nomeLoja.trim() || "Minha Loja"}
        executar={executar}
        onConcluir={() => router.replace("/painel")}
      />
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col md:items-center md:justify-center md:px-5 md:py-10">
      <div className="w-full flex-1 md:flex-none max-w-lg flex flex-col px-5 py-5 md:p-8 md:border md:border-default md:surface md:rounded-[var(--r-card)] md:shadow-[var(--shadow-md)]">
        {/* progresso */}
        <div className="mb-7">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="inline-flex items-center gap-2 font-bold text-accent">
              <Gem size={18} aria-hidden /> AutoManager
            </span>
            <span className="text-xs font-medium text-muted tnum">
              Passo {passoVisivel + 1} de {totalVisivel}
            </span>
          </div>
          <div
            className="flex gap-1"
            role="progressbar"
            aria-label="Progresso da configuração"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(((passoVisivel + 1) / totalVisivel) * 100)}
          >
            {Array.from({ length: totalVisivel }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                  i <= passoVisivel ? "bg-brand-500" : "surface-alt"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-x-clip">
          <div key={step} className={dir === "fwd" ? "ob-in-right" : "ob-in-left"}>
            {/* ---------- nome ---------- */}
            {stepKey === "nome" && (
              <div className="space-y-5">
                <div>
                  <h1 className="page-title">Vamos dar vida ao seu negócio</h1>
                  <p className="text-muted mt-2">
                    Em 2 minutos seu estoque, suas vendas e seu lucro ficam no controle,
                    do seu jeito, sem planilha.
                  </p>
                </div>
                <div>
                  <label htmlFor="ob-nome" className="label">Como o seu negócio se chama?</label>
                  <input
                    id="ob-nome"
                    className="input"
                    placeholder="Ex.: Doces da Ana, Bijoux da Lu, Moda Bella…"
                    value={nomeLoja}
                    onChange={(e) => setNomeLoja(e.target.value)}
                    autoFocus
                  />
                  <p className="hint">Pode trocar depois: esse nome é seu.</p>
                </div>
              </div>
            )}

            {/* ---------- descrição ---------- */}
            {stepKey === "descricao" && (
              <div className="space-y-5">
                <Cabecalho titulo="Resuma sua loja em uma frase">
                  Aparece logo abaixo do nome, pra cliente entender na hora o que você vende.
                </Cabecalho>
                <div>
                  <textarea
                    aria-label="Descrição da loja"
                    className="input"
                    rows={3}
                    placeholder="Ex.: Semijoias folheadas com garantia e entrega rápida."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    autoFocus
                  />
                  <p className="hint">Pode deixar em branco e preencher depois.</p>
                </div>
              </div>
            )}

            {/* ---------- tipo de conteúdo / segmento ---------- */}
            {stepKey === "conteudo" && (
              <div className="space-y-5">
                <Cabecalho titulo="Qual o tipo do seu negócio?">
                  Isso ajusta as categorias e os relatórios pra você.
                </Cabecalho>
                <div className="grid grid-cols-2 gap-2.5">
                  {SEGMENTOS.map((s) => (
                    <Opcao key={s.id} sel={segmento === s.id} onClick={() => setSegmento(s.id)}>
                      {s.label}
                    </Opcao>
                  ))}
                </div>
              </div>
            )}

            {/* ---------- plano (1 mês grátis) ---------- */}
            {stepKey === "plano" && (
              <div className="space-y-4">
                <Cabecalho titulo="Escolha seu plano">
                  O <b>1º mês é grátis</b>. Só depois começa a cobrar, e você cancela quando quiser.
                </Cabecalho>
                <div className="card-list">
                  {ORDEM_PLANOS.map((id) => {
                    const def = PLANOS[id];
                    const sel = planoEscolhido === id;
                    return (
                      <button
                        type="button"
                        key={id}
                        aria-pressed={sel}
                        onClick={() => setPlanoEscolhido(id)}
                        className={`row ${sel ? "bg-brand-500/10" : ""}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="font-bold">{def.nome}</span>
                            {def.destaque && <Selo tom="brand">Mais vendido</Selo>}
                          </span>
                          <span className="block text-sm mt-0.5">
                            <span className="text-accent font-semibold">1º mês grátis</span>
                            <span className="text-muted tnum"> · depois {brlPreco(def.precoCentavos)}/mês</span>
                          </span>
                          <span className="block text-xs text-muted mt-0.5">{def.publico}</span>
                        </span>
                        <Marcador sel={sel} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---------- revendedoras ---------- */}
            {stepKey === "revendedoras" && (
              <div className="space-y-5">
                <Cabecalho titulo="Quem vende junto com você?">
                  Sua rede de revendedoras: o plano {plano.nome} inclui até{" "}
                  <b>{fmtLimite(plano.maxRevendedoras)}</b>.
                </Cabecalho>
                <div className="grid grid-cols-2 gap-2.5">
                  {revBuckets.map((q) => (
                    <Opcao key={q} sel={qtdRev === q} onClick={() => setQtdRev(q)}>
                      {q === "0" ? "Só eu por enquanto" : q} {q === "0" ? "" : "revendedoras"}
                    </Opcao>
                  ))}
                </div>
                <p className="text-sm text-muted">
                  {usaRevendedoras
                    ? "Combinado! Eu calculo a comissão e quanto cada uma te deve, no automático."
                    : "Tranquilo: você toca tudo, e dá pra adicionar sua equipe quando quiser."}
                </p>
              </div>
            )}

            {/* ---------- lucro ---------- */}
            {stepKey === "lucro" && (
              <div className="space-y-7">
                <div>
                  <Cabecalho titulo="Quanto você quer lucrar?">
                    Uso isso pra sugerir o preço de venda certinho pra você.
                  </Cabecalho>
                  <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Margem de lucro">
                    {[50, 100, 200].map((m) => (
                      <button
                        type="button"
                        key={m}
                        aria-pressed={margem === m}
                        onClick={() => setMargem(m)}
                        className="chip min-h-[44px] px-5 tnum"
                      >
                        {m}%
                      </button>
                    ))}
                  </div>
                </div>
                {usaRevendedoras && (
                  <div>
                    <Cabecalho titulo="Quanto sua equipe ganha por venda?">
                      A comissão padrão de cada revendedora.
                    </Cabecalho>
                    <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Comissão padrão">
                      {[20, 30, 40].map((c) => (
                        <button
                          type="button"
                          key={c}
                          aria-pressed={comissao === c}
                          onClick={() => setComissao(c)}
                          className="chip min-h-[44px] px-5 tnum"
                        >
                          {c}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---------- contato + redes ---------- */}
            {stepKey === "contato" && (
              <div className="space-y-4">
                <Cabecalho titulo="Como te encontram?">
                  Suas redes e contato aparecem na sua loja online. Tudo opcional.
                </Cabecalho>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ob-whatsapp" className="label flex items-center gap-1.5"><MessageCircle size={14} aria-hidden /> WhatsApp</label>
                    <input
                      id="ob-whatsapp"
                      className="input"
                      inputMode="tel"
                      placeholder="Ex.: 11 99999-9999"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="ob-instagram" className="label flex items-center gap-1.5"><Instagram size={14} aria-hidden /> Instagram</label>
                    <input id="ob-instagram" className="input" placeholder="@sualoja" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="ob-facebook" className="label flex items-center gap-1.5"><Facebook size={14} aria-hidden /> Facebook</label>
                    <input id="ob-facebook" className="input" placeholder="sualoja" value={facebook} onChange={(e) => setFacebook(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="ob-tiktok" className="label flex items-center gap-1.5"><Music2 size={14} aria-hidden /> TikTok</label>
                    <input id="ob-tiktok" className="input" placeholder="@sualoja" value={tiktok} onChange={(e) => setTiktok(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="ob-email" className="label flex items-center gap-1.5"><Mail size={14} aria-hidden /> E-mail da loja <span className="text-muted font-normal">(opcional)</span></label>
                    <input
                      id="ob-email"
                      className="input"
                      type="email"
                      placeholder="contato@sualoja.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 flex gap-2">
          {step > 0 && (
            <button type="button" onClick={back} className="btn-ghost">
              <ArrowLeft size={17} aria-hidden /> Voltar
            </button>
          )}
          {step < totalSteps - 1 ? (
            <button type="button" onClick={next} className="btn-primary flex-1">
              Continuar <ChevronRight size={19} aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={() => setGerando(true)} disabled={!ready} className="btn-primary flex-1">
              Concluir e criar minha loja
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function Cabecalho({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-bold leading-tight">{titulo}</h2>
      <p className="text-sm text-muted mt-1">{children}</p>
    </div>
  );
}

function Marcador({ sel }: { sel: boolean }) {
  return (
    <span
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
        sel ? "border-brand-600 bg-brand-600 text-white" : "border-default"
      }`}
      aria-hidden
    >
      {sel && <Check size={13} strokeWidth={3} />}
    </span>
  );
}

function Opcao({ sel, onClick, children }: { sel: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={sel}
      onClick={onClick}
      className={`card flex items-center justify-between gap-2 p-3 min-h-[56px] text-left ${
        sel ? "!border-brand-500 bg-brand-500/10" : ""
      }`}
    >
      <span className="font-semibold text-sm">{children}</span>
      <Marcador sel={sel} />
    </button>
  );
}

// ============================================================================
// Tela de carregamento: toca após "Concluir". Lista os passos personalizados
// e marca cada um enquanto o store grava de verdade.
// ============================================================================
function GeneratingScreen({
  passos,
  loja,
  executar,
  onConcluir,
}: {
  passos: Passo[];
  loja: string;
  executar: () => Promise<void>;
  onConcluir: () => void;
}) {
  const total = passos.length;
  const [atual, setAtual] = useState(0); // passo em andamento
  const [feitos, setFeitos] = useState(0); // quantos concluídos
  const [pronto, setPronto] = useState(false);
  const iniciado = useRef(false); // evita rodar 2x (StrictMode em dev)
  const [erro, setErro] = useState<string | null>(null);
  const [tentando, setTentando] = useState(false);

  useEffect(() => {
    if (iniciado.current) return; // roda exatamente uma vez
    iniciado.current = true;
    // grava no store em paralelo; a falha vira tela de erro (não segue pro painel,
    // senão o próximo login cairia de novo no onboarding)
    const trabalho = executar().then(
      () => null,
      (e: any) => String(e?.message || e)
    );
    (async () => {
      for (let i = 0; i < passos.length; i++) {
        setAtual(i);
        await sleep(passos[i].ms);
        setFeitos(i + 1);
      }
      const falha = await trabalho; // garante que o backend terminou antes de seguir
      if (falha) {
        setErro(falha);
        return;
      }
      setPronto(true);
      await sleep(2200); // deixa a confirmação visível antes de ir pro painel
      onConcluir();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tentarDeNovo() {
    setTentando(true);
    try {
      await executar();
      setErro(null);
      setPronto(true);
      await sleep(2200);
      onConcluir();
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setTentando(false);
    }
  }

  const pct = pronto ? 100 : Math.round((feitos / total) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] text-[var(--text)] overflow-auto">
      <div className="min-h-full flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">
          <div key={pronto ? "done" : "gerando"} className="ob-anim-rise" role="status" aria-live="polite">
            <h1 className="page-title">{pronto ? "Tudo pronto!" : `Criando ${loja}`}</h1>
            <p className="text-sm text-muted mt-1">
              {pronto
                ? `${loja} foi criada. Para publicar a loja online, use "Minha Loja" no painel.`
                : passos[Math.min(atual, total - 1)].title}
            </p>
          </div>

          <div className="mt-5">
            <Progresso pct={pct} rotulo="Progresso da criação da loja" />
          </div>

          <ol className="mt-5 space-y-1">
            {passos.map((p, i) => {
              const feito = pronto || i < feitos;
              const emAndamento = !pronto && !erro && i === atual && !feito;
              const Icone = p.icone;
              return (
                <li key={p.title} className="flex items-center gap-3 min-h-[44px]">
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      feito ? "tone-ok" : emAndamento ? "tone-brand" : "tone-neutral"
                    }`}
                    aria-hidden
                  >
                    {feito ? (
                      <Check size={16} strokeWidth={3} />
                    ) : emAndamento ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Icone size={16} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-medium ${feito || emAndamento ? "" : "text-muted"}`}>{p.title}</span>
                    {emAndamento && <span className="block text-xs text-muted">{p.sub}</span>}
                  </span>
                </li>
              );
            })}
          </ol>

          {erro && (
            <div className="mt-4 space-y-3" role="alert">
              <Aviso tom="bad" icone={AlertCircle}>{erro}</Aviso>
              <button onClick={tentarDeNovo} disabled={tentando} className="btn-primary w-full">
                {tentando ? <Loader2 className="animate-spin" size={18} aria-hidden /> : "Tentar de novo"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
