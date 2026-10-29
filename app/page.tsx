import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Calculator,
  Candy,
  Check,
  Gem,
  Heart,
  Settings2,
  LineChart,
  MessageCircle,
  NotebookPen,
  PlayCircle,
  Sparkles,
  Store,
  Timer,
  TrendingUp,
  Users,
  Wallet,
  ShoppingBag,
  Smartphone,
  ShieldCheck,
  X,
} from "lucide-react";
import Faq from "@/components/landing/Faq";
import Pricing from "@/components/landing/Pricing";
import StickyCta from "@/components/landing/StickyCta";
import LiveDashboard from "@/components/landing/LiveDashboard";
import Reveal from "@/components/landing/Reveal";
import Rodape from "@/components/landing/Rodape";
import { whatsappEmpresa } from "@/lib/empresa";
import { ORDEM_PLANOS, PLANOS, brlPreco } from "@/lib/plans";

export const metadata = {
  title: "AutoManager — Saiba quanto sua loja vende e lucra, todo dia",
  description:
    "O sistema de gestão para micronegócios do Brasil: estoque, vendas, comissões, revendedoras e relatórios de lucro em um app só. Troque o caderno, a planilha e o WhatsApp por um painel. Teste grátis, sem cartão.",
};

const COMECAR = "/login";
const MENOR_PRECO = brlPreco(Math.min(...ORDEM_PLANOS.map((id) => PLANOS[id].precoCentavos)));
const WA_DUVIDA = whatsappEmpresa("Tenho uma dúvida sobre o AutoManager");
const WA_CTA = whatsappEmpresa("Quero organizar minha loja com o AutoManager");

// fatos verificáveis do produto (sem números inventados)
const FATOS = [
  { icon: Timer, t: "Venda em 1 toque", d: "Estoque baixa sozinho" },
  { icon: Wallet, t: "Comissão calculada sozinha", d: "Por venda e por revendedora" },
  { icon: Smartphone, t: "Funciona no celular", d: "Instala na tela inicial" },
  { icon: ShieldCheck, t: "Cada loja isolada", d: "Dados separados e criptografados" },
];

// landing sempre em dark premium (independente do tema salvo do visitante)
const TEMA_DARK = {
  "--bg": "#09090f",
  "--surface": "#111119",
  "--surface-alt": "#1a1a24",
  "--text": "#f5f5f7",
  "--text-muted": "#9aa0ac",
  "--border": "#24242e",
  "--brand-50": "253 242 248",
  "--brand-100": "252 231 243",
  "--brand-200": "251 207 232",
  "--brand-300": "249 168 212",
  "--brand-400": "244 114 182",
  "--brand-500": "236 72 153",
  "--brand-600": "219 39 119",
  "--brand-700": "190 24 93",
  "--brand-800": "157 23 77",
  "--brand-900": "131 24 67",
  colorScheme: "dark",
} as React.CSSProperties;

const SEGMENTOS = ["Semijoias", "Roupas", "Cosméticos", "Doces", "Bijuterias", "Papelaria", "Artesanato", "Pet shop"];

const DORES = [
  { p: "Produto acabou e você só viu quando o cliente pediu.", s: "Alerta de estoque baixo antes de faltar — você repõe a tempo." },
  { p: "Cliente pagou e você esqueceu de registrar.", s: "Recebimentos e fiado anotados no automático. Nada se perde." },
  { p: "Comissão calculada de cabeça — e quase sempre errada.", s: "Comissão exata por venda, sem calculadora e sem briga." },
  { p: "Dinheiro entrando e você sem saber se deu lucro.", s: "Lucro real por produto, por canal e por período." },
  { p: "Tudo espalhado entre caderno, WhatsApp e planilha.", s: "Um painel só, no seu celular, sempre atualizado." },
  { p: "Revendedora vendendo e você sem saber quanto deve.", s: "Cada uma com login próprio; você acompanha em tempo real." },
];

