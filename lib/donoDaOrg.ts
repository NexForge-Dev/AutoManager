import { createClient as createServer } from "@/lib/supabase/server";

// Dono (owner) logado e a org dele. null = sem sessão ou não é o dono.
// Só o dono assina, troca de plano ou mexe na cobrança.
export async function donoDaOrg(): Promise<{ userId: string; orgId: string; email: string } | null> {
  const sb = createServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: eu } = await sb.from("usuario").select("org_id, role").eq("id", user.id).maybeSingle();
  if (!eu || eu.role !== "owner") return null;
  return { userId: user.id, orgId: eu.org_id as string, email: user.email ?? "" };
}
