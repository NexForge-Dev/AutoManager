// Kit de interface do painel: composições sobre as classes de app/globals.css.
// Mantém cabeçalhos, indicadores, avisos e estados vazios iguais em todas as telas.
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";

export type Tom = "neutral" | "brand" | "ok" | "warn" | "bad" | "info";

// classe de texto por tom (para ícones e valores)
const TEXTO_TOM: Record<Tom, string> = {
  neutral: "text-muted",
  brand: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  info: "text-info",
};

/** Título da tela + descrição curta + ações (a ação principal fica por último). */
export function PageHeader({
  titulo,
  descricao,
  acoes,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 pt-1">
      <div className="min-w-0 flex-1 basis-40">
        <h1 className="page-title">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-muted max-w-2xl">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2 max-w-full print-hidden">{acoes}</div>}
    </header>
  );
}

/** Indicador (KPI). `href` torna o cartão inteiro clicável. */
export function Stat({
  rotulo,
  valor,
  apoio,
  icone: Icone,
  tom = "neutral",
  valorTom,
  href,
  className = "",
}: {
  rotulo: string;
  valor: React.ReactNode;
  apoio?: React.ReactNode;
  icone?: LucideIcon;
  tom?: Tom;
  /** cor do número (padrão: cor do texto) */
  valorTom?: Tom;
  href?: string;
  className?: string;
}) {
  const conteudo = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow min-w-0">{rotulo}</span>
        {Icone && (
          <span className={`badge p-1 shrink-0 hidden sm:inline-flex tone-${tom}`} aria-hidden>
            <Icone size={15} />
          </span>
        )}
      </div>
      <div className={`figure mt-1.5 ${valorTom ? TEXTO_TOM[valorTom] : ""}`}>{valor}</div>
      {apoio && <div className="mt-1 text-xs text-muted">{apoio}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`card block min-w-0 ${className}`}>
        {conteudo}
      </Link>
    );
  }
  return <div className={`card min-w-0 ${className}`}>{conteudo}</div>;
}

