import { beforeEach, describe, expect, it, vi } from "vitest";

// AUT-009: cortesia em loja que já pagou pelo Stripe não pode contar como assinatura paga.
let gravado: any;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "su", email: "su@t.local", app_metadata: { role: "superadmin" } } } }) },
  }),
}));
vi.mock("@/lib/stripe", () => ({ assinaturaVivaDaOrg: async () => null }));
vi.mock("@/lib/adminAudit", () => ({ registrarAdminLog: async () => {} }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => {
      const b: any = {
        select: () => b,
        eq: () => b,
        maybeSingle: async () => ({ data: { org_id: "o", plano: "solo", nome: "Loja" }, error: null }),
        update: (d: any) => {
          gravado = d;
          return b;
        },
      };
      return b;
    },
  }),
}));

const { POST } = await import("./route");
const ORG = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  gravado = null;
});

describe("POST /api/admin/plano", () => {
  it("cortesia limpa o vínculo com o Stripe (fica fora do MRR)", async () => {
    const r = await POST(
      new Request("http://x/api/admin/plano", { method: "POST", body: JSON.stringify({ orgId: ORG, plano: "expansao" }) }) as any
    );
    expect(r.status).toBe(200);
    expect(gravado.provider).toBeNull();
    expect(gravado.provider_assinatura_id).toBeNull();
  });
});
