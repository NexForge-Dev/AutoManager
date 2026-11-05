import { createClient } from "@/lib/supabase/client";
import { apagarRascunhos } from "@/lib/rascunho";

// Sair da conta (botão). Recarrega a página de propósito: é o que tira os dados da conta da
// memória. Limpar o store com a tela montada faria a Guard ver um "dono sem onboarding" e
// mandar para /onboarding, e o middleware devolveria o /login em "Crie sua conta".
export async function sairDaConta(destino = "/login?modo=entrar") {
  apagarRascunhos();
  try {
    await createClient().auth.signOut();
  } catch {
    // sem rede: o signOut já apagou a sessão deste navegador
  }
  window.location.assign(destino);
}
