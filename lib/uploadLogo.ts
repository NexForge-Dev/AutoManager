import { createClient } from "./supabase/client";
import { extensaoDaImagem, validarImagem } from "./imagem";
import { comprimirImagem, LADO_MAX_LOJA } from "./comprimirImagem";

// Faz upload de uma imagem para o bucket "lojas" na pasta da org (nome fixo por
// tipo, com upsert) e devolve a URL pública com cache-buster.
async function uploadImagemLoja(orgId: string, original: File, base: string): Promise<string> {
  const file = await comprimirImagem(original, LADO_MAX_LOJA);
  validarImagem(file);
  const supabase = createClient();
  const ext = extensaoDaImagem(file);
  const path = `${orgId}/${base}.${ext}`;

  const { error } = await supabase.storage.from("lojas").upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type || "image/png",
  });
  if (error) throw error;

  const { data } = supabase.storage.from("lojas").getPublicUrl(path);
  // cache-buster para refletir a troca imediatamente
  return `${data.publicUrl}?v=${Date.now()}`;
}

// Logo da loja (aparece no app, no painel e na vitrine).
export function uploadLogo(orgId: string, file: File): Promise<string> {
  return uploadImagemLoja(orgId, file, "logo");
}

// Imagem de capa/banner da vitrine pública.
export function uploadCapa(orgId: string, file: File): Promise<string> {
  return uploadImagemLoja(orgId, file, "capa");
}
