import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  Gem,
  MessageCircle,
  Minus,
  Smartphone,
  Store,
  Users,
  Wifi,
} from "lucide-react";
import Faq from "@/components/landing/Faq";
import Pricing from "@/components/landing/Pricing";
import StickyCta from "@/components/landing/StickyCta";
import Rodape from "@/components/landing/Rodape";
import {
  MostraComissoes,
  MostraFinanceiro,
  MostraPainelCelular,
  MostraVenda,
  MostraVitrine,
} from "@/components/landing/Mostras";
import { whatsappEmpresa } from "@/lib/empresa";
import { ORDEM_PLANOS, PLANOS, brlPreco } from "@/lib/plans";

const MENOR_PRECO = brlPreco(Math.min(...ORDEM_PLANOS.map((id) => PLANOS[id].precoCentavos)));
const TITULO = "AutoManager: saiba quanto sobra das vendas da sua loja";
const DESCRICAO = `Estoque, vendas, comissão de revendedoras, contas e lucro no seu celular. Para docerias, bijuterias, cosméticos, roupas, papelarias e artesanato. 1º mês grátis, sem cartão. Depois, a partir de ${MENOR_PRECO}/mês.`;

export const metadata: Metadata = {
  title: { absolute: TITULO },
  description: DESCRICAO,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "AutoManager",
    title: TITULO,
    description: DESCRICAO,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: TITULO, description: DESCRICAO },
};

const COMECAR = "/login";
const WA_DUVIDA = whatsappEmpresa("Tenho uma dúvida sobre o AutoManager");

// a landing é sempre escura, mesmo que o visitante tenha salvo o tema claro no app
const TEMA_DARK = {
  "--bg": "#0c0a10",
  "--surface": "#15121b",
  "--surface-alt": "#1f1b27",
  "--text": "#f6f4f8",
  "--text-muted": "#a8a2b3",
  "--border": "#2a2533",
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
  "--accent": "var(--brand-400)",
  "--ok": "52 211 153",
  "--warn": "251 191 36",
  "--bad": "248 113 113",
  "--info": "96 165 250",
  "--hover": "rgb(255 255 255 / 0.06)",
  "--shadow-soft": "0 1px 2px rgb(0 0 0 / 0.2)",
  "--shadow-md": "0 4px 12px rgb(0 0 0 / 0.25)",
  "--shadow-pop": "0 16px 40px rgb(0 0 0 / 0.4)",
  "--r-card": "1rem",
  "--r-btn": "0.625rem",
  "--r-input": "0.625rem",
  colorScheme: "dark",
} as React.CSSProperties;

const SEGMENTOS = ["docerias", "bijuterias", "cosméticos", "roupas", "papelarias", "artesanato"];

const PROBLEMAS = [
  {
    hoje: "O dinheiro entra, as contas saem e no fim do mês você não sabe se sobrou.",
    com: "Você vê o lucro do período, já descontando o custo dos produtos e as comissões.",
  },
  {
    hoje: "O cliente pede pelo WhatsApp e só aí você descobre que o produto acabou.",
    com: "Cada venda baixa o estoque, e o painel mostra o que precisa repor.",
  },
  {
    hoje: "A comissão da revendedora sai na calculadora, e sempre dá dúvida.",
    com: "Você define o percentual uma vez. A comissão de cada venda sai calculada.",
  },
  {
    hoje: "Vendeu fiado, anotou em algum lugar e esqueceu de cobrar.",
    com: "A venda fica marcada como a receber, na lista do que falta entrar.",
  },
  {
    hoje: "Boleto do fornecedor, aluguel e luz vencem sem você se programar.",
    com: "Contas a pagar organizadas, com a previsão de quanto vai sobrar no caixa.",
  },
  {
    hoje: "Mandar foto e preço de cada produto, um por um, toma o seu dia.",
    com: "Sua vitrine tem link próprio: é só mandar no WhatsApp e no Instagram.",
  },
];

const PASSOS = [
  {
    t: "Conte como é a sua loja",
    d: "Você responde poucas perguntas e a loja fica pronta em cerca de 2 minutos.",
  },
  {
    t: "Cadastre o que você vende",
    d: "Produto por produto, com foto, custo e preço, ou de uma vez por planilha.",
  },
  {
    t: "Registre cada venda",
    d: "No balcão, pelo WhatsApp ou pelo Instagram. O resto o sistema faz.",
  },
];

