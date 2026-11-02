import { describe, expect, it } from "vitest";
import { ATTR_FAVICON, definirIconLink, resolverTemaUsuario } from "./aparencia";

// DOM mínimo (o ambiente do vitest é node): só o que definirIconLink usa.
class FakeEl {
  attrs: Record<string, string> = {};
  parent: FakeHead | null = null;
  constructor(public tag: string) {}
  set rel(v: string) {
    this.attrs.rel = v;
  }
  getAttribute(k: string) {
    return k in this.attrs ? this.attrs[k] : null;
  }
  setAttribute(k: string, v: string) {
    this.attrs[k] = v;
  }
  remove() {
    throw new Error("não pode remover nós do <head>");
  }
}
class FakeHead {
  children: FakeEl[] = [];
  get lastElementChild() {
    return this.children[this.children.length - 1] ?? null;
  }
  appendChild(el: FakeEl) {
    if (el.parent) el.parent.children = el.parent.children.filter((c) => c !== el);
    el.parent = this;
    this.children.push(el);
    return el;
  }
  querySelector(sel: string) {
    const m = sel.match(/^link\[([\w-]+)="([^"]+)"\]$/);
    if (!m) throw new Error("seletor não suportado: " + sel);
    return this.children.find((c) => c.tag === "link" && c.getAttribute(m[1]) === m[2]) ?? null;
  }
}
function fakeDoc() {
  const head = new FakeHead();
  // ícone gerado pelo Next (metadata.icons) — pertence ao React
  const nextIcon = new FakeEl("link");
  nextIcon.setAttribute("rel", "icon");
  nextIcon.setAttribute("href", "/icon.svg");
  head.appendChild(nextIcon);
  const doc = { head, createElement: (t: string) => new FakeEl(t) };
  return { doc: doc as unknown as Document, head, nextIcon };
}

describe("definirIconLink", () => {
  it("cria um único link próprio no fim do head sem tocar no do Next", () => {
    const { doc, head, nextIcon } = fakeDoc();
    definirIconLink("icon", "/logo-a.png", doc);
    definirIconLink("icon", "/logo-b.png", doc);
    definirIconLink("icon", "/logo-b.png", doc);
    const nossos = head.children.filter((c) => c.getAttribute(ATTR_FAVICON) === "icon");
    expect(nossos).toHaveLength(1);
    expect(nossos[0].getAttribute("href")).toBe("/logo-b.png");
    expect(head.lastElementChild).toBe(nossos[0]);
    expect(head.children).toContain(nextIcon);
    expect(nextIcon.getAttribute("href")).toBe("/icon.svg");
  });

  it("mantém links separados por rel", () => {
    const { doc, head } = fakeDoc();
    definirIconLink("icon", "/x.png", doc);
    definirIconLink("apple-touch-icon", "/x.png", doc);
    expect(head.children.filter((c) => c.getAttribute(ATTR_FAVICON))).toHaveLength(2);
  });

  it("reaproveita o link criado pelo script anti-flash", () => {
    const { doc, head } = fakeDoc();
    const pre = new FakeEl("link");
    pre.setAttribute("rel", "icon");
    pre.setAttribute(ATTR_FAVICON, "icon");
    pre.setAttribute("href", "/cache.png");
    head.appendChild(pre);
    definirIconLink("icon", "/nova.png", doc);
    expect(head.children.filter((c) => c.getAttribute(ATTR_FAVICON) === "icon")).toEqual([pre]);
    expect(pre.getAttribute("href")).toBe("/nova.png");
  });
});

describe("resolverTemaUsuario", () => {
  const pref = (tema: string, base: string) => JSON.stringify({ tema, base });

  it("sem preferência segue o tema da loja", () => {
    expect(resolverTemaUsuario(null, "floresta")).toBe("floresta");
  });

  it("aplica a escolha do usuário enquanto o tema da loja não mudar", () => {
    expect(resolverTemaUsuario(pref("claro", "escuro"), "escuro")).toBe("claro");
    // tema nulo da loja = padrão "escuro"
    expect(resolverTemaUsuario(pref("claro", "escuro"), null)).toBe("claro");
  });

  it("descarta a escolha se o dono trocou o tema base", () => {
    expect(resolverTemaUsuario(pref("claro", "escuro"), "oceano")).toBe("oceano");
  });

  it("ignora valor inválido", () => {
    expect(resolverTemaUsuario("{lixo", "escuro")).toBe("escuro");
    expect(resolverTemaUsuario(pref("inexistente", "escuro"), "escuro")).toBe("escuro");
  });
});