const BENEFICIOS = [
  { icon: Boxes, t: "Nunca mais perca venda por falta de estoque", d: "O estoque baixa sozinho a cada venda e te avisa quando algo está acabando." },
  { icon: Timer, t: "Registre a venda em segundos", d: "No balcão ou pelo WhatsApp, com fiado e parcelas — em 1 toque." },
  { icon: Wallet, t: "Comissão certa, no automático", d: "Defina o percentual uma vez. O sistema calcula e mostra quanto pagar." },
  { icon: LineChart, t: "Saiba o lucro real, sem achismo", d: "Relatório por produto, canal e período. Descubra o que dá retorno." },
  { icon: Store, t: "Uma loja online pronta", d: "Vitrine com link próprio pra mandar no Insta e no Zap, com chat." },
  { icon: Users, t: "Sua equipe vendendo, você no controle", d: "Revendedoras com acesso próprio, vendendo pelo celular delas." },
];

const FLUXO = [
  { n: 1, icon: ShoppingBag, t: "Venda registrada", d: "No balcão ou no WhatsApp, em 1 toque." },
  { n: 2, icon: Boxes, t: "Estoque atualizado", d: "Baixa sozinho, sem você anotar nada." },
  { n: 3, icon: Wallet, t: "Comissão calculada", d: "Na hora, certinha, por revendedora." },
  { n: 4, icon: TrendingUp, t: "Lucro registrado", d: "Custo x venda calculado automaticamente." },
  { n: 5, icon: LineChart, t: "Relatório atualizado", d: "Seus números prontos, em tempo real." },
];

