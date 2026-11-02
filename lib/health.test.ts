import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc })),
}));

import { bancoResponde, verificarSaude } from "./health";
import { GET } from "@/app/api/health/route";

function respostaRpc(resultado: { error: unknown } | Error) {
  rpc.mockReturnValue({
    abortSignal: () => (resultado instanceof Error ? Promise.reject(resultado) : Promise.resolve(resultado)),
  });
}

describe("health", () => {
  const env = { ...process.env };
  beforeEach(() => {
    rpc.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-teste";
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it("verificarSaude reflete o resultado do banco", async () => {
    expect(await verificarSaude(async () => true)).toEqual({ ok: true, database: true });
    expect(await verificarSaude(async () => false)).toEqual({ ok: false, database: false });
    expect(await verificarSaude(async () => Promise.reject(new Error("x")))).toEqual({ ok: false, database: false });
  });

  it("bancoResponde: true sem erro, false com erro ou exceção", async () => {
    respostaRpc({ error: null });
    expect(await bancoResponde()).toBe(true);
    expect(rpc).toHaveBeenCalledWith("loja_publica", { p_slug: "__health__" });
    respostaRpc({ error: { message: "boom" } });
    expect(await bancoResponde()).toBe(false);
    respostaRpc(new Error("timeout"));
    expect(await bancoResponde()).toBe(false);
  });

  it("bancoResponde: false sem variáveis do Supabase", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(await bancoResponde()).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("GET /api/health: 200 com banco ok, 503 sem banco, só booleanos e no-store", async () => {
    respostaRpc({ error: null });
    let res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, database: true });

    respostaRpc({ error: { message: "senha=segredo" } });
    res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ ok: false, database: false });
    expect(JSON.stringify(body)).not.toContain("segredo");
  });
});
