import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import { homeDe } from "@/lib/permissoes";

// Para onde mandar o usuário logo depois de autenticar (login, redefinir senha,
// ou quem abre /login já logado).
export async function destinoPosLogin(): Promise<string> {
  // revendedora (login self-service) vai direto pro painel dela
  const { data: rev } = await createClient().rpc("revendedora_me");
  if (rev) return "/revenda";

  await useStore.getState().hydrate();
  const { config, role } = useStore.getState();
  // dono ainda sem onboarding vai configurar; membros já entram no painel do papel
  if (!config.onboardingCompleto && role === "owner") return "/onboarding";
  return homeDe(role);
}
