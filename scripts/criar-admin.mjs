// Cria (ou promove) a conta SUPERADMIN do AutoManager.
//
// O super-admin é quem tem app_metadata.role = 'superadmin' no Supabase Auth
// (só a service_role grava app_metadata; o RLS lê o claim em private.eh_admin()).
//
// Uso:
//   node scripts/criar-admin.mjs --email voce@dominio.com --senha "uma-senha-bem-forte"
//   # ou via ambiente:
//   ADMIN_EMAIL=voce@dominio.com ADMIN_SENHA="..." node scripts/criar-admin.mjs
//
// - Sem senha padrão: e-mail e senha são obrigatórios; senha com no mínimo 12 caracteres.
// - Se a conta já existe: redefine a senha informada e marca role=superadmin.
// - Depois de promovida, a pessoa precisa sair e entrar de novo (JWT novo com o claim).
// Requer .env.local (ou ambiente) com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SENHA_MIN = 12;

// carrega .env.local sem dependências externas
function carregarEnv() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const linha of txt.split("\n")) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // sem .env.local: confia nas variáveis já exportadas no ambiente
  }
}

// lê --email x / --email=x / --senha x / --senha=x
function lerArg(nome) {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === `--${nome}`) return args[i + 1];
    if (a.startsWith(`--${nome}=`)) return a.slice(nome.length + 3);
  }
  return undefined;
}

carregarEnv();

const EMAIL = (lerArg("email") || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const SENHA = lerArg("senha") || process.env.ADMIN_SENHA || "";

if (!EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(EMAIL)) {
  console.error('Informe o e-mail: --email voce@dominio.com (ou ADMIN_EMAIL).');
  process.exit(1);
}
if (SENHA.length < SENHA_MIN) {
  console.error(`Informe uma senha com pelo menos ${SENHA_MIN} caracteres: --senha "..." (ou ADMIN_SENHA).`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Faltam variáveis. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local."
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: SENHA,
  email_confirm: true,
  app_metadata: { role: "superadmin" },
});

if (!error) {
  console.log(`Conta superadmin criada: ${EMAIL}`);
  console.log(`   user id: ${data.user.id}`);
  process.exit(0);
}

// já existe? então promove e redefine a senha informada
if (/already|exists|registered|duplicate/i.test(error.message)) {
  let u = null;
  for (let page = 1; page <= 50 && !u; page++) {
    const { data: lista, error: eList } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (eList) {
      console.error("Falha ao listar usuários:", eList.message);
      process.exit(1);
    }
    u = lista?.users?.find((x) => x.email?.toLowerCase() === EMAIL) ?? null;
    if (!lista?.users?.length || lista.users.length < 200) break;
  }
  if (!u) {
    console.error("Conta já existe mas não consegui localizá-la para promover.");
    process.exit(1);
  }
  const { error: upErr } = await admin.auth.admin.updateUserById(u.id, {
    password: SENHA,
    email_confirm: true,
    app_metadata: { ...(u.app_metadata ?? {}), role: "superadmin" },
  });
  if (upErr) {
    console.error("Falha ao promover a conta:", upErr.message);
    process.exit(1);
  }
  console.log(`Conta ${EMAIL} já existia - promovida a superadmin e senha redefinida.`);
  process.exit(0);
}

console.error("Erro ao criar admin:", error.message);
process.exit(1);
