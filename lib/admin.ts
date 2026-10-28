// Configuração do suporte / superadmin do AutoManager.
//
// SUPERADMIN: quem tem app_metadata.role = 'superadmin' no Supabase Auth.
//   O app_metadata só pode ser gravado pela service_role (o usuário não altera),
//   e vira o claim `app_metadata.role` do JWT que o RLS lê em private.eh_admin()
//   (supabase/migrations/0035). Crie/promova com:
//     node scripts/criar-admin.mjs --email voce@dominio.com --senha "<senha forte>"
//   Depois de promovido, a pessoa precisa sair e entrar de novo (JWT novo).
export const SUPERADMIN_ROLE = "superadmin";

// WhatsApp de suporte (formato wa.me, só dígitos com DDI).
export const SUPORTE_WHATSAPP = "5583993826429";
export const SUPORTE_WHATSAPP_LABEL = "+55 83 99382-6429";

type UsuarioAuth = { app_metadata?: Record<string, unknown> | null } | null | undefined;

// Checagem REAL (servidor): pelo app_metadata do usuário autenticado.
export function ehSuperadminUser(user: UsuarioAuth): boolean {
  return !!user && user.app_metadata?.role === SUPERADMIN_ROLE;
}

export function linkWhatsappSuporte(texto?: string): string {
  const base = `https://wa.me/${SUPORTE_WHATSAPP}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
