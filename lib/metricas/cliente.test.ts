import { describe, it, expect } from "vitest";
import { marcarSessao } from "./cliente";

function memoria() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("marcarSessao (session_started 1x por sessão)", () => {
  it("primeira vez envia, repetição na mesma sessão não", () => {
    const a = memoria();
    expect(marcarSessao(a, "u1")).toBe(true);
    expect(marcarSessao(a, "u1")).toBe(false);
  });
  it("outra conta no mesmo navegador conta de novo", () => {
    const a = memoria();
    marcarSessao(a, "u1");
    expect(marcarSessao(a, "u2")).toBe(true);
  });
  it("sem armazenamento (ou bloqueado) envia; sem usuário não envia", () => {
    expect(marcarSessao(null, "u1")).toBe(true);
    const quebrado = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => {} };
    expect(marcarSessao(quebrado, "u1")).toBe(true);
    expect(marcarSessao(memoria(), "")).toBe(false);
  });
});
