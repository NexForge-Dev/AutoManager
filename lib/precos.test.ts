import { describe, expect, it } from "vitest";
import { sugerirPreco } from "./precos";
import { parseNumero } from "./csvProdutos";

describe("sugerirPreco", () => {
  it("aplica a margem e formata com vírgula", () => {
    expect(sugerirPreco(25, 60)).toBe("40,00");
    expect(sugerirPreco(2.5, 100)).toBe("5,00");
    expect(sugerirPreco(1234.5, 0)).toBe("1234,50");
  });

  it("vazio para custo inválido ou zero", () => {
    expect(sugerirPreco(0, 60)).toBe("");
    expect(sugerirPreco(NaN, 60)).toBe("");
  });

  it("o texto sugerido volta ao mesmo número no parse", () => {
    expect(parseNumero(sugerirPreco(25, 60))).toBe(40);
    expect(parseNumero(sugerirPreco(1234.5, 10))).toBeCloseTo(1357.95);
  });
});
