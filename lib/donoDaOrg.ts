import { createClient as createServer } from "@/lib/supabase/server";

// Dono (owner) logado e a org dele. null = sem sessão, não é o dono, ou a loja está
// suspensa/banida pelo suporte (org.acesso <> 'ativo'): as rotas de servidor usam a
// service_role, então precisam barrar a loja suspensa aqui (o JWT antigo continua
// válido até expirar). Só o dono assina, troca de plano, mexe na cobrança e na equipe.
export async function donoDaOrg(): Promise<{ userId: string; orgId: string; email: string } | null> {
  const sb = await createServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: eu } = await sb.from("usuario").select("org_id, role").eq("id", user.id).maybeSingle();
  if (!eu || eu.role !== "owner") return null;
  // RLS de org (current_org_id, 0041) já esconde a loja que não está 'ativo'
  const { data: org } = await sb.from("org").select("id, acesso").eq("id", eu.org_id).maybeSingle();
  if (!org || (org.acesso && org.acesso !== "ativo")) return null;
  return { userId: user.id, orgId: eu.org_id as string, email: user.email ?? "" };
}