const RECURSOS = [
  {
    id: "vendas",
    icone: Boxes,
    eyebrow: "Estoque e vendas",
    titulo: "Vendeu, anotou, o estoque já baixou",
    texto: "Escolha os produtos, diga como o cliente pagou e pronto. Sem caderno e sem conta de cabeça.",
    itens: [
      "Foto, custo, preço e grade de tamanho e cor",
      "Dinheiro, Pix, débito, crédito parcelado, boleto ou fiado",
      "Aviso do que precisa repor, com sugestão de compra",
    ],
    Mostra: MostraVenda,
  },
  {
    id: "revendedoras",
    icone: Users,
    eyebrow: "Revendedoras e comissões",
    titulo: "Cada revendedora vende pelo celular dela",
    texto:
      "Ela entra com o próprio login, vê o catálogo e registra a venda. Você acompanha tudo, e ela não enxerga seu custo nem seu lucro.",
    itens: [
      "Comissão e meta definidas por revendedora",
      "Quanto pagar a cada uma, sem calculadora",
      "Ranking de quem mais vende nos planos Equipe e Expansão",
    ],
    Mostra: MostraComissoes,
  },
  {
    id: "vitrine",
    icone: Store,
    eyebrow: "Vitrine e chat",
    titulo: "Uma lojinha online com a cara do seu negócio",
    texto:
      "Sua vitrine ganha link próprio, com sua logo, suas cores e seus produtos. O cliente olha o catálogo e fala com você ali mesmo, pelo chat.",
    itens: [
      "Filtro por categoria e aviso de produto esgotado",
      "Conversas da vitrine reunidas em um lugar só",
      "Seus contatos e redes sociais na mesma página",
    ],
    Mostra: MostraVitrine,
  },
  {
    id: "financeiro",
    icone: BarChart3,
    eyebrow: "Financeiro e relatórios",
    titulo: "O que entrou, o que saiu e o que sobrou",
    texto:
      "Lance as contas da loja e veja a previsão do caixa. Os relatórios mostram o que dá lucro e o que só ocupa espaço na prateleira.",
    itens: [
      "A receber menos a pagar, com o saldo previsto",
      "Lucro do período e margem de cada produto",
      "Exportação das vendas para abrir no Excel",
    ],
    Mostra: MostraFinanceiro,
  },
];

const PARA_QUEM = [
  { t: "Docerias e comida caseira", d: "Custo e preço de cada item, para saber quanto sobra em cada venda." },
  { t: "Bijuterias e semijoias", d: "Cada modelo com foto e variação, e a comissão de cada revendedora." },
  { t: "Cosméticos e perfumaria", d: "Estoque mínimo dos itens de giro e relatório do que dá mais margem." },
  { t: "Roupas e acessórios", d: "Grade de tamanho e cor, com estoque separado para cada opção." },
  { t: "Papelarias", d: "Categorias criadas por você, para achar rápido no meio de tanto item." },
  { t: "Artesanato", d: "Vitrine com link próprio para mostrar suas peças sem contratar um site." },
];

const CELULAR = [
  {
    icone: Smartphone,
    t: "No Android",
    d: "Abra no Chrome, toque no menu e escolha instalar o app ou adicionar à tela inicial.",
  },
  {
    icone: Smartphone,
    t: "No iPhone",
    d: "Abra no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.",
  },
  {
    icone: Wifi,
    t: "Precisa de internet",
    d: "O sistema é online: registrar e consultar exige conexão, que pode ser a do celular.",
  },
];

function Titulo({
  eyebrow,
  titulo,
  texto,
  id,
}: {
  eyebrow: string;
  titulo: React.ReactNode;
  texto?: React.ReactNode;
  id: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-accent">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-[1.875rem] font-bold leading-[1.15] tracking-tight sm:text-[2.5rem]">
        {titulo}
      </h2>
      {texto && <p className="mt-4 text-lg leading-relaxed text-muted">{texto}</p>}
    </div>
  );
}

