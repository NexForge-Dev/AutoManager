import { describe, it, expect } from "vitest";
import { parseNumero } from "./csvProdutos";

describe("parseNumero", () => {
  it.each([
    ["12,50", 12.5],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["R$ 1.500", 1500],
    ["12.90", 12.9],
    ["0", 0],
  ])("%s -> %s", (txt, n) => {
    expect(parseNumero(txt)).toBeCloseTo(n);
  });
  it("vazio vira NaN (o chamador decide o padrão)", () => {
    expect(parseNumero("")).toBeNaN();
  });
});

import { parseProdutosCSV } from "./csvProdutos";
describe("parseProdutosCSV", () => {
  it("aceita quebra de linha dentro de campo entre aspas", () => {
    const r = parseProdutosCSV('nome;preco\n"Colar\nlongo";25,00\nBrinco;10\n');
    expect(r.linhas.map((l) => l.nome)).toEqual(["Colar\nlongo", "Brinco"]);
  });
  it("recusa preço zero e custo negativo", () => {
    const r = parseProdutosCSV("nome;preco;custo\nA;0;1\nB;10;-2\nC;10;2\n");
    expect(r.linhas.map((l) => l.nome)).toEqual(["C"]);
    expect(r.erros).toHaveLength(2);
  });
});
