import { describe, it, expect } from "vitest";
import { emailValido, erroAuthPtBr, normalizarEmail, uuidValido } from "./validacao";

describe("validacao", () => {
  it("normalizarEmail tira espaços e caixa; não-string vira vazio", () => {
    expect(normalizarEmail("  Maria@Loja.COM ")).toBe("maria@loja.com");
    expect(normalizarEmail(42)).toBe("");
    expect(normalizarEmail(null)).toBe("");
  });

  it("emailValido aceita e-mails comuns", () => {
    for (const e of ["a@b.co", "maria.silva+loja@gmail.com", "rev_1@sub.dominio.com.br", "x-y@a-b.io"])
      expect(emailValido(e), e).toBe(true);
  });

  it("emailValido recusa curingas, espaços e formatos quebrados", () => {
    for (const e of ["", "%@qa.local", "r%", "%pend%", "a b@x.com", "a@b", "@b.com", "a@b..com", "a@-b.com", "a*@b.com", "a,b@c.com", "a@b.com)", "x".repeat(250) + "@b.com"])
      expect(emailValido(e), e).toBe(false);
  });

  it("uuidValido", () => {
    expect(uuidValido("a962d3f2-a414-4751-90cf-1baa612825ca")).toBe(true);
    expect(uuidValido("lixo")).toBe(false);
    expect(uuidValido({ id: 1 })).toBe(false);
  });

  it("erroAuthPtBr traduz e nunca devolve a mensagem crua", () => {
    expect(erroAuthPtBr("A user with this email address has already been registered", "x")).toBe("E-mail já cadastrado");
    expect(erroAuthPtBr("Password should be at least 6 characters", "x")).toMatch(/pelo menos 8/);
    expect(erroAuthPtBr("Password cannot be longer than 72 characters", "x")).toMatch(/no máximo 72/);
    expect(erroAuthPtBr("Unable to validate email address: invalid format", "x")).toBe("E-mail inválido");
    expect(erroAuthPtBr("Database error creating new user", "x")).toMatch(/limite do seu plano/);
    expect(erroAuthPtBr("some internal gotrue failure", "Falhou.")).toBe("Falhou.");
  });
});
