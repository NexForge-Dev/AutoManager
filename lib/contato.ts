// Normaliza valores de contato/redes em links clicáveis. Aceita handle (@nome),
// número com máscara, ou URL completa.

export function soDigitos(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

// wa.me exige o código do país: "DDD + número" (10-11 dígitos) ganha o 55 do Brasil
export function waNumero(numero: string | null | undefined): string {
  const d = soDigitos(numero);
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

export function waLink(numero: string | null | undefined): string {
  const d = waNumero(numero);
  return d ? `https://wa.me/${d}` : "";
}

function social(base: string, v: string | null | undefined): string {
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return base + v.replace(/^@/, "").trim();
}

export const igLink = (v: string | null | undefined) => social("https://instagram.com/", v);
export const fbLink = (v: string | null | undefined) => social("https://facebook.com/", v);
export const ttLink = (v: string | null | undefined) => social("https://tiktok.com/@", v);
