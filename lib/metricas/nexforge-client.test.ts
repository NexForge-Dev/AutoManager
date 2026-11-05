import { describe, it, expect, vi, afterEach } from "vitest";
import { createRequire } from "node:module";

// carregado pelo Node: o Vite não analisa .cjs
const { createNexforge } = createRequire(import.meta.url)("./nexforge-client.cjs") as typeof import("./nexforge-client.cjs");

const nexforge = () =>
  createNexforge({
    endpoint: "http://painel.teste/api/ingest",
    ingestKey: "chave",
    pseudonymSecret: "segredo",
    flushIntervalMs: 0,
  });

afterEach(() => vi.unstubAllGlobals());

async function paginaEnviada(page: string) {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", fetch);
  expect(await nexforge().feedback({ externalId: "1", kind: "problem", message: "oi", page })).toBe(true);
  expect(fetch.mock.calls[0][0]).toBe("http://painel.teste/api/feedback");
  return JSON.parse(String(fetch.mock.calls[0][1].body)).page;
}

describe("feedback: a página sai sem ids", () => {
  it.each([
    ["/produtos", "/produtos"],
    ["/produtos/123", "/produtos/:id"],
    ["/pedidos/a1b2-c3/itens/9?x=1#y", "/pedidos/:id/itens/:id"],
    ["", ""],
  ])("%s vira %s", async (entrada, saida) => {
    expect(await paginaEnviada(entrada)).toBe(saida);
  });
});
