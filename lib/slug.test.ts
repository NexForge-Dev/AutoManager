import { describe, it, expect } from "vitest";
import { slugify, slugSugerido } from "./slug";

// mesma regra do banco (0043 org_slug_formato)
const VALIDO = /^[a-z0-9]+(-+[a-z0-9]+)*$/;

describe("slug", () => {
  it("remove acentos e símbolos", () => {
    expect(slugify("Doces da Vó Zezé!")).toBe("doces-da-vo-zeze");
  });
  it("corte em 40 nunca termina em hífen e o sugerido passa na regra do banco", () => {
    const nome = "abcdefghij abcdefghij abcdefghij abcdefg x";
    expect(slugify(nome).endsWith("-")).toBe(false);
    const s = slugSugerido(nome);
    expect(VALIDO.test(s)).toBe(true);
    expect(s.length).toBeLessThanOrEqual(60);
  });
  it("nome vazio vira minha-loja", () => {
    expect(VALIDO.test(slugSugerido("!!!"))).toBe(true);
  });
});
