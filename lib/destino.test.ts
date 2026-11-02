import { describe, it, expect } from "vitest";
import { decidirDestino, motivoDaUrl, MOTIVOS_ACESSO } from "./destino";

const base = { situacaoRevendedora: null, semOrg: false, role: "owner", onboardingCompleto: true } as const;

describe("decidirDestino (pós-login)", () => {
  it("revendedora ativa vai para /revenda", () => {
    expect(decidirDestino({ ...base, situacaoRevendedora: "ativa", semOrg: true })).toBe("/revenda");
  });

  it("revendedora bloqueada pelo plano/loja NÃO cai no onboarding (#11)", () => {
    // hydrate sem linha em usuario -> role default 'owner', onboarding false: antes ia p/ /onboarding
    const d = decidirDestino({ situacaoRevendedora: "suspensa", semOrg: true, role: "owner", onboardingCompleto: false });
    expect(d).toBe("/acesso?motivo=suspenso");
  });

  it("conta sem loja e sem vínculo de revendedora também não vai para o onboarding", () => {
    expect(decidirDestino({ ...base, semOrg: true, onboardingCompleto: false })).toBe("/acesso?motivo=sem_loja");
  });

  it("dono sem onboarding vai configurar; com onboarding vai ao painel", () => {
    expect(decidirDestino({ ...base, onboardingCompleto: false })).toBe("/onboarding");
    expect(decidirDestino(base)).toBe("/painel");
  });

  it("membros vão para a tela do papel, mesmo com onboarding pendente", () => {
    expect(decidirDestino({ ...base, role: "vendedor", onboardingCompleto: false })).toBe("/vender");
    expect(decidirDestino({ ...base, role: "motoboy" })).toBe("/entregas");
  });

  it("motivoDaUrl só aceita os motivos conhecidos", () => {
    expect(motivoDaUrl("?motivo=suspenso")).toBe("suspenso");
    expect(motivoDaUrl("?motivo=sem_loja")).toBe("sem_loja");
    expect(motivoDaUrl("?motivo=toString")).toBeNull();
    expect(motivoDaUrl("")).toBeNull();
    expect(MOTIVOS_ACESSO.suspenso).toMatch(/suspenso pela loja/);
  });
});
