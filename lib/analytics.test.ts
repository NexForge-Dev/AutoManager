import { describe, it, expect, vi, afterEach } from "vitest";
import { brl, brlKpi, calcularAnalytics, calcularMetricas, calcularRelatorio, centavos, sugestoesReposicao } from "./analytics";
import type { Produto, Venda } from "./types";

const venda = (iso: string, total: number): Venda => ({
  id: iso,
  data: Date.parse(iso),
  canal: "loja" as Venda["canal"],
  revendedoraId: null,
  itens: [],
  total,
  custoTotal: 0,
  comissaoTotal: 0,
  lucro: total,
  statusComissao: "paga",
  formaPagamento: "pix",
  parcelas: 1,
  statusPagamento: "paga",
  desconto: 0,
  dataPagamento: Date.parse(iso),
});

describe("calcularMetricas no fuso da loja", () => {
  afterEach(() => vi.useRealTimers());

  it("mês corrente e gráfico de 14 dias seguem o calendário de São Paulo", () => {
    // 31/10 20:30 em SP (em UTC/Europa já é 31/10 23:30 ou 01/11)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T23:30:00Z"));
    const vendas = [
      venda("2026-10-31T22:00:00Z", 100), // 31/10 19:00 SP -> outubro
      venda("2026-10-01T02:30:00Z", 50), // 30/09 23:30 SP -> setembro (mês anterior)
      venda("2026-10-01T03:00:00Z", 7), // 01/10 00:00 SP -> outubro
    ];
    const m = calcularMetricas([], vendas, []);
    expect(m.faturamentoMes).toBe(107);
    expect(m.faturamentoMesAnterior).toBe(50);
    expect(m.vendasPorDia.at(-1)).toEqual({ dia: "31/10", total: 100 });
    expect(m.vendasPorDia[0].dia).toBe("18/10");
  });
});

const item = (nome: string, qtd: number, precoUnit: number) => ({
  produtoId: nome,
  nome,
  qtd,
  precoUnit,
  custoUnit: 0,
  comissaoPercent: 0,
});

const produto = (over: Partial<Produto> = {}): Produto => ({
  id: "p1",
  nome: "Anel",
  categoria: "",
  custo: 10,
  precoVenda: 30,
  impostoPercent: 0,
  imagens: [],
  estoqueAtual: 0,
  estoqueMinimo: 2,
  variacoes: [],
  ativo: true,
  criadoEm: 0,
  ...over,
});

describe("calcularAnalytics", () => {
  it("ticket médio e itens/venda ignoram recebimento avulso e canceladas", () => {
    const comItens = { ...venda("2026-10-10T15:00:00Z", 100), itens: [item("A", 2, 50)] };
    const avulso = venda("2026-10-11T15:00:00Z", 900); // sem itens
    const cancelada = {
      ...venda("2026-10-12T15:00:00Z", 500),
      itens: [item("B", 10, 50)],
      statusPagamento: "cancelada" as const,
    };
    const a = calcularAnalytics([], [comItens, avulso, cancelada]);
    expect(a.totalVendas).toBe(2);
    expect(a.vendasComItens).toBe(1);
    expect(a.ticketMedio).toBe(100);
    expect(a.itensPorVenda).toBe(2);
    expect(a.porProduto.map((p) => p.nome)).toEqual(["A"]);
  });

  it("receita por produto rateia o desconto e soma o faturamento", () => {
    // bruto 100 (A 75 + B 25), desconto 10 -> total 90
    const v = {
      ...venda("2026-10-10T15:00:00Z", 90),
      desconto: 10,
      itens: [item("A", 3, 25), item("B", 1, 25)],
    };
    const a = calcularAnalytics([], [v]);
    expect(a.porProduto).toEqual([
      { nome: "A", receita: 67.5, qtd: 3 },
      { nome: "B", receita: 22.5, qtd: 1 },
    ]);
    expect(a.porProduto.reduce((s, p) => s + p.receita, 0)).toBe(90);
  });

  it("tendência do mês é null sem vendas no mês anterior", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T15:00:00Z"));
    const a = calcularAnalytics([], [venda("2026-10-10T15:00:00Z", 50)]);
    expect(a.tendenciaMes).toBeNull();
    vi.useRealTimers();
  });
});

describe("calcularRelatorio", () => {
  it("cancelada fica fora de faturamento/lucro; descontos contam vendas com desconto", () => {
    const de = Date.parse("2026-10-01T03:00:00Z");
    const ate = Date.parse("2026-11-01T02:59:59.999Z");
    const ok = { ...venda("2026-10-10T15:00:00Z", 0.1), desconto: 0.2, lucro: 0.1 };
    const ok2 = { ...venda("2026-10-11T15:00:00Z", 0.2), lucro: 0.2 };
    const canc = { ...venda("2026-10-12T15:00:00Z", 999), desconto: 5, statusPagamento: "cancelada" as const };
    const r = calcularRelatorio([ok, ok2, canc], de, ate);
    expect(r.faturamento).toBe(0.3); // arredondado a centavos (não 0.30000000000000004)
    expect(r.recebido).toBe(0.3);
    expect(r.lucroRealizado).toBe(0.3);
    expect(r.descontos).toBe(0.2);
    expect(r.qtdComDesconto).toBe(1);
    expect(r.qtdCanceladas).toBe(1);
  });

  it("período de um dia não tem tendência (null, não +0%)", () => {
    const de = Date.parse("2026-10-10T03:00:00Z");
    const ate = Date.parse("2026-10-11T02:59:59.999Z");
    const r = calcularRelatorio([venda("2026-10-10T15:00:00Z", 10)], de, ate);
    expect(r.fluxo).toHaveLength(1);
    expect(r.tendencia).toBeNull();
  });
});

describe("sugestoesReposicao", () => {
  it("inclui produto com grade pelo agregado, com as variações ativas (menor estoque primeiro)", () => {
    const p = produto({
      estoqueAtual: 1,
      variacoes: [
        { id: "v1", nome: "P", estoqueAtual: 1, precoAjuste: 0, ativo: true },
        { id: "v2", nome: "M", estoqueAtual: 0, precoAjuste: 0, ativo: true },
        { id: "v3", nome: "G", estoqueAtual: 0, precoAjuste: 0, ativo: false },
      ],
    });
    const [s] = sugestoesReposicao([p], []);
    expect(s.motivo).toBe("estoque_baixo");
    expect(s.variacoes.map((v) => v.id)).toEqual(["v2", "v1"]);
    expect(s.qtdSugerida).toBeGreaterThanOrEqual(1);
  });

  it("produto sem grade vem com lista de variações vazia", () => {
    const [s] = sugestoesReposicao([produto()], []);
    expect(s.motivo).toBe("sem_estoque");
    expect(s.variacoes).toEqual([]);
  });
});

describe("centavos", () => {
  it("arredonda e não devolve -0", () => {
    expect(centavos(0.1 + 0.2)).toBe(0.3);
    expect(Object.is(centavos(-0.001), 0)).toBe(true);
  });
});

describe("brlKpi", () => {
  it("valor normal segue inteiro", () => {
    expect(brlKpi(99_999_999)).toBe(brl(99_999_999));
  });

  it("AUT-016: valor extremo vira forma curta", () => {
    expect(brlKpi(4_500_007_011.5).replace(/\s/g, " ")).toBe("R$ 4,5 bi");
  });
});
