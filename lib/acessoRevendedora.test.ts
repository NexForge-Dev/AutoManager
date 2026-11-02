import { describe, expect, it } from "vitest";
import { lerConviteDoHash, linkConvite, mensagemConvite } from "./acessoRevendedora";

describe("linkConvite", () => {
  it("leva e-mail e código no fragmento (#), que não vai para o servidor nem para logs", () => {
    const url = linkConvite("https://loja.app", "Ana@Mail.com", "ab12cd");
    expect(url.startsWith("https://loja.app/acesso#")).toBe(true);
    expect(url).not.toContain("?");
    expect(lerConviteDoHash(new URL(url).hash)).toEqual({ email: "ana@mail.com", codigo: "AB12CD" });
  });

  it("codifica e-mails com caracteres especiais", () => {
    const url = linkConvite("https://loja.app/", "ana+rev@mail.com", "ABC123");
    expect(url).toContain("/acesso#");
    expect(url).not.toContain("//acesso");
    expect(lerConviteDoHash(new URL(url).hash).email).toBe("ana+rev@mail.com");
  });
});

describe("lerConviteDoHash", () => {
  it("aceita hash com ou sem #", () => {
    expect(lerConviteDoHash("email=a%40b.com&codigo=XYZ789")).toEqual({ email: "a@b.com", codigo: "XYZ789" });
  });

  it("descarta valores inválidos em vez de preencher lixo", () => {
    expect(lerConviteDoHash("#email=nao-e-email&codigo=<script>")).toEqual({ email: "", codigo: "" });
    expect(lerConviteDoHash("#codigo=ABCDEFGHIJ")).toEqual({ email: "", codigo: "" });
    expect(lerConviteDoHash("")).toEqual({ email: "", codigo: "" });
  });
});

describe("mensagemConvite", () => {
  it("traz o link pronto e o código, para quem preferir digitar", () => {
    const msg = mensagemConvite({ nomeRevendedora: "Ana", nomeLoja: "Bella Joias", link: "https://x/acesso#a", codigo: "ABC123" });
    expect(msg).toContain("Ana");
    expect(msg).toContain("Bella Joias");
    expect(msg).toContain("https://x/acesso#a");
    expect(msg).toContain("ABC123");
  });

  it("funciona sem nome da loja", () => {
    const msg = mensagemConvite({ nomeRevendedora: "Ana", link: "https://x/acesso#a", codigo: "ABC123" });
    expect(msg).not.toContain("undefined");
  });
});