const FAQ_LANDING = [
  { q: "Preciso colocar cartão para testar?", a: "Não. O teste grátis começa sem cartão. Você só decide pagar se gostar — e aí escolhe o plano do tamanho da sua loja." },
  { q: "Funciona no celular?", a: "Funciona e foi feito pensando primeiro no celular. Dá pra adicionar à tela inicial e usar como um aplicativo, inclusive pra registrar venda no balcão." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Sem fidelidade, sem multa e sem ligação pra te 'segurar'. Cancelou, a cobrança para e seus dados continuam disponíveis pra exportar. E se desistir em até 7 dias depois da primeira cobrança, devolvemos 100% do valor." },
  { q: "Preciso instalar algum programa?", a: "Não. Abre direto no navegador do celular ou do computador. Nada pra baixar, nada pra atualizar." },
  { q: "Serve para o meu tipo de negócio?", a: "Sim. Doces, semijoias, bijuterias, cosméticos, roupas, papelaria, artesanato, pet shop e mais. Você cria suas próprias categorias e deixa o sistema com a cara do seu negócio." },
  { q: "Preciso entender de tecnologia?", a: "Se você usa WhatsApp, você usa o AutoManager. O cadastro é guiado por poucas perguntas e dá pra registrar a primeira venda em poucos minutos." },
  { q: "Serve mesmo para quem tem revendedoras?", a: "Esse é o nosso diferencial. Cada revendedora tem acesso próprio, registra a venda pelo celular e a comissão é calculada automaticamente. Você vê quem vende, quanto deve e o ranking." },
  { q: "Meus dados ficam seguros?", a: "Ficam. Cada loja é isolada das outras no banco de dados, tudo trafega criptografado e o backup é automático. Ninguém de outra loja enxerga seus números." },
];

export default function Landing() {
  return (
    <main style={TEMA_DARK} className="min-h-screen bg-[var(--bg)] text-strong antialiased">
      {/* ======================= NAV ======================= */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[var(--bg)]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <span className="flex items-center gap-2 font-extrabold text-brand-500">
            <Gem size={22} className="text-brand-500" /> AutoManager
          </span>
          <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a href="#como" className="transition hover:text-strong">Como funciona</a>
            <a href="#beneficios" className="transition hover:text-strong">Recursos</a>
            <a href="#planos" className="transition hover:text-strong">Planos</a>
            <a href="#faq" className="transition hover:text-strong">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login?modo=entrar" className="px-2 py-3 text-sm text-muted transition hover:text-strong">
              Entrar
            </Link>
            <Link href={COMECAR} className="btn-primary text-sm">
              Teste grátis <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* ======================= HERO ======================= */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 lp-grid-bg opacity-[0.5]" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[28rem] w-[44rem] -translate-x-1/2 rounded-full bg-brand-600/20 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -right-24 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-brand-300 backdrop-blur">
              <Sparkles size={14} /> Feito para micronegócios do Brasil
            </span>
            <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-strong sm:text-6xl">
              Saiba quanto sua loja{" "}
              <span className="bg-gradient-to-r from-brand-400 via-brand-500 to-brand-700 bg-clip-text text-transparent">
                vende e lucra
              </span>{" "}
              — todo dia.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              O AutoManager troca o caderno, a planilha e o WhatsApp por um painel só: estoque,
              vendas, comissões e relatórios no automático. Pare de adivinhar e comece a lucrar.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={COMECAR} className="btn-primary px-6 py-4 text-base shadow-lg shadow-brand-600/30">
                Criar minha loja grátis <ArrowRight size={18} />
              </Link>
              <a href="#como" className="btn-ghost px-6 py-4 text-base">
                <PlayCircle size={18} /> Ver demonstração
              </a>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {["Sem cartão de crédito", "Pronto em 2 minutos", "Cancela quando quiser"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check size={15} className="text-brand-500" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* visual vivo */}
          <Reveal delay={120}>
            <LiveDashboard />
          </Reveal>
        </div>
      </section>

      {/* ======================= PROVA SOCIAL ======================= */}
      <section className="border-y border-white/5 bg-[var(--surface)]/40">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <p className="text-center text-xs font-medium uppercase tracking-wider text-muted">
            Para lojas que largaram o caderno e a planilha
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-muted/70">
            {SEGMENTOS.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <div className="mt-9 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {FATOS.map(({ icon: Icon, t, d }, i) => (
              <Reveal key={t} delay={i * 80}>
                <div className="flex flex-col items-center text-center">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-400">
                    <Icon size={20} />
                  </span>
                  <p className="mt-3 font-bold text-strong">{t}</p>
                  <p className="mt-0.5 text-sm text-muted">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= DOR → SOLUÇÃO ======================= */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">O problema</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-strong sm:text-4xl">
              Você trabalha muito. Mas não enxerga seus números.
            </h2>
            <p className="mt-3 text-muted">
              Cada item abaixo é dinheiro saindo do seu bolso sem você perceber. Veja como o
              AutoManager resolve cada um.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DORES.map((d, i) => (
            <Reveal key={d.p} delay={(i % 3) * 90}>
              <div className="group h-full rounded-2xl border border-white/10 bg-[var(--surface)] p-5 transition hover:-translate-y-1 hover:border-brand-500/30 hover:shadow-pop">
                <div className="flex items-start gap-2.5 text-sm text-muted">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-400">
                    <X size={12} />
                  </span>
                  <span className="line-through decoration-red-500/40">{d.p}</span>
                </div>
                <div className="mt-4 flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-400">
                    <Check size={12} />
                  </span>
                  <span className="text-sm font-medium text-strong">{d.s}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ======================= BENEFÍCIOS ======================= */}
      <section id="beneficios" className="border-y border-white/5 bg-[var(--surface)]/40 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">O que você ganha</span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-strong sm:text-4xl">
                Não é mais um sistema de estoque. É controle do seu lucro.
              </h2>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFICIOS.map(({ icon: Icon, t, d }, i) => (
              <Reveal key={t} delay={(i % 3) * 90}>
                <div className="h-full rounded-2xl border border-white/10 bg-[var(--bg)] p-6 transition hover:-translate-y-1 hover:border-brand-500/30 hover:shadow-pop">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-strong">{t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= COMO FUNCIONA (FLUXO) ======================= */}
      <section id="como" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">Como funciona</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-strong sm:text-4xl">
              Você registra uma venda. O sistema faz o resto.
            </h2>
            <p className="mt-3 text-muted">Um toque dispara tudo — em tempo real, sem retrabalho.</p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div className="relative">
            {/* linha conectora */}
            <div className="absolute left-[1.4rem] top-4 bottom-4 w-px bg-gradient-to-b from-brand-500/60 to-transparent" />
            <div className="space-y-5">
              {FLUXO.map(({ n, icon: Icon, t, d }, i) => (
                <Reveal key={t} delay={i * 90}>
                  <div className="relative flex items-start gap-4">
                    <span className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-[var(--surface)] text-brand-400 shadow-lg">
                      <Icon size={18} />
                      <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                        {n}
                      </span>
                    </span>
                    <div className="pt-1">
                      <h3 className="font-bold text-strong">{t}</h3>
                      <p className="text-sm text-muted">{d}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={120}>
            <LiveDashboard />
          </Reveal>
        </div>
      </section>

      {/* ======================= DIFERENCIAL ======================= */}
      <section className="border-y border-white/5 bg-[var(--surface)]/40 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-strong sm:text-4xl">
                Outros sistemas controlam estoque. O AutoManager{" "}
                <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
                  ajuda você a vender mais
                </span>
                .
              </h2>
              <p className="mt-4 text-muted">
                Feito para o jeito que a sua loja realmente vende: com revendedoras, WhatsApp e
                cliente esperando resposta.
              </p>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Users, t: "Revendedoras com login próprio", d: "Elas vendem pelo celular, você acompanha em tempo real. Ninguém vê o número da outra." },
              { icon: Wallet, t: "Comissão automática", d: "Define o percentual uma vez. O sistema calcula a cada venda e mostra quanto pagar." },
              { icon: Store, t: "Loja online pronta", d: "Uma vitrine pública com seu link, sem contratar quem faça site." },
              { icon: MessageCircle, t: "Chat integrado", d: "O cliente fala com a loja direto da vitrine. Acabou perder pedido no meio do Zap." },
              { icon: Settings2, t: "Do seu jeito", d: "Suas categorias, comissões, marca e cores. O sistema fica com a cara do seu negócio." },
              { icon: TrendingUp, t: "Foco em lucro", d: "O painel mostra o que dá retorno e o que só está parado custando dinheiro." },
            ].map(({ icon: Icon, t, d }, i) => (
              <Reveal key={t} delay={(i % 3) * 90}>
                <div className="h-full rounded-2xl border border-white/10 bg-[var(--bg)] p-6 transition hover:-translate-y-1 hover:border-brand-500/30">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 font-bold text-strong">{t}</h3>
                  <p className="mt-1.5 text-sm text-muted">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= CASOS DE USO ======================= */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <Reveal>
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-strong sm:text-4xl">Feito para o seu micronegócio</h2>
            <p className="mt-3 text-muted">Seja o que for que você vende, o AutoManager se molda a você.</p>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {[
            { icon: Candy, perfil: "Doces, salgados e comida caseira", dor: "Anota encomenda no Zap e calcula o preço de cabeça.", uso: "Cadastra cada item com custo e preço, controla encomendas e vê quanto sobra em cada venda." },
            { icon: Gem, perfil: "Semijoias e bijuterias", dor: "Centenas de peças parecidas e revendedoras espalhadas.", uso: "Controla cada modelo com foto e variação e calcula a comissão de cada revendedora sem erro." },
            { icon: Heart, perfil: "Cosméticos e perfumaria", dor: "Produto com validade e reposição constante.", uso: "Alerta de estoque mínimo pra nunca ficar sem o que mais vende e relatório do que dá margem." },
            { icon: Store, perfil: "Roupas, acessórios e revendedoras", dor: "Grade de tamanho/cor e gente vendendo por você sem controle.", uso: "Cadastro com grade (P/M/G e cores), vitrine online e cada revendedora registrando a venda pelo celular." },
          ].map(({ icon: Icon, perfil, dor, uso }, i) => (
            <Reveal key={perfil} delay={(i % 2) * 100}>
              <div className="flex h-full gap-4 rounded-2xl border border-white/10 bg-[var(--surface)] p-5 transition hover:-translate-y-1 hover:border-brand-500/30">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-400">
                  <Icon size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-strong">{perfil}</h3>
                  <p className="mt-1 text-sm text-muted"><strong className="text-muted/90">Antes:</strong> {dor}</p>
                  <p className="mt-1 text-sm text-muted"><strong className="text-brand-400">Com o AutoManager:</strong> {uso}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted">
          Papelaria, pet shop, artesanato, loja de festa, mercadinho… <strong className="text-strong">qualquer
          micronegócio</strong>. Você cria as categorias e deixa o sistema com a cara do seu negócio.
        </p>
      </section>

      {/* ======================= PLANOS ======================= */}
      <section id="planos" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <Reveal>
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">Planos</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-strong sm:text-4xl">
              Preço de micronegócio, não de sistema caro
            </h2>
            <p className="mt-3 text-muted">
              1º mês grátis. Comece sem cartão e escolha um plano só quando já estiver vendo o resultado.
            </p>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <Pricing />
        </Reveal>
      </section>

      {/* ======================= FAQ ======================= */}
      <section id="faq" className="border-t border-white/5 bg-[var(--surface)]/40 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-strong sm:text-4xl">Ainda com dúvida? Respondemos.</h2>
              <p className="mt-3 text-muted">As perguntas que toda dona de loja faz antes de começar.</p>
            </div>
          </Reveal>
          <Faq itens={FAQ_LANDING} />
          <div className="mt-8 text-center text-sm text-muted">
            Ficou outra dúvida?{" "}
            {WA_DUVIDA ? (
              <a
                href={WA_DUVIDA}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-400 transition hover:text-brand-300 hover:underline"
              >
                Fale com a gente no WhatsApp
              </a>
            ) : (
              <Link href={COMECAR} className="font-semibold text-brand-400 transition hover:text-brand-300 hover:underline">
                Teste grátis e veja na prática
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ======================= CTA FINAL ======================= */}
      <section className="px-5 pb-28 pt-16 sm:pb-24">
        <Reveal>
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-brand-500/30 bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-center text-white shadow-2xl shadow-brand-900/40 sm:p-14">
            <div className="pointer-events-none absolute -top-20 left-1/2 h-60 w-96 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">
              O caderno é grátis. Mas está te custando caro.
            </h2>
            <p className="relative mx-auto mt-4 max-w-2xl text-brand-50/90">
              Cada comissão errada, cada produto parado e cada venda perdida custam, todo mês, muito
              mais que uma mensalidade. A diferença é que esse prejuízo você só vê quando começa a medir.
            </p>

            <div className="relative mx-auto mt-8 grid max-w-md gap-3 text-left">
              {[
                { icon: NotebookPen, t: "Continuar no caderno", custo: "Prejuízo invisível todo mês", ruim: true },
                { icon: Calculator, t: "Comissão na calculadora", custo: "Erro que sai do seu bolso", ruim: true },
                { icon: BadgeCheck, t: "Começar no AutoManager", custo: `Grátis pra testar · a partir de ${MENOR_PRECO}/mês`, ruim: false },
              ].map(({ icon: Icon, t, custo, ruim }) => (
                <div
                  key={t}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                    ruim ? "bg-white/10" : "bg-white text-brand-700"
                  }`}
                >
                  <Icon size={20} className={ruim ? "text-brand-100" : "text-brand-600"} />
                  <div>
                    <p className={`font-semibold ${ruim ? "text-white" : "text-brand-800"}`}>{t}</p>
                    <p className={`text-sm ${ruim ? "text-brand-100" : "text-brand-600"}`}>{custo}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href={COMECAR} className="btn inline-flex bg-white px-7 py-4 text-base font-bold text-brand-700 transition hover:bg-brand-50 active:scale-[.98]">
                Criar minha loja grátis <ArrowRight size={18} />
              </Link>
              {WA_CTA && (
                <a
                  href={WA_CTA}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn inline-flex border border-white/40 px-7 py-4 text-base font-semibold text-white transition hover:bg-white/10 active:scale-[.98]"
                >
                  <MessageCircle size={18} /> Tirar dúvida no WhatsApp
                </a>
              )}
            </div>
            <p className="relative mt-4 text-sm text-brand-100">Sem cartão · pronto em 2 minutos · cancela quando quiser</p>
          </div>
        </Reveal>
      </section>

      {/* ======================= FOOTER ======================= */}
      <Rodape ancoras />

      <StickyCta />
    </main>
  );
}