export default function Landing() {
  return (
    <div style={TEMA_DARK} className="min-h-screen overflow-x-clip bg-[var(--bg)] text-strong antialiased">
      <header className="sticky top-0 z-30 border-b border-default bg-[var(--bg)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="AutoManager, página inicial" className="flex items-center gap-2 font-bold text-accent">
            <Gem size={20} aria-hidden /> AutoManager
          </Link>
          <nav aria-label="Principal" className="hidden items-center gap-7 whitespace-nowrap text-sm text-muted lg:flex">
            <a href="#problemas" className="transition hover:text-strong">Problemas</a>
            <a href="#como" className="transition hover:text-strong">Como funciona</a>
            <a href="#recursos" className="transition hover:text-strong">O que faz</a>
            <a href="#planos" className="transition hover:text-strong">Planos</a>
            <a href="#faq" className="transition hover:text-strong">Dúvidas</a>
          </nav>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              href="/login?modo=entrar"
              className="inline-flex min-h-[40px] items-center px-2 text-sm font-medium text-muted transition hover:text-strong"
            >
              Entrar
            </Link>
            <Link href={COMECAR} className="btn-primary btn-sm">
              Teste grátis
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---- abertura ---- */}
        <section aria-labelledby="titulo-principal" className="border-b border-default">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-center lg:gap-16 lg:pb-20 lg:pt-20">
            <div>
              <p className="text-sm font-semibold text-accent">
                Para quem vende por conta própria, na loja ou no WhatsApp
              </p>
              <h1
                id="titulo-principal"
                className="mt-4 text-[2.625rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[3.75rem]"
              >
                Você vendeu hoje. <span className="block text-accent">Sobrou quanto?</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
                O AutoManager tira sua loja do caderno e da calculadora. Você registra a venda no
                celular e ele baixa o estoque, calcula a comissão e mostra o seu lucro.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={COMECAR} className="btn-primary min-h-[52px] px-6 text-base">
                  Criar minha loja grátis <ArrowRight size={18} aria-hidden />
                </Link>
                <a href="#como" className="btn-ghost min-h-[52px] px-6 text-base">
                  Ver como funciona
                </a>
              </div>
              <p className="mt-4 text-sm text-muted">1º mês grátis, sem cartão. Cancela quando quiser.</p>
              <p className="mt-8 border-t border-default pt-5 text-sm leading-relaxed text-muted">
                Feito para{" "}
                {SEGMENTOS.map((s, i) => (
                  <span key={s}>
                    <span className="font-medium text-strong">{s}</span>
                    {i < SEGMENTOS.length - 2 ? ", " : i === SEGMENTOS.length - 2 ? " e " : ""}
                  </span>
                ))}{" "}
                e outros pequenos negócios.
              </p>
            </div>
            <MostraPainelCelular />
          </div>
        </section>

        {/* ---- problemas ---- */}
        <section id="problemas" aria-labelledby="t-problemas" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Titulo
              id="t-problemas"
              eyebrow="Isso acontece na sua loja?"
              titulo="Você trabalha muito, mas não enxerga seus números"
              texto="Quase todo pequeno negócio perde dinheiro nos mesmos lugares. Veja o que muda."
            />
            <div className="mt-10 border-y border-default">
              <div className="hidden grid-cols-2 gap-10 py-3 text-sm font-semibold md:grid">
                <span className="text-muted">Hoje</span>
                <span className="text-accent">Com o AutoManager</span>
              </div>
              <ul className="divide-y divide-[color:var(--border)] md:border-t md:border-default">
                {PROBLEMAS.map((p) => (
                  <li key={p.hoje} className="grid gap-3 py-5 md:grid-cols-2 md:gap-10">
                    <p className="flex gap-3 text-muted">
                      <Minus size={18} className="mt-1 shrink-0" aria-hidden />
                      <span>
                        <span className="sr-only">Hoje: </span>
                        {p.hoje}
                      </span>
                    </p>
                    <p className="flex gap-3 font-medium">
                      <Check size={18} className="mt-1 shrink-0 text-accent" aria-hidden />
                      <span>
                        <span className="sr-only">Com o AutoManager: </span>
                        {p.com}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---- como funciona ---- */}
        <section
          id="como"
          aria-labelledby="t-como"
          className="scroll-mt-16 border-y border-default bg-[var(--surface)] py-16 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Titulo id="t-como" eyebrow="Como funciona" titulo="Se você usa WhatsApp, você usa o AutoManager" />
            <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
              {PASSOS.map((p, i) => (
                <li key={p.t} className="border-t-2 border-brand-500 pt-4">
                  <span className="text-sm font-semibold text-accent tnum">Passo {i + 1}</span>
                  <h3 className="mt-1 text-xl font-bold">{p.t}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{p.d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10">
              <Link href={COMECAR} className="btn-primary min-h-[48px] px-5">
                Começar agora <ArrowRight size={17} aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* ---- o que faz ---- */}
        <section id="recursos" aria-labelledby="t-recursos" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Titulo
              id="t-recursos"
              eyebrow="O que o AutoManager faz"
              titulo="Tudo o que hoje está espalhado, em um lugar só"
            />
            <div className="mt-12 space-y-16 sm:space-y-24">
              {RECURSOS.map(({ id, icone: Icone, eyebrow, titulo, texto, itens, Mostra }, i) => (
                <article key={id} className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
                  <div className={i % 2 ? "lg:order-2" : ""}>
                    <p className="flex items-center gap-2 text-sm font-semibold text-accent">
                      <Icone size={17} aria-hidden /> {eyebrow}
                    </p>
                    <h3 className="mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-[1.75rem]">{titulo}</h3>
                    <p className="mt-3 leading-relaxed text-muted">{texto}</p>
                    <ul className="mt-5 space-y-2.5">
                      {itens.map((t) => (
                        <li key={t} className="flex gap-2.5 text-[0.9375rem]">
                          <Check size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden /> {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={i % 2 ? "lg:order-1" : ""}>
                    <Mostra />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---- para quem ---- */}
        <section aria-labelledby="t-quem" className="border-t border-default py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Titulo
              id="t-quem"
              eyebrow="Para quem é"
              titulo="Seja o que for que você vende"
              texto="Você cria suas categorias, escolhe as cores e define as comissões. O sistema se ajusta ao seu negócio."
            />
            <ul className="mt-10 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
              {PARA_QUEM.map((c) => (
                <li key={c.t} className="border-t border-default py-5">
                  <h3 className="font-bold">{c.t}</h3>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">{c.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- celular ---- */}
        <section aria-labelledby="t-celular" className="border-y border-default bg-[var(--surface)] py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
            <Titulo
              id="t-celular"
              eyebrow="No seu celular"
              titulo="Abre como um aplicativo, sem baixar nada na loja de apps"
              texto="O AutoManager foi feito primeiro para o celular e também funciona no computador. Basta entrar pelo navegador."
            />
            <ul className="divide-y divide-[color:var(--border)]">
              {CELULAR.map(({ icone: Icone, t, d }) => (
                <li key={t} className="flex gap-3 py-4 first:pt-0">
                  <Icone size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  <div>
                    <h3 className="font-bold">{t}</h3>
                    <p className="mt-0.5 leading-relaxed text-muted">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- planos ---- */}
        <section id="planos" aria-labelledby="t-planos" className="scroll-mt-16 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Titulo
              id="t-planos"
              eyebrow="Planos"
              titulo="Preço de pequeno negócio"
              texto="O 1º mês é grátis e não pede cartão. Depois, você escolhe o plano do tamanho da sua loja."
            />
            <Pricing />
          </div>
        </section>

        {/* ---- dúvidas ---- */}
        <section id="faq" aria-labelledby="t-faq" className="scroll-mt-16 border-t border-default py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 id="t-faq" className="text-[1.875rem] font-bold leading-[1.15] tracking-tight sm:text-[2.5rem]">
                Perguntas que toda dona de loja faz
              </h2>
              {WA_DUVIDA && (
                <p className="mt-4 text-muted">
                  Ficou outra dúvida?{" "}
                  <a
                    href={WA_DUVIDA}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-accent hover:underline"
                  >
                    Fale com a gente no WhatsApp
                  </a>
                </p>
              )}
            </div>
            <Faq />
          </div>
        </section>

        {/* ---- fechamento ---- */}
        <section aria-labelledby="t-fim" className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-6xl rounded-2xl bg-brand-700 px-6 py-12 text-white sm:px-12 sm:py-16">
            <h2 id="t-fim" className="max-w-2xl text-[1.875rem] font-bold leading-[1.15] tracking-tight sm:text-[2.5rem]">
              O caderno é grátis, mas não te diz quanto sobrou
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/85">
              Comece hoje, com o primeiro mês por nossa conta. Em poucos minutos você registra a primeira venda.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={COMECAR}
                className="btn min-h-[52px] bg-white px-6 text-base text-brand-800 transition hover:bg-brand-50"
              >
                Criar minha loja grátis <ArrowRight size={18} aria-hidden />
              </Link>
              {WA_DUVIDA && (
                <a
                  href={WA_DUVIDA}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn min-h-[52px] border border-white/40 px-6 text-base text-white transition hover:bg-white/10"
                >
                  <MessageCircle size={18} aria-hidden /> Tirar dúvida no WhatsApp
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      <Rodape ancoras />
      <StickyCta />
    </div>
  );
}
