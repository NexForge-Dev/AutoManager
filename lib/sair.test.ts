import { beforeEach, describe, expect, it, vi } from "vitest";

const ordem: string[] = [];
let falhaSignOut = false;

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: async () => {
        ordem.push("signOut");
        if (falhaSignOut) throw new Error("rede");
      },
    },
  }),
}));

const { sairDaConta } = await import("./sair");
const { gravarRascunho, chaveCarrinho, chaveOnboarding } = await import("./rascunho");

function storageFalso() {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

beforeEach(() => {
  ordem.length = 0;
  falhaSignOut = false;
  vi.stubGlobal("sessionStorage", storageFalso());
  vi.stubGlobal("window", { location: { assign: (u: string) => ordem.push(u) } });
});

describe("sairDaConta", () => {
  it("apaga os rascunhos, encerra a sessão e abre o Entrar com recarga", async () => {
    gravarRascunho(chaveCarrinho("o1", "u1"), { a: 1 });
    gravarRascunho(chaveOnboarding("u1"), { nomeLoja: "A" });
    gravarRascunho("am_plano_landing", "solo");
    await sairDaConta();
    expect(ordem).toEqual(["signOut", "/login?modo=entrar"]);
    expect(sessionStorage.getItem(chaveCarrinho("o1", "u1"))).toBeNull();
    expect(sessionStorage.getItem(chaveOnboarding("u1"))).toBeNull();
    expect(sessionStorage.getItem("am_plano_landing")).not.toBeNull();
  });

  it("sem rede ainda sai da tela", async () => {
    falhaSignOut = true;
    await sairDaConta("/acesso");
    expect(ordem).toEqual(["signOut", "/acesso"]);
  });

  it("rascunho é por usuário", () => {
    expect(chaveCarrinho("o1", "u1")).not.toBe(chaveCarrinho("o1", "u2"));
    expect(chaveOnboarding("u1")).not.toBe(chaveOnboarding("u2"));
  });
});
