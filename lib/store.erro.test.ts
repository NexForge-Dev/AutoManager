import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase/client", () => ({ createClient: () => ({}) }));
const { erroAmigavel } = await import("./store");

describe("erroAmigavel", () => {
  it("AUT-017: estouro numérico vira mensagem em pt-BR", () => {
    expect(erroAmigavel("numeric field overflow")).toBe("Valor alto demais. Confira o número digitado.");
    expect(erroAmigavel("value too long for type character varying(120)")).toMatch(/Texto muito longo/);
  });

  it("AUT-017: erro desconhecido nunca aparece cru", () => {
    const console_ = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(erroAmigavel('duplicate key value violates unique constraint "x"')).toBe("Não foi possível salvar. Tente de novo.");
    expect(console_).toHaveBeenCalled();
    console_.mockRestore();
    expect(erroAmigavel(undefined)).toBe("Não foi possível salvar. Tente de novo.");
  });

  it("códigos de negócio seguem traduzidos", () => {
    expect(erroAmigavel("sem_estoque")).toBe("Estoque insuficiente.");
    expect(erroAmigavel("limite_vendedores")).toMatch(/limite/i);
    expect(erroAmigavel("limite_revendedoras")).toMatch(/limite/i);
    expect(erroAmigavel("Failed to fetch")).toBe("Sem conexão. Tente de novo.");
  });
});
