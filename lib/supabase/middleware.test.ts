import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let resposta: { data: { user: any }; error: any };

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => resposta } }),
}));

const { updateSession } = await import("./middleware");

const pedir = (rota: string) => updateSession(new NextRequest("http://localhost" + rota));
const destino = (r: Response) => r.headers.get("location");

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://sb.local";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
});

describe("updateSession", () => {
  it("sem sessão: rota privada vai para o login", async () => {
    resposta = { data: { user: null }, error: { name: "AuthSessionMissingError", status: 400 } };
    expect(destino(await pedir("/painel"))).toContain("/login?modo=entrar");
  });

  it("token recusado: rota privada vai para o login", async () => {
    resposta = { data: { user: null }, error: { name: "AuthApiError", status: 403 } };
    expect(destino(await pedir("/painel"))).toContain("/login");
  });

  it("AUT-019: backend fora não é falta de sessão, a tela abre e mostra a falha", async () => {
    resposta = { data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0 } };
    expect(destino(await pedir("/painel"))).toBeNull();
  });

  it("anônimo do chat continua fora do painel", async () => {
    resposta = { data: { user: { is_anonymous: true } }, error: null };
    expect(destino(await pedir("/painel"))).toContain("/login");
  });

  it("logado passa", async () => {
    resposta = { data: { user: { id: "u1" } }, error: null };
    expect(destino(await pedir("/painel"))).toBeNull();
  });
});
