import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const EMAIL = "nexforge.d4v29@gmail.com";

const h = vi.hoisted(() => ({ preenchida: null as Record<string, string> | null }));

// EMPRESA real por padrão; com h.preenchida, simula o dia em que os campos forem preenchidos
vi.mock("@/lib/empresa", async (importOriginal) => {
  const real = await importOriginal<typeof import("./empresa")>();
  return {
    ...real,
    get EMPRESA() {
      return { ...real.EMPRESA, ...(h.preenchida ?? {}) };
    },
  };
});

import { EMPRESA, linhaEmpresa } from "./empresa";
import { PLANOS, brlPreco } from "./plans";
import PrivacidadePage from "@/app/privacidade/page";
import TermosPage from "@/app/termos/page";
import CancelamentoPage from "@/app/cancelamento/page";

// texto corrido da página, sem tags
const texto = (Pagina: () => JSX.Element) =>
  renderToStaticMarkup(createElement(Pagina))
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

beforeEach(() => {
  h.preenchida = null;
});

describe("dados da empresa", () => {
  it("só o e-mail de suporte está preenchido; dados jurídicos seguem vazios", () => {
    expect(EMPRESA.emailSuporte).toBe(EMAIL);
    expect(EMPRESA.razaoSocial).toBe("");
    expect(EMPRESA.cnpj).toBe("");
    expect(EMPRESA.cidadeUf).toBe("");
  });

  it("o rodapé mostra o e-mail", () => {
    expect(linhaEmpresa()).toContain(EMAIL);
  });
});

describe("páginas legais com razão social, CNPJ e cidade vazios", () => {
  it.each([
    ["privacidade", PrivacidadePage],
    ["termos", TermosPage],
    ["cancelamento", CancelamentoPage],
  ])("%s mostra o e-mail, não deixa rótulo vazio nem cita o Mercado Pago", (_nome, Pagina) => {
    const t = texto(Pagina);
    expect(t).toContain(EMAIL);
    expect(t).toContain("04/11/2026");
    expect(t).not.toMatch(/undefined|null|Razão social:|CNPJ:|Sede:/);
    expect(t).not.toMatch(/Mercado ?Pago/i);
  });

  it("os Termos não apontam para uma sede que a página não mostra", () => {
    expect(texto(TermosPage)).not.toContain("sede do fornecedor");
  });

  it("a Privacidade indica o encarregado com o e-mail", () => {
    expect(texto(PrivacidadePage)).toMatch(new RegExp(`Encarregado: .*E-mail: ${EMAIL.replace(/\./g, "\\.")}`));
  });
});

describe("preencher lib/empresa.ts basta", () => {
  it("razão social, CNPJ, sede, foro e encarregado aparecem sem mexer nas páginas", () => {
    h.preenchida = {
      razaoSocial: "Empresa Exemplo LTDA",
      cnpj: "00.000.000/0001-00",
      cidadeUf: "Cidade Exemplo/UF",
      encarregadoLgpd: "Pessoa Exemplo",
    };
    const termos = texto(TermosPage);
    expect(termos).toContain("Razão social: Empresa Exemplo LTDA");
    expect(termos).toContain("CNPJ: 00.000.000/0001-00");
    expect(termos).toContain("Sede: Cidade Exemplo/UF");
    expect(termos).toContain("foro da comarca de Cidade Exemplo/UF");
    expect(texto(PrivacidadePage)).toContain("Encarregado: Pessoa Exemplo");
  });
});

describe("os Termos acompanham lib/plans.ts", () => {
  it("todos os preços aparecem", () => {
    const t = texto(TermosPage);
    for (const p of Object.values(PLANOS)) expect(t).toContain(`${p.nome} — ${brlPreco(p.precoCentavos).replace(/\s/g, " ")}/mês`);
    for (const preco of ["R$ 20", "R$ 49", "R$ 99", "R$ 199"]) expect(t).toContain(preco);
  });

  it("o piso sem assinatura é o Ambulante, com o arrependimento de 7 dias mantido", () => {
    const t = texto(TermosPage);
    expect(t).toContain(`recursos do plano ${PLANOS.ambulante.nome}`);
    expect(t).toContain("direito de arrependimento de 7 dias");
    expect(t).not.toContain("plano básico");
  });
});
