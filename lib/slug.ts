// Converte um nome em slug de URL: minúsculo, sem acento, hifens.
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, ""); // o corte pode cair num hífen (slugSugerido viraria "nome--abcd")
}

export function slugSugerido(nome: string): string {
  const base = slugify(nome) || "minha-loja";
  const rand = Math.random().toString(36).slice(2, 6);
  return `${base}-${rand}`;
}
