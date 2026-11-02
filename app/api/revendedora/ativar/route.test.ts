import { describe, it, expect, vi, beforeEach } from "vitest";

// banco falso: o rate limit responde conforme `permitido`; qualquer outra
// consulta devolve "nenhuma revendedora" (403 genérico).
let permitido = true;
const rpc = vi.fn(async () => ({ data: permitido, error: null }));
const consulta: any = new Proxy(
  {},
  {
    get: (_t, prop) =>
      prop === "then" ? (ok: (v: unknown) => void) => ok({ data: [], error: null }) : () => consulta,
  }
);
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc, from: () => consulta, auth: { admin: {} } })),
}));

import { POST } from "./route";

function pedido(body: unknown, ip = "9.9.9.9") {
  return new Request("http://localhost/api/revendedora/ativar", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const valido = { email: "rev@exemplo.com", senha: "senha-forte", codigo: "ABC234" };

describe("POST /api/revendedora/ativar", () => {
  beforeEach(() => {
    permitido = true;
    rpc.mockClear();
  });

  it("conta a tentativa por IP e por e-mail (com hash)", async () => {
    const res = await POST(pedido(valido));
    expect(res.status).toBe(403);
    expect(rpc).toHaveBeenCalledTimes(2);
    const chaves = rpc.mock.calls.map((c: any[]) => c[1].p_chave as string);
    expect(chaves[0]).toMatch(/^ativar:ip:[0-9a-f]{64}$/);
    expect(chaves[1]).toMatch(/^ativar:email:[0-9a-f]{64}$/);
    expect(chaves.join()).not.toContain("rev@exemplo.com");
    expect(chaves.join()).not.toContain("9.9.9.9");
  });

  it("responde 429 com Retry-After quando estoura o limite", async () => {
    permitido = false;
    const res = await POST(pedido(valido));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("900");
    expect((await res.json()).erro).toMatch(/Muitas tentativas/);
  });

  it("entrada inválida volta 400 sem tocar no limitador", async () => {
    const res = await POST(pedido({ email: "x@y.com", senha: "1" }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
