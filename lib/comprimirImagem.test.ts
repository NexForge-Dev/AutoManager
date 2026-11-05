import { describe, expect, it } from "vitest";
import { comprimirImagem, dimensoesAlvo } from "./comprimirImagem";

describe("comprimirImagem", () => {
  it("reduz pelo lado maior e mantém a proporção", () => {
    expect(dimensoesAlvo(4000, 3000, 1200)).toEqual({ largura: 1200, altura: 900 });
    expect(dimensoesAlvo(3000, 4000, 1200)).toEqual({ largura: 900, altura: 1200 });
  });

  it("nunca amplia", () => {
    expect(dimensoesAlvo(800, 600, 1200)).toEqual({ largura: 800, altura: 600 });
  });

  it("GIF e ambiente sem canvas seguem com o arquivo original", async () => {
    const gif = new File(["x"], "a.gif", { type: "image/gif" });
    expect(await comprimirImagem(gif)).toBe(gif);
    const jpg = new File(["x"], "a.jpg", { type: "image/jpeg" });
    expect(await comprimirImagem(jpg)).toBe(jpg); // node não tem createImageBitmap
  });
});
