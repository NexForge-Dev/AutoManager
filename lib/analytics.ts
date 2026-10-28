import type { Produto, Venda, ContaPagar } from "./types";

const DIA = 24 * 60 * 60 * 1000;

// venda cancelada (estoque devolvido) não conta em nenhuma métrica
const naoCancelada = (v: Venda) => v.statusPagamento !== "cancelada";

export function vendidoUltimosDias(vendas: Venda[], produtoId: string, dias: number) {
  const corte = Date.now() - dias * DIA;
  let qtd = 0;
  for (const v of vendas) {
    if (v.data < corte || !naoCancelada(v)) continue;
    for (const it of v.itens) if (it.produtoId === produtoId) qtd += it.qtd;
  }
  return qtd;
}

export interface SugestaoReposicao {
  produto: Produto;
  vendido30d: number;
  velocidadeDia: number;
  diasCobertura: number;
  qtdSugerida: number;
  motivo: "sem_estoque" | "estoque_baixo" | "cobertura_curta";
}

// Heurística de reposição: média móvel 30d + estoque mínimo.
export function sugestoesReposicao(
  produtos: Produto[],
  vendas: Venda[]
): SugestaoReposicao[] {
  const out: SugestaoReposicao[] = [];
  for (const p of produtos) {
    if (!p.ativo) continue;
    // produto com grade tem estoque por variação: reposição é feita na tela do
    // produto (dar entrada no agregado corromperia a soma das variações).
    if (p.variacoes.length > 0) continue;
    const vendido30d = vendidoUltimosDias(vendas, p.id, 30);
    const velocidadeDia = vendido30d / 30;
    const diasCobertura = velocidadeDia > 0 ? p.estoqueAtual / velocidadeDia : Infinity;

    let motivo: SugestaoReposicao["motivo"] | null = null;
    if (p.estoqueAtual <= 0) motivo = "sem_estoque";
    else if (p.estoqueAtual <= p.estoqueMinimo) motivo = "estoque_baixo";
    else if (diasCobertura < 15) motivo = "cobertura_curta";

    if (!motivo) continue;

    const alvo = velocidadeDia > 0 ? Math.ceil(velocidadeDia * 30) : p.estoqueMinimo * 2;
    // nunca sugere 0 un: sem vendas e com mínimo 0, um produto zerado ainda
    // aparece (motivo "sem_estoque") e a sugestão mínima é 1 unidade.
    const qtdSugerida = Math.max(alvo - p.estoqueAtual, p.estoqueMinimo, 1);

    out.push({ produto: p, vendido30d, velocidadeDia, diasCobertura, qtdSugerida, motivo });
  }
  // mais urgente primeiro
  return out.sort((a, b) => a.diasCobertura - b.diasCobertura);
}

export interface MetricasDashboard {
  faturamentoMes: number;
  faturamentoMesAnterior: number;
  lucroMes: number;
  comissaoPendente: number;
  valorEstoque: number;
  qtdReposicao: number;
  topProdutos: { nome: string; qtd: number }[];
  rankingRevendedoras: { nome: string; total: number; pendente: number }[];
  vendasPorDia: { dia: string; total: number }[];
}

