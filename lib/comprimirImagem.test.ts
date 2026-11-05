import { afterEach, describe, expect, it, vi } from "vitest";
import { comprimirImagem, dimensoesAlvo } from "./comprimirImagem";

describe("comprimirImagem", () => {
  it("reduz pelo lado maior e mantém a proporção", () => {
    expect(dimensoesAlvo(4000, 3000, 1200)).toEqual({ largura: 1200, altura: 900 });
    expect(dimensoesAlvo(3000, 4000, 1200)).toEqual({ largura: 900, altura: 1200 });
  });

  it("nunca amplia", () => {
    expect(dimensoesAlvo(800, 600, 1200)).toEqual({ largura: 800, altura: 600 });
  });

  function navegador(suportados: string[]) {
    const ctx = { drawImage: vi.fn(), fillRect: vi.fn(), globalCompositeOperation: "", fillStyle: "" };
    vi.stubGlobal("createImageBitmap", async () => ({ width: 4000, height: 3000, close() {} }));
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => ctx,
        // como o navegador: tipo sem suporte vira png
        toBlob: (ok: (b: Blob) => void, tipo: string) => {
          const t = suportados.includes(tipo) ? tipo : "image/png";
          ok(new Blob(["x".repeat(t === "image/png" ? 900 : 100)], { type: t }));
        },
      }),
    });
    return ctx;
  }
  const grande = () => new File(["x".repeat(1000)], "foto.jpeg", { type: "image/jpeg" });

  afterEach(() => vi.unstubAllGlobals());

  it("usa webp quando o navegador codifica", async () => {
    navegador(["image/webp", "image/jpeg"]);
    const f = await comprimirImagem(grande());
    expect(f.type).toBe("image/webp");
    expect(f.name).toBe("foto.webp");
  });

  it("F7: sem codificador webp (Safari) cai para jpeg, sobre fundo branco", async () => {
    const ctx = navegador(["image/jpeg"]);
    const f = await comprimirImagem(grande());
    expect(f.type).toBe("image/jpeg");
    expect(f.name).toBe("foto.jpg");
    expect(f.size).toBe(100);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("GIF e ambiente sem canvas seguem com o arquivo original", async () => {
    const gif = new File(["x"], "a.gif", { type: "image/gif" });
    expect(await comprimirImagem(gif)).toBe(gif);
    const jpg = new File(["x"], "a.jpg", { type: "image/jpeg" });
    expect(await comprimirImagem(jpg)).toBe(jpg); // node não tem createImageBitmap
  });
});