/** Variação percentual com seta; `null` = sem base de comparação. */
export function Variacao({ pct, sufixo }: { pct: number | null; sufixo?: string }) {
  if (pct === null) return null;
  const sobe = pct >= 0;
  const Icone = sobe ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${sobe ? "text-ok" : "text-bad"}`}>
      <Icone size={13} aria-hidden />
      {Math.abs(pct).toFixed(0)}%{sufixo ? ` ${sufixo}` : ""}
    </span>
  );
}

/** Bloco com título e ação no cabeçalho. `lista` remove o padding (para .row). */
export function Painel({
  titulo,
  descricao,
  icone: Icone,
  acao,
  lista = false,
  className = "",
  children,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  icone?: LucideIcon;
  acao?: React.ReactNode;
  lista?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`card p-0 min-w-0 ${className}`}>
      <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
        <div className="min-w-0">
          <h2 className="section-title flex items-center gap-2">
            {Icone && <Icone size={16} className="text-muted shrink-0" aria-hidden />}
            <span className="truncate">{titulo}</span>
          </h2>
          {descricao && <p className="text-xs text-muted mt-0.5">{descricao}</p>}
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </header>
      {lista ? (
        <div className="[&>*]:border-t [&>*]:border-default">{children}</div>
      ) : (
        <div className="px-4 pb-4">{children}</div>
      )}
    </section>
  );
}

/** Link discreto "ver tudo" usado nos cabeçalhos de bloco. */
export function LinkAcao({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 min-h-[44px] md:min-h-0 text-sm font-medium text-accent hover:underline">
      {children}
      <ArrowRight size={14} aria-hidden />
    </Link>
  );
}

/** Selo de estado (pago, vencido, a receber...). */
export function Selo({
  tom = "neutral",
  icone: Icone,
  children,
  className = "",
}: {
  tom?: Tom;
  icone?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`badge tone-${tom} ${className}`}>
      {Icone && <Icone size={12} aria-hidden />}
      {children}
    </span>
  );
}

/** Aviso em faixa: alerta, pendência ou orientação. */
export function Aviso({
  tom = "info",
  icone: Icone,
  titulo,
  children,
  acao,
  className = "",
}: {
  tom?: Exclude<Tom, "neutral">;
  icone?: LucideIcon;
  titulo?: React.ReactNode;
  children?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
}) {
  const borda: Record<string, string> = {
    brand: "border-brand-500/30",
    ok: "border-ok/30",
    warn: "border-warn/30",
    bad: "border-bad/30",
    info: "border-info/30",
  };
  const fundo: Record<string, string> = {
    brand: "bg-brand-500/[.06]",
    ok: "bg-ok/[.06]",
    warn: "bg-warn/[.07]",
    bad: "bg-bad/[.06]",
    info: "bg-info/[.06]",
  };
  return (
    <div
      className={`flex flex-wrap items-start gap-3 border px-3.5 py-3 ${borda[tom]} ${fundo[tom]} ${className}`}
      style={{ borderRadius: "var(--r-card)" }}
    >
      {Icone && <Icone size={18} className={`shrink-0 mt-0.5 ${TEXTO_TOM[tom]}`} aria-hidden />}
      <div className="min-w-0 flex-1 basis-40 text-sm">
        {titulo && <div className="font-semibold">{titulo}</div>}
        {children && <div className={`text-muted ${titulo ? "mt-0.5" : ""}`}>{children}</div>}
      </div>
      {acao && <div className="max-w-full self-center">{acao}</div>}
    </div>
  );
}

/** Estado vazio: explica o que aparece aqui e qual o próximo passo. */
export function EstadoVazio({
  icone: Icone,
  titulo,
  children,
  acao,
  compacto = false,
  className = "",
}: {
  icone?: LucideIcon;
  titulo: React.ReactNode;
  children?: React.ReactNode;
  acao?: React.ReactNode;
  compacto?: boolean;
  className?: string;
}) {
  return (
    <div className={`text-center px-5 ${compacto ? "py-6" : "py-10"} ${className}`}>
      {Icone && (
        <span className="mx-auto mb-3 grid place-items-center h-11 w-11 rounded-xl tone-brand" aria-hidden>
          <Icone size={21} />
        </span>
      )}
      <p className="font-semibold">{titulo}</p>
      {children && <p className="mt-1 text-sm text-muted max-w-sm mx-auto">{children}</p>}
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  );
}

/** Controle segmentado: uma opção entre poucas (filtros, períodos, abas). */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
  className = "",
}: {
  opcoes: readonly (readonly [T, string])[];
  valor: T;
  onChange: (v: T) => void;
  rotulo: string;
  className?: string;
}) {
  return (
    <div className={`segmented ${className}`} role="group" aria-label={rotulo}>
      {opcoes.map(([id, texto]) => (
        <button key={id} type="button" aria-pressed={valor === id} onClick={() => onChange(id)}>
          {texto}
        </button>
      ))}
    </div>
  );
}

/** Barra de progresso (meta, limite do plano). `pct` de 0 a 100. */
export function Progresso({
  pct,
  tom = "brand",
  rotulo,
  className = "",
}: {
  pct: number;
  tom?: "brand" | "ok" | "warn" | "bad";
  rotulo?: string;
  className?: string;
}) {
  const cor = { brand: "bg-brand-500/70", ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[tom];
  const seguro = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  return (
    <div
      className={`h-1 rounded-full surface-alt overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(seguro)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={rotulo ?? "Progresso"}
    >
      <div className={`h-full rounded-full progress-fill ${cor}`} style={{ width: `${seguro}%` }} />
    </div>
  );
}

/** Iniciais de um nome, para avatares sem foto. */
export function iniciais(nome: string | null | undefined): string {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const a = partes[0][0];
  const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (a + b).toUpperCase();
}

/** Avatar quadrado com iniciais (revendedoras, clientes, equipe). */
export function Avatar({ nome, className = "" }: { nome: string | null | undefined; className?: string }) {
  return (
    <span
      className={`grid place-items-center h-9 w-9 shrink-0 rounded-lg surface-alt text-xs font-bold text-muted ${className}`}
      aria-hidden
    >
      {iniciais(nome)}
    </span>
  );
}
