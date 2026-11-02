import { createClient } from "./supabase/client";
import { extensaoDaImagem, validarImagem } from "./imagem";

// Faz upload de uma imagem de produto para o bucket "produtos" na pasta da org
// e devolve a URL pública. O 1º segmento da pasta é o org_id (exigido pelo RLS).
export async function uploadProdutoImagem(orgId: string, file: File): Promise<string> {
  validarImagem(file);
  const supabase = createClient();
  const ext = extensaoDaImagem(file);
  const rand = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  const path = `${orgId}/${rand}.${ext}`;

  const { error } = await supabase.storage.from("produtos").upload(path, file, {
    upsert: false, // nome aleatório: nunca sobrescreve outra foto
    cacheControl: "3600",
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("produtos").getPublicUrl(path);
  return data.publicUrl;
}
