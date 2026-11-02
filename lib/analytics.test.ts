import { describe, it, expect, vi, afterEach } from "vitest";
import { calcularMetricas } from "./analytics";
import type { Venda } from "./types";

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
