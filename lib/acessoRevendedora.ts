// Link de primeiro acesso da revendedora: a loja envia pelo WhatsApp e ela só
// toca no link — e-mail e código já chegam preenchidos em /acesso.
// Os dados vão no fragmento (#), que o navegador não envia ao servidor:
// o código não aparece em logs de acesso nem em cabeçalhos Referer.

const CODIGO = /^[A-Z0-9]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function linkConvite(origem: string, email: string, codigo: string): string {
  const hash = new URLSearchParams({
    email: email.trim().toLowerCase(),
    codigo: codigo.trim().toUpperCase(),
  });
  return `${origem.replace(/\/+$/, "")}/acesso#${hash.toString()}`;
}

export function lerConviteDoHash(hash: string): { email: string; codigo: string } {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const email = (p.get("email") ?? "").trim().toLowerCase();
  const codigo = (p.get("codigo") ?? "").trim().toUpperCase();
  return {
    email: email.length <= 254 && EMAIL.test(email) ? email : "",
    codigo: CODIGO.test(codigo) ? codigo : "",
  };
}

export function mensagemConvite(o: {
  nomeRevendedora: string;
  nomeLoja?: string | null;
  link: string;
  codigo: string;
}): string {
  const loja = o.nomeLoja?.trim() ? ` da ${o.nomeLoja.trim()}` : "";
  return [
    `Oi, ${o.nomeRevendedora.trim()}! Seu acesso de revendedora${loja} está liberado.`,
    ``,
    `Toque no link para ativar e criar sua senha:`,
    o.link,
    ``,
    `Se pedir, seu código é: ${o.codigo}`,
    `(válido por 7 dias)`,
  ].join("\n");
}
