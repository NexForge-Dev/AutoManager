// Datas "de calendário" da loja: dia, mês e ano no fuso de São Paulo, não no
// fuso do navegador/servidor. Sem isso, um dono viajando (ou a Vercel em UTC)
// via a venda das 22h de 31/10 cair em novembro nos relatórios.
//
// Só Intl (sem libs): o deslocamento é calculado por instante, então continua
// certo se o Brasil voltar a ter horário de verão.

export const FUSO_LOJA = "America/Sao_Paulo";

const formatador = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO_LOJA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export interface PartesData {
  ano: number;
  mes: number; // 1-12
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

/** Componentes da data/hora do instante `ms` no fuso da loja. */
export function partesSP(ms: number): PartesData {
  const p: Record<string, number> = {};
  for (const { type, value } of formatador.formatToParts(new Date(ms))) {
    if (type !== "literal") p[type] = Number(value);
  }
  return { ano: p.year, mes: p.month, dia: p.day, hora: p.hour % 24, minuto: p.minute, segundo: p.second };
}

/** Diferença (ms) entre o relógio de SP e o UTC no instante `ms` (ex.: -3h). */
function deslocamento(ms: number): number {
  const p = partesSP(ms);
  return Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo) - Math.floor(ms / 1000) * 1000;
}

/**
 * Instante (epoch ms) da meia-noite em SP do dia civil ano/mes/dia.
 * `mes` é 1-12 e aceita estouro nos dois sentidos (mes 0 = dezembro do ano
 * anterior, dia 32 = dia 1 do mês seguinte), como o Date.UTC.
 */
export function meiaNoiteSP(ano: number, mes: number, dia: number): number {
  const comoUTC = Date.UTC(ano, mes - 1, dia);
  // duas passadas: a 2ª corrige quando o deslocamento muda perto da virada
  const t = comoUTC - deslocamento(comoUTC);
  return comoUTC - deslocamento(t);
}

/** Início (00:00 SP) do dia de `agora` deslocado `deltaDias`. */
export function inicioDoDia(agora: number, deltaDias = 0): number {
  const p = partesSP(agora);
  return meiaNoiteSP(p.ano, p.mes, p.dia + deltaDias);
}

/** Último milissegundo (23:59:59.999 SP) do dia de `agora` deslocado `deltaDias`. */
export function fimDoDia(agora: number, deltaDias = 0): number {
  return inicioDoDia(agora, deltaDias + 1) - 1;
}

/** Início do mês (dia 1, 00:00 SP) do mês de `agora` deslocado `deltaMeses`. */
export function inicioDoMes(agora: number, deltaMeses = 0): number {
  const p = partesSP(agora);
  return meiaNoiteSP(p.ano, p.mes + deltaMeses, 1);
}

/** Início do ano (1º de janeiro, 00:00 SP) do ano de `agora`. */
export function inicioDoAno(agora: number): number {
  return meiaNoiteSP(partesSP(agora).ano, 1, 1);
}

const dois = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" do instante no fuso da loja (valor de <input type="date">). */
export function ymdSP(ms: number): string {
  const p = partesSP(ms);
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`;
}

/** Início (00:00 SP) de um "YYYY-MM-DD". NaN se o texto for inválido. */
export function inicioDeYmd(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? meiaNoiteSP(Number(m[1]), Number(m[2]), Number(m[3])) : NaN;
}

/** Fim (23:59:59.999 SP) de um "YYYY-MM-DD". NaN se o texto for inválido. */
export function fimDeYmd(ymd: string): number {
  const ini = inicioDeYmd(ymd);
  if (Number.isNaN(ini)) return NaN;
  const p = partesSP(ini);
  return meiaNoiteSP(p.ano, p.mes, p.dia + 1) - 1;
}

/** "d/m" sem zero à esquerda (eixo do gráfico do painel). */
export function diaMesCurto(ms: number): string {
  const p = partesSP(ms);
  return `${p.dia}/${p.mes}`;
}

/** "dd/mm" (eixo do fluxo de caixa do relatório). */
export function diaMes(ms: number): string {
  const p = partesSP(ms);
  return `${dois(p.dia)}/${dois(p.mes)}`;
}

/** Mês (0-11) do instante no fuso da loja. */
export function mesIndiceSP(ms: number): number {
  return partesSP(ms).mes - 1;
}
