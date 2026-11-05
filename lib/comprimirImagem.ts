// Foto de celular (3 a 12 MB) não vai inteira para a vitrine: no navegador, antes do
// upload, reduz o lado maior e recomprime. Falhou por qualquer motivo: segue com o
// original (a validação de tamanho decide se ele passa).

export const LADO_MAX_PRODUTO = 1200;
export const LADO_MAX_LOJA = 1600;
const QUALIDADE = 0.82;
const JA_LEVE = 300 * 1024; // abaixo disso e dentro do lado máximo, não mexe
const TIPOS_RECOMPRIMIR = ["image/jpeg", "image/png", "image/webp"];

/** Tamanho final mantendo a proporção; nunca amplia. */
export function dimensoesAlvo(largura: number, altura: number, ladoMax: number) {
  const maior = Math.max(largura, altura);
  if (maior <= ladoMax) return { largura, altura };
  const f = ladoMax / maior;
  return { largura: Math.round(largura * f), altura: Math.round(altura * f) };
}

export async function comprimirImagem(file: File, ladoMax = LADO_MAX_PRODUTO): Promise<File> {
  // GIF perderia a animação; outros tipos a validação recusa em seguida
  if (!TIPOS_RECOMPRIMIR.includes(file.type) || typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const alvo = dimensoesAlvo(bitmap.width, bitmap.height, ladoMax);
    const mesmoTamanho = alvo.largura === bitmap.width;
    if (mesmoTamanho && file.size <= JA_LEVE) return file;

    const canvas = document.createElement("canvas");
    canvas.width = alvo.largura;
    canvas.height = alvo.altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, alvo.largura, alvo.altura);
    const codificar = (tipo: string) =>
      new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, QUALIDADE));
    // webp preserva transparência. Navegador que não codifica webp (Safari) devolve png:
    // confere o tipo e cai para jpeg, sobre fundo branco (jpeg não tem transparência)
    let blob = await codificar("image/webp");
    let tipo = "image/webp";
    if (blob?.type !== tipo) {
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, alvo.largura, alvo.altura);
      tipo = "image/jpeg";
      blob = await codificar(tipo);
    }
    if (!blob || blob.type !== tipo || blob.size >= file.size) return file;
    const nome = file.name.replace(/\.[^.]+$/, "") + (tipo === "image/webp" ? ".webp" : ".jpg");
    return new File([blob], nome, { type: tipo });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