function inicioDoMes(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() - offset, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function calcularMetricas(
  produtos: Produto[],
  todasVendas: Venda[],
  revendedoras: { id: string; nome: string }[]
): MetricasDashboard {
  // Regime de competência (igual ao Relatório: faturamento/lucro projetado por
  // data da venda, fiado incluso). Canceladas ficam de fora de tudo.
  const vendas = todasVendas.filter(naoCancelada);
  const ini = inicioDoMes(0);
  const iniAnt = inicioDoMes(1);

  const doMes = vendas.filter((v) => v.data >= ini);
  const doMesAnt = vendas.filter((v) => v.data >= iniAnt && v.data < ini);

  const faturamentoMes = doMes.reduce((a, v) => a + v.total, 0);
  const faturamentoMesAnterior = doMesAnt.reduce((a, v) => a + v.total, 0);
  const lucroMes = doMes.reduce((a, v) => a + v.lucro, 0);
  const comissaoPendente = vendas
    .filter((v) => v.statusComissao === "pendente")
    .reduce((a, v) => a + v.comissaoTotal, 0);
  const valorEstoque = produtos.reduce((a, p) => a + p.estoqueAtual * p.custo, 0);

  // top produtos (qtd, todos os tempos)
  const prodMap = new Map<string, number>();
  for (const v of vendas)
    for (const it of v.itens)
      prodMap.set(it.nome, (prodMap.get(it.nome) || 0) + it.qtd);
  const topProdutos = [...prodMap.entries()]
    .map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 5);

  // ranking revendedoras
  const revMap = new Map<string, { total: number; pendente: number }>();
  for (const v of vendas) {
    if (!v.revendedoraId) continue;
    const cur = revMap.get(v.revendedoraId) || { total: 0, pendente: 0 };
    cur.total += v.total;
    if (v.statusComissao === "pendente") cur.pendente += v.comissaoTotal;
    revMap.set(v.revendedoraId, cur);
  }
  const rankingRevendedoras = [...revMap.entries()]
    .map(([id, d]) => ({
      nome: revendedoras.find((r) => r.id === id)?.nome || "-",
      total: d.total,
      pendente: d.pendente,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // vendas últimos 14 dias
  const vendasPorDia: { dia: string; total: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const fim = d.getTime() + 24 * 60 * 60 * 1000;
    const total = vendas
      .filter((v) => v.data >= d.getTime() && v.data < fim)
      .reduce((a, v) => a + v.total, 0);
    vendasPorDia.push({
      dia: `${d.getDate()}/${d.getMonth() + 1}`,
      total,
    });
  }

  return {
    faturamentoMes,
    faturamentoMesAnterior,
    lucroMes,
    comissaoPendente,
    valorEstoque,
    qtdReposicao: sugestoesReposicao(produtos, vendas).length,
    topProdutos,
    rankingRevendedoras,
    vendasPorDia,
  };
}

export function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ----------------------------------------------------- relatório financeiro
const FORMA_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  boleto: "Boleto",
};

export interface Relatorio {
  faturamento: number; // competência (vendas do período, não canceladas)
  recebido: number; // caixa (pagas, por data de pagamento no período)
  aReceber: number; // pendentes (fiado)
  descontos: number;
  custoVendas: number;
  comissao: number;
  lucroProjetado: number;
  lucroRealizado: number;
  margem: number; // %
  qtdPagas: number;
  qtdPendentes: number;
  qtdCanceladas: number;
  porForma: { forma: string; label: string; valor: number }[];
  fluxo: { dia: string; valor: number; ts: number }[];
  fluxoTotal: number;
  fluxoMedia: number;
  fluxoPico: { valor: number; dia: string };
  tendencia: number; // % 1a metade vs 2a metade
}

function diaLabel(ts: number) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function calcularRelatorio(vendas: Venda[], deMs: number, ateMs: number): Relatorio {
  const noPeriodo = vendas.filter((v) => v.data >= deMs && v.data <= ateMs);
  const validas = noPeriodo.filter((v) => v.statusPagamento !== "cancelada");

  const faturamento = validas.reduce((a, v) => a + v.total, 0);
  const descontos = validas.reduce((a, v) => a + (v.desconto || 0), 0);
  const custoVendas = validas.reduce((a, v) => a + v.custoTotal, 0);
  const comissao = validas.reduce((a, v) => a + v.comissaoTotal, 0);
  const lucroProjetado = faturamento - custoVendas - comissao;
  const margem = faturamento > 0 ? (lucroProjetado / faturamento) * 100 : 0;

  const aReceber = validas
    .filter((v) => v.statusPagamento === "pendente")
    .reduce((a, v) => a + v.total, 0);

  // caixa: pagas cuja data de pagamento caiu no período
  const pagasCaixa = vendas.filter(
    (v) =>
      v.statusPagamento === "paga" &&
      v.dataPagamento != null &&
      v.dataPagamento >= deMs &&
      v.dataPagamento <= ateMs
  );
  const recebido = pagasCaixa.reduce((a, v) => a + v.total, 0);
  const lucroRealizado = pagasCaixa.reduce((a, v) => a + v.lucro, 0);

  const qtdPagas = pagasCaixa.length;
  const qtdPendentes = validas.filter((v) => v.statusPagamento === "pendente").length;
  const qtdCanceladas = noPeriodo.filter((v) => v.statusPagamento === "cancelada").length;

  // por forma de pagamento (caixa)
  const formaMap = new Map<string, number>();
  for (const v of pagasCaixa) formaMap.set(v.formaPagamento, (formaMap.get(v.formaPagamento) || 0) + v.total);
  const porForma = ["dinheiro", "pix", "credito", "debito", "boleto"]
    .map((forma) => ({ forma, label: FORMA_LABEL[forma], valor: formaMap.get(forma) || 0 }))
    .filter((x) => x.valor > 0);

  // fluxo de caixa diário (por data de pagamento)
  const dias = Math.max(1, Math.ceil((ateMs - deMs) / DIA));
  const fluxo: { dia: string; valor: number; ts: number }[] = [];
  for (let i = 0; i < dias; i++) {
    const ini = deMs + i * DIA;
    const fim = ini + DIA;
    const valor = pagasCaixa
      .filter((v) => v.dataPagamento! >= ini && v.dataPagamento! < fim)
      .reduce((a, v) => a + v.total, 0);
    fluxo.push({ dia: diaLabel(ini), valor, ts: ini });
  }
  const fluxoTotal = recebido;
  const fluxoMedia = fluxoTotal / dias;
  const pico = fluxo.reduce((m, f) => (f.valor > m.valor ? f : m), { valor: 0, dia: "-", ts: 0 });
  const metade = Math.floor(fluxo.length / 2);
  const p1 = fluxo.slice(0, metade).reduce((a, f) => a + f.valor, 0);
  const p2 = fluxo.slice(metade).reduce((a, f) => a + f.valor, 0);
  const tendencia = p1 > 0 ? ((p2 - p1) / p1) * 100 : 0;

  return {
    faturamento,
    recebido,
    aReceber,
    descontos,
    custoVendas,
    comissao,
    lucroProjetado,
    lucroRealizado,
    margem,
    qtdPagas,
    qtdPendentes,
    qtdCanceladas,
    porForma,
    fluxo,
    fluxoTotal,
    fluxoMedia,
    fluxoPico: { valor: pico.valor, dia: pico.dia },
    tendencia,
  };
}

// ----------------------------------------------------- contas a pagar / fluxo
export interface ResumoContas {
  aPagar: number; // total pendente
  qtdPendentes: number;
  vencidasValor: number; // pendentes já vencidas
  vencidasQtd: number;
  aPagarMes: number; // pendentes que vencem no mês corrente
  pagasMes: number; // pagas no mês corrente
  porCategoria: { categoria: string; valor: number }[]; // pendentes agrupados
}

function ymdHoje(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function resumoContas(contas: ContaPagar[]): ResumoContas {
  const hoje = ymdHoje();
  const mes = hoje.slice(0, 7); // "YYYY-MM"
  const inicioMes = inicioDoMes(0);

  const pendentes = contas.filter((c) => c.status === "pendente");
  const aPagar = pendentes.reduce((a, c) => a + c.valor, 0);

  const vencidas = pendentes.filter((c) => c.vencimento < hoje);
  const aPagarMes = pendentes.filter((c) => c.vencimento.slice(0, 7) === mes).reduce((a, c) => a + c.valor, 0);
  const pagasMes = contas
    .filter((c) => c.status === "paga" && c.pagoEm != null && c.pagoEm >= inicioMes)
    .reduce((a, c) => a + c.valor, 0);

  const catMap = new Map<string, number>();
  for (const c of pendentes) {
    const k = c.categoria || "Outros";
    catMap.set(k, (catMap.get(k) || 0) + c.valor);
  }
  const porCategoria = [...catMap.entries()]
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);

  return {
    aPagar,
    qtdPendentes: pendentes.length,
    vencidasValor: vencidas.reduce((a, c) => a + c.valor, 0),
    vencidasQtd: vencidas.length,
    aPagarMes,
    pagasMes,
    porCategoria,
  };
}

// ----------------------------------------------------- analytics / inteligência
const CANAL_LABEL: Record<string, string> = {
  loja: "Loja",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

export interface AnalyticsLoja {
  porProduto: { nome: string; receita: number; qtd: number }[];
  porCanal: { canal: string; label: string; total: number; pct: number }[];
  porMes: { mes: string; total: number }[];
  ruptura: { nome: string; vendido30d: number; perdaEstimada: number }[];
  totalVendas: number;
  ticketMedio: number;
  itensPorVenda: number;
  tendenciaMes: number; // % mês atual vs anterior
}

export function calcularAnalytics(produtos: Produto[], vendas: Venda[]): AnalyticsLoja {
  const validas = vendas.filter(naoCancelada);

  // por produto (receita e qtd)
  const prodMap = new Map<string, { receita: number; qtd: number }>();
  for (const v of validas)
    for (const it of v.itens) {
      const cur = prodMap.get(it.nome) || { receita: 0, qtd: 0 };
      cur.receita += it.precoUnit * it.qtd;
      cur.qtd += it.qtd;
      prodMap.set(it.nome, cur);
    }
  const porProduto = [...prodMap.entries()]
    .map(([nome, d]) => ({ nome, ...d }))
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 8);

  // por canal
  const canalMap = new Map<string, number>();
  for (const v of validas) canalMap.set(v.canal, (canalMap.get(v.canal) || 0) + v.total);
  const totalCanal = [...canalMap.values()].reduce((a, b) => a + b, 0) || 1;
  const porCanal = [...canalMap.entries()]
    .map(([canal, total]) => ({
      canal,
      label: CANAL_LABEL[canal] || canal,
      total,
      pct: (total / totalCanal) * 100,
    }))
    .sort((a, b) => b.total - a.total);

  // por mês (últimos 6)
  const porMes: { mes: string; total: number }[] = [];
  const nomesMes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    d.setHours(0, 0, 0, 0);
    const ini = d.getTime();
    const fimD = new Date(d);
    fimD.setMonth(fimD.getMonth() + 1);
    const fim = fimD.getTime();
    const total = validas.filter((v) => v.data >= ini && v.data < fim).reduce((a, v) => a + v.total, 0);
    porMes.push({ mes: nomesMes[d.getMonth()], total });
  }
  const mesAtual = porMes[porMes.length - 1]?.total || 0;
  const mesAnt = porMes[porMes.length - 2]?.total || 0;
  const tendenciaMes = mesAnt > 0 ? ((mesAtual - mesAnt) / mesAnt) * 100 : 0;

  // ruptura: produtos sem estoque que vendem (oportunidade perdida)
  const ruptura = produtos
    .filter((p) => p.ativo && p.estoqueAtual <= 0)
    .map((p) => {
      const vendido30d = vendidoUltimosDias(vendas, p.id, 30);
      return { nome: p.nome, vendido30d, perdaEstimada: vendido30d * p.precoVenda };
    })
    .filter((r) => r.vendido30d > 0)
    .sort((a, b) => b.perdaEstimada - a.perdaEstimada)
    .slice(0, 5);

  const totalVendas = validas.length;
  const receitaTotal = validas.reduce((a, v) => a + v.total, 0);
  const itensTotal = validas.reduce((a, v) => a + v.itens.reduce((s, i) => s + i.qtd, 0), 0);

  return {
    porProduto,
    porCanal,
    porMes,
    ruptura,
    totalVendas,
    ticketMedio: totalVendas > 0 ? receitaTotal / totalVendas : 0,
    itensPorVenda: totalVendas > 0 ? itensTotal / totalVendas : 0,
    tendenciaMes,
  };
}

// ranking completo de revendedoras (mais → menos)
export function rankingRevendedoras(
  vendas: Venda[],
  revendedoras: { id: string; nome: string }[]
) {
  const map = new Map<string, { total: number; qtd: number; pendente: number }>();
  for (const v of vendas) {
    if (!v.revendedoraId || v.statusPagamento === "cancelada") continue;
    const cur = map.get(v.revendedoraId) || { total: 0, qtd: 0, pendente: 0 };
    cur.total += v.total;
    cur.qtd += 1;
    if (v.statusPagamento === "pendente") cur.pendente += v.total;
    map.set(v.revendedoraId, cur);
  }
  return revendedoras
    .map((r) => ({ nome: r.nome, ...(map.get(r.id) || { total: 0, qtd: 0, pendente: 0 }) }))
    .sort((a, b) => b.total - a.total);
}
