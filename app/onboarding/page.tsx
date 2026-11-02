"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { SEGMENTOS } from "@/lib/seed";
import type { Canal } from "@/lib/types";
import { usePlano } from "@/lib/usePlano";
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
  brlPreco,
  type PlanoId,
} from "@/lib/plans";
import {
  Check,
  ChevronRight,
  Sparkles,
  Loader2,
  MessageCircle,
  Instagram,
  Facebook,
  Music2,
  Mail,
} from "lucide-react";

// Quantidade de revendedoras oferecida no onboarding, limitada ao que o
// plano escolhido permite (ambulante nem chega a perguntar).
const REV_BUCKETS: Record<string, string[]> = {
  solo: ["0", "1-3"],
  equipe: ["0", "1-5", "6-15"],
  expansao: ["0", "1-5", "6-20", "20+"],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Passo = { emoji: string; title: string; sub: string; ms: number };

export default function Onboarding() {
  const router = useRouter();
  const { setConfig, completarOnboarding, hydrate } = useStore();
  const ready = useStore((s) => s.ready);
  const completo = useStore((s) => s.config.onboardingCompleto);
  const { planoContratado } = usePlano();
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (!ready) hydrate();
  }, [ready, hydrate]);

  // onboarding já concluído: sai daqui (evita re-rodar / sobrescrever a config).
  // Durante a geração NÃO redireciona aqui — a tela de carregamento controla o
  // momento de ir pro painel; senão o redirect cortava a animação no meio.
  useEffect(() => {
    if (ready && completo && !gerando) router.replace("/painel");
  }, [ready, completo, gerando, router]);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");

  // respostas
  const [nomeLoja, setNomeLoja] = useState("");
  const [descricao, setDescricao] = useState("");
  const [segmento, setSegmento] = useState("semijoias");
  const [planoEscolhido, setPlanoEscolhido] = useState<PlanoId>(planoContratado || "solo");
  // plano escolhido na landing (guardado pelo /login?plano=...)
  useEffect(() => {
    try {
      const p = sessionStorage.getItem("am_plano_landing");
      if (p && p in PLANOS) setPlanoEscolhido(p as PlanoId);
    } catch {}
  }, []);
  const [qtdRev, setQtdRev] = useState("1-3");
  const [margem, setMargem] = useState(100);
  const [comissao, setComissao] = useState(30);
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [email, setEmail] = useState("");

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
    const res = await fetch("/api/onboarding/plano", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plano: planoEscolhido }),
    });
    // 409 = a loja já tem plano definido (assinatura paga ou cortesia do admin): segue o onboarding
    if (!res.ok && res.status !== 409) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.erro || "Não foi possível ativar o teste grátis.");
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
      { emoji: "🔍", title: "Analisando seu perfil", sub: `Entendendo sua ${segLabel}`, ms: 1100 },
      { emoji: "🏪", title: "Criando sua loja", sub: `Montando a vitrine de ${loja}`, ms: 1200 },
      { emoji: "🎁", title: "Ativando seu mês grátis", sub: `Plano ${plano.nome} — 30 dias por nossa conta`, ms: 1100 },
    ];
    if (usaRevendedoras)
      passos.push({ emoji: "💸", title: "Configurando comissões", sub: "Cálculo automático das revendedoras", ms: 1050 });
    if (temEquipe)
      passos.push({ emoji: "👥", title: "Preparando sua equipe", sub: "Acessos de vendedores e ranking", ms: 1000 });
    if (temEntregas)
      passos.push({ emoji: "🛵", title: "Ativando as entregas", sub: "Rotas e acompanhamento de motoboys", ms: 1000 });
    passos.push({ emoji: "⚙️", title: "Criando seu sistema admin", sub: "Ligando seu painel de controle", ms: 1200 });
    passos.push({ emoji: "📊", title: "Preparando seus relatórios", sub: "Lucro, vendas e estoque em tempo real", ms: 1000 });
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
    <div className="min-h-screen max-w-md mx-auto px-5 py-6 flex flex-col">
      {/* progresso */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-semibold text-muted mb-2">
          <span>Passo {passoVisivel + 1} de {totalVisivel}</span>
          <span>{Math.round(((passoVisivel + 1) / totalVisivel) * 100)}%</span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: totalVisivel }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                i <= passoVisivel ? "bg-brand-600" : "surface-alt"
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
              <div className="inline-grid place-items-center h-14 w-14 rounded-2xl bg-brand-600/10 text-brand-500 ob-anim-bob">
                <Sparkles size={28} />
              </div>
              <h1 className="text-2xl font-bold leading-tight">
                Vamos dar vida ao seu negócio 🚀
              </h1>
              <p className="text-muted">
                Em 2 minutos seu estoque, suas vendas e seu lucro ficam no controle —
                do seu jeito, sem planilha.
              </p>
              <div>
                <label className="label">Como o seu negócio se chama?</label>
                <input
                  className="input"
                  placeholder="Ex.: Doces da Ana, Bijoux da Lu, Moda Bella…"
                  value={nomeLoja}
                  onChange={(e) => setNomeLoja(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted mt-1.5">Pode trocar depois — esse nome é seu. ✨</p>
              </div>
            </div>
          )}

          {/* ---------- descrição ---------- */}
          {stepKey === "descricao" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Resuma sua loja em uma frase ✍️</h2>
                <p className="text-sm text-muted mt-1">
                  Aparece logo abaixo do nome, pra cliente entender na hora o que você vende.
                </p>
              </div>
              <textarea
                className="input"
                rows={3}
                placeholder="Ex.: Semijoias folheadas com garantia e entrega rápida."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted">Pode deixar em branco e preencher depois.</p>
            </div>
          )}

          {/* ---------- tipo de conteúdo / segmento ---------- */}
          {stepKey === "conteudo" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Qual o tipo do seu negócio?</h2>
                <p className="text-sm text-muted mt-1">Isso ajusta as categorias e os relatórios pra você.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {SEGMENTOS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSegmento(s.id)}
                    className={`card text-left transition active:scale-[.98] ${
                      segmento === s.id ? "ring-2 ring-brand-500 bg-brand-500/5" : "hover:surface-alt"
                    }`}
                  >
                    <span className="font-semibold">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---------- plano (1 mês grátis) ---------- */}
          {stepKey === "plano" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold">Escolha seu plano 🎁</h2>
                <p className="text-sm text-muted mt-1">
                  O <b>1º mês é grátis</b>. Só depois começa a cobrar, e você cancela quando quiser.
                </p>
              </div>
              <div className="space-y-2.5">
                {ORDEM_PLANOS.map((id) => {
                  const def = PLANOS[id];
                  const sel = planoEscolhido === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setPlanoEscolhido(id)}
                      className={`card w-full text-left transition active:scale-[.99] ${
                        sel ? "ring-2 ring-brand-500 bg-brand-500/5" : "hover:surface-alt"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{def.nome}</span>
                        {def.destaque && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-600 text-white">
                            Mais vendido
                          </span>
                        )}
                        {sel && <Check size={18} className="text-brand-600 ml-auto" />}
                      </div>
                      <div className="text-sm mt-0.5">
                        <span className="text-brand-500 font-bold">1º mês grátis</span>
                        <span className="text-muted"> · depois {brlPreco(def.precoCentavos)}/mês</span>
                      </div>
                      <p className="text-xs text-muted mt-1">{def.publico}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------- revendedoras ---------- */}
          {stepKey === "revendedoras" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Quem vende junto com você?</h2>
                <p className="text-sm text-muted mt-1">
                  Sua rede de revendedoras — o plano {plano.nome} inclui até{" "}
                  <b>{fmtLimite(plano.maxRevendedoras)}</b>.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {revBuckets.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQtdRev(q)}
                    className={`card text-left transition active:scale-[.98] ${
                      qtdRev === q ? "ring-2 ring-brand-500 bg-brand-500/5" : "hover:surface-alt"
                    }`}
                  >
                    <span className="font-semibold">
                      {q === "0" ? "Só eu por enquanto" : q} {q === "0" ? "" : "revendedoras"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted">
                {usaRevendedoras
                  ? "Combinado! Eu calculo a comissão e quanto cada uma te deve, no automático. ✨"
                  : "Tranquilo — você toca tudo, e dá pra adicionar sua equipe quando quiser. 💪"}
              </p>
            </div>
          )}

          {/* ---------- lucro ---------- */}
          {stepKey === "lucro" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">Quanto você quer lucrar?</h2>
                <p className="text-sm text-muted mb-3">Uso isso pra sugerir o preço de venda certinho pra você.</p>
                <div className="flex flex-wrap gap-2">
                  {[50, 100, 200].map((m) => (
                    <span
                      key={m}
                      onClick={() => setMargem(m)}
                      className={`chip transition active:scale-95 ${
                        margem === m ? "bg-brand-600 text-white border-brand-600" : "border-default"
                      }`}
                    >
                      {m}%
                    </span>
                  ))}
                </div>
              </div>
              {usaRevendedoras && (
                <div>
                  <h2 className="text-xl font-bold mb-1">Quanto sua equipe ganha por venda?</h2>
                  <p className="text-sm text-muted mb-3">A comissão padrão de cada revendedora.</p>
                  <div className="flex flex-wrap gap-2">
                    {[20, 30, 40].map((c) => (
                      <span
                        key={c}
                        onClick={() => setComissao(c)}
                        className={`chip transition active:scale-95 ${
                          comissao === c
                            ? "bg-brand-600 text-white border-brand-600"
                            : "border-default"
                        }`}
                      >
                        {c}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---------- contato + redes ---------- */}
          {stepKey === "contato" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold">Como te encontram? 📲</h2>
                <p className="text-sm text-muted mt-1">
                  Suas redes e contato aparecem na sua loja online. Tudo opcional.
                </p>
              </div>
              <div>
                <label className="label flex items-center gap-1"><MessageCircle size={13} /> WhatsApp</label>
                <input
                  className="input"
                  inputMode="tel"
                  placeholder="Ex.: 11 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>
              <div>
                <label className="label flex items-center gap-1"><Instagram size={13} /> Instagram</label>
                <input className="input" placeholder="@sualoja" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
              </div>
              <div>
                <label className="label flex items-center gap-1"><Facebook size={13} /> Facebook</label>
                <input className="input" placeholder="sualoja" value={facebook} onChange={(e) => setFacebook(e.target.value)} />
              </div>
              <div>
                <label className="label flex items-center gap-1"><Music2 size={13} /> TikTok</label>
                <input className="input" placeholder="@sualoja" value={tiktok} onChange={(e) => setTiktok(e.target.value)} />
              </div>
              <div>
                <label className="label flex items-center gap-1"><Mail size={13} /> E-mail da loja <span className="text-muted font-normal">(opcional)</span></label>
                <input
                  className="input"
                  type="email"
                  placeholder="contato@sualoja.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6">
        {step < totalSteps - 1 ? (
          <button onClick={next} className="btn-primary w-full">
            Continuar <ChevronRight size={20} />
          </button>
        ) : (
          <button
            onClick={() => setGerando(true)}
            disabled={!ready}
            className="btn-primary w-full disabled:opacity-60"
          >
            Concluir e criar minha loja <Sparkles size={18} />
          </button>
        )}
        {step > 0 && (
          <button onClick={back} className="w-full text-center text-sm text-muted mt-3">
            Voltar
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Tela de carregamento — toca após "Concluir". Minimalista e mobile-first:
// um ícone de carregamento girando + uma barra de progresso, com o texto do
// passo atual trocando enquanto o store grava de verdade.
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

  // confete da comemoração final (gerado uma vez, renderizado só quando pronto).
  // Delay NEGATIVO faz cada peça já começar no meio da queda → a tela inteira
  // (de cima a baixo) fica coberta de confete no instante em que conclui.
  const [confete] = useState(() =>
    Array.from({ length: 90 }).map((_, i) => {
      const dur = 2.6 + Math.random() * 2.6;
      return {
        e: ["🎉", "✨", "🎊", "⭐", "💫", "🥳", "🎈", "🌟"][i % 8],
        left: Math.round(Math.random() * 100),
        size: 12 + Math.round(Math.random() * 18),
        dur,
        delay: -Math.random() * dur,
      };
    })
  );

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
      await sleep(2200); // deixa o confete aparecer antes de ir pro painel
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
  const passoAtual = passos[Math.min(atual, total - 1)];

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-6 overflow-hidden">
      {/* confete na comemoração final */}
      {pronto && (
        <div className="pointer-events-none absolute inset-0">
          {confete.map((c, i) => (
            <span
              key={i}
              className="absolute top-0 ob-anim-fall select-none"
              style={{
                left: `${c.left}%`,
                fontSize: c.size,
                animationDuration: `${c.dur}s`,
                animationDelay: `${c.delay}s`,
                animationIterationCount: "infinite",
              }}
            >
              {c.e}
            </span>
          ))}
        </div>
      )}

      <div className="relative w-full max-w-xs flex flex-col items-center text-center">
        {/* ícone de carregamento */}
        <div className="relative grid place-items-center h-16 w-16 mb-6">
          {pronto ? (
            <Check size={40} className="text-brand-500 ob-anim-pop" strokeWidth={3} />
          ) : (
            <Loader2 size={44} className="text-brand-500 animate-spin" />
          )}
        </div>

        {/* texto do passo atual */}
        <div key={pronto ? "done" : atual} className="ob-anim-rise min-h-[3.5rem]">
          <p className="text-lg font-bold leading-tight">
            {pronto ? "Tudo pronto! 🎉" : passoAtual.title}
          </p>
          <p className="text-sm text-muted mt-1">
            {pronto ? `${loja} está no ar.` : passoAtual.sub}
          </p>
        </div>

        {erro && (
          <div className="w-full mt-4 space-y-3" role="alert">
            <p className="text-sm text-red-500">{erro}</p>
            <button onClick={tentarDeNovo} disabled={tentando} className="btn-primary w-full disabled:opacity-60">
              {tentando ? <Loader2 className="animate-spin" size={18} /> : "Tentar de novo"}
            </button>
          </div>
        )}

        {/* barra de carregamento */}
        <div className="w-full mt-6">
          <div className="h-2 w-full rounded-full surface-alt overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 text-xs font-semibold text-muted">{pct}%</div>
        </div>
      </div>
    </div>
  );
}
