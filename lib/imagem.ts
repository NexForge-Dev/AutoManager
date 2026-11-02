// Validação de imagem antes do upload: tipo e tamanho.
// Evita abuso de storage (arquivos enormes) e tipos perigosos (ex.: SVG servido
// inline de um bucket público). O bucket também reforça isso no servidor (0028).
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const TAMANHO_MAX = 5 * 1024 * 1024; // 5 MB

// extensão do arquivo salvo vem do TIPO validado, não do nome (que o usuário controla)
export function extensaoDaImagem(file: File): string {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[file.type] ?? "jpg";
}

export function validarImagem(file: File): void {
  if (!TIPOS_OK.includes(file.type))
    throw new Error("Formato não suportado. Use JPG, PNG, WEBP ou GIF.");
  if (file.size > TAMANHO_MAX)
    throw new Error("Imagem muito grande. O limite é 5 MB.");
}
