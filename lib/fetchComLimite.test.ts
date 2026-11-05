import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchComLimite } from "./fetchComLimite";

// fetch que nunca responde; só termina se o sinal abortar
const pendurado = ((_: any, init?: RequestInit) =>
  new Promise((_ok, ko) => {
    init?.signal?.addEventListener("abort", () => ko(init.signal!.reason));
  })) as typeof fetch;

afterEach(() => vi.useRealTimers());

describe("fetchComLimite", () => {
  it("leitura pendurada falha no prazo", async () => {
    vi.useFakeTimers();
    const p = fetchComLimite(1000, pendurado)("http://x/rest/v1/produto");
    const r = expect(p).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(1001);
    await r;
  });

  it("resposta a tempo passa direto", async () => {
    const base = vi.fn(async () => new Response("ok")) as unknown as typeof fetch;
    const r = await fetchComLimite(1000, base)("http://x/rest/v1/produto");
    expect(await r.text()).toBe("ok");
  });

  it("upload de foto não tem prazo", async () => {
    const base = vi.fn(async () => new Response("ok"));
    await fetchComLimite(1000, base as unknown as typeof fetch)("http://x/storage/v1/object/produtos/a.jpg");
    expect((base.mock.calls[0] as any[])[1]).toBeUndefined();
  });

  it("AUT-018: 401 do banco avisa que a sessão acabou; 403 (RLS) não", async () => {
    const aviso = vi.fn();
    const resp = (status: number) => (async () => new Response("{}", { status })) as unknown as typeof fetch;
    await fetchComLimite(1000, resp(403), aviso)("http://x/rest/v1/venda");
    await fetchComLimite(1000, resp(401), aviso)("http://x/auth/v1/token");
    expect(aviso).not.toHaveBeenCalled();
    await fetchComLimite(1000, resp(401), aviso)("http://x/rest/v1/rpc/registrar_venda");
    expect(aviso).toHaveBeenCalledOnce();
  });

  it("cancelamento de quem chamou é repassado", async () => {
    const c = new AbortController();
    const p = fetchComLimite(60_000, pendurado)("http://x/rest/v1/produto", { signal: c.signal });
    c.abort(new DOMException("parou", "AbortError"));
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});
