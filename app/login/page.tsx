"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { destinoPosLogin } from "@/lib/destinoPosLogin";
import { falhaDeRedeAuth } from "@/lib/cargaLoja";
import { registrarMetrica, registrarSessao } from "@/lib/metricas/cliente";
import { planoValido } from "@/lib/plans";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, ShieldCheck, Smartphone, Timer, Wallet } from "lucide-react";
import EntradaShell, { type ItemEntrada } from "@/components/landing/EntradaShell";
import { Aviso, Segmentado } from "@/components/ui";

const LADO: { titulo: string; itens: ItemEntrada[] } = {
  titulo: "Saiba quanto sua loja vende e quanto sobra, todo dia.",
  itens: [
    { icone: Timer, titulo: "Venda registrada em segundos", texto: "O estoque baixa sozinho" },
    { icone: Wallet, titulo: "Comissão calculada", texto: "Por venda e por revendedora" },
    { icone: Smartphone, titulo: "Feito para o celular", texto: "Adicione à tela inicial e abra como um app" },
    { icone: ShieldCheck, titulo: "Cada loja isolada", texto: "Ninguém de outra loja vê os seus números" },
  ],
};

const MODOS = [
  ["criar", "Criar conta"],
  ["entrar", "Entrar"],
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "criar">("criar");
  // Abre direto em "Entrar" quando vem da landing via /login?modo=entrar
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("modo") === "entrar") {
      setModo("entrar");
    }
    if (q.get("expirada")) setAviso("Sua sessão expirou. Entre de novo para continuar de onde parou.");
    // plano clicado na landing (/login?plano=...): o onboarding já abre com ele marcado
    const plano = q.get("plano");
    if (planoValido(plano)) {
      try {
        sessionStorage.setItem("am_plano_landing", plano);
      } catch {}
    }
  }, []);
  // já logado (conta real, não o anônimo do chat da loja): pula o formulário
  useEffect(() => {
    let ativo = true;
    createClient()
      .auth.getUser()
      .then(async ({ data, error }) => {
        if (!ativo) return;
        // backend fora com sessão guardada: é alguém de volta, não um cadastro novo
        if (falhaDeRedeAuth(error)) {
          setModo("entrar");
          return;
        }
        if (!data.user || data.user.is_anonymous) return;
        // já tem conta: se a leitura falhar abaixo, o formulário abre no "Entrar"
        setModo("entrar");
        const destino = await destinoPosLogin();
        if (ativo) router.replace(destino);
      })
      // sem rede/RPC: só mostra o formulário normalmente
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [router]);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviandoReset, setEnviandoReset] = useState(false);

  async function esqueciSenha() {
    setErro(null);
    setAviso(null);
    if (!email.trim()) {
      setErro("Digite seu e-mail acima para receber o link de redefinição.");
      return;
    }
    setEnviandoReset(true);
    let error: { message: string } | null = null;
    try {
      ({ error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${location.origin}/redefinir-senha`,
      }));
    } catch (e: any) {
      error = { message: String(e?.message || "network") };
    }
    setEnviandoReset(false);
    if (error) {
      setErro(traduzErro(error.message));
      return;
    }
    setAviso("Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha. Confira a caixa de entrada e o spam.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setLoading(true);
    const supabase = createClient();
    const mail = email.trim();

    try {
      let session;
      if (modo === "criar") {
        const { data, error } = await supabase.auth.signUp({
          email: mail,
          password: senha,
          // com confirmação de e-mail ligada no Supabase, o link volta para o "Entrar"
          options: { emailRedirectTo: `${location.origin}/login?modo=entrar` },
        });
        if (error) throw error;
        // com confirmação de e-mail ligada, um e-mail JÁ cadastrado volta sem erro,
        // mas com identities vazio: avisa e leva para o "Entrar" em vez de fingir que criou
        if (data.user && !data.session && data.user.identities?.length === 0) {
          setErro("E-mail já cadastrado. Entre com a sua senha ou use \"Esqueci minha senha\".");
          setModo("entrar");
          setLoading(false);
          return;
        }
        if (data.user) registrarMetrica({ tipo: "cadastro", userId: data.user.id });
        session = data.session;
        if (!session) {
          // conta criada, falta confirmar o e-mail: é um aviso, não um erro
          setAviso("Conta criada! Enviamos um link de confirmação para o seu e-mail (veja também o spam). Depois de confirmar, use \"Entrar\".");
          setModo("entrar");
          setLoading(false);
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password: senha });
        if (error) throw error;
        session = data.session;
      }

      if (!session) {
        setErro("Confirme seu e-mail para entrar (verifique a caixa de entrada).");
        setLoading(false);
        return;
      }

      registrarSessao(session.user.id);
      router.replace(await destinoPosLogin());
    } catch (err: any) {
      setErro(traduzErro(err?.message || "Erro ao autenticar"));
      setLoading(false);
    }
  }

  return (
    <EntradaShell lado={LADO}>
      <h1 className="page-title text-center">{modo === "criar" ? "Crie sua conta grátis" : "Entre na sua conta"}</h1>
      <p className="mt-1 text-center text-sm text-muted">
        {modo === "criar" ? "1º mês grátis, sem cartão." : "Que bom ver você de volta."}
      </p>
      <div className="card mt-5 space-y-4 p-5">
        <Segmentado
          rotulo="Criar conta ou entrar"
          opcoes={MODOS}
          valor={modo}
          onChange={setModo}
          className="flex w-full [&>button]:flex-1"
        />

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="login-email" className="label">E-mail</label>
            <input
              id="login-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="login-senha" className="label">Senha</label>
              {modo === "entrar" && (
                <button
                  type="button"
                  onClick={esqueciSenha}
                  disabled={enviandoReset}
                  className="mb-1 min-h-[44px] text-sm font-medium text-accent hover:underline disabled:opacity-60"
                >
                  {enviandoReset ? "Enviando…" : "Esqueci minha senha"}
                </button>
              )}
            </div>
            <input
              id="login-senha"
              type="password"
              className="input"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={modo === "criar" ? 8 : 6}
              maxLength={72}
              autoComplete={modo === "criar" ? "new-password" : "current-password"}
            />
            {modo === "criar" && <p className="hint">Mínimo de 8 caracteres.</p>}
          </div>
          {modo === "entrar" && (
            <p className="text-xs text-muted">
              Donos, vendedores, entregadores e revendedoras entram aqui: cada um cai direto na sua área.
            </p>
          )}
          {erro && (
            <div role="alert">
              <Aviso tom="bad" icone={AlertCircle}>{erro}</Aviso>
            </div>
          )}
          {aviso && (
            <div role="status">
              <Aviso tom="ok" icone={CheckCircle2}>{aviso}</Aviso>
            </div>
          )}
          <button disabled={loading} className="btn-primary w-full">
            {loading ? (
              <Loader2 className="animate-spin" size={18} aria-hidden />
            ) : modo === "criar" ? (
              "Criar conta grátis"
            ) : (
              "Entrar"
            )}
          </button>
        </form>
      </div>
      <Link href="/acesso" className="btn-ghost mt-3 w-full">
        <KeyRound size={17} aria-hidden /> É vendedora? Acesse aqui
      </Link>
      <p className="mt-4 text-center text-xs text-muted">
        Ao criar a conta você concorda com os{" "}
        <Link href="/termos" className="underline hover:text-strong">Termos de Uso</Link> e a{" "}
        <Link href="/privacidade" className="underline hover:text-strong">Política de Privacidade</Link>.
      </p>
    </EntradaShell>
  );
}

function traduzErro(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/already registered|already exists/i.test(msg)) return "E-mail já cadastrado. Tente entrar.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail para entrar (veja a caixa de entrada e o spam).";
  if (/password should be at least|weak|pwned/i.test(msg))
    return "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.";
  if (/invalid.*email|email.*invalid|unable to validate email/i.test(msg)) return "E-mail inválido.";
  if (/signups? not allowed|signup.*disabled/i.test(msg)) return "Cadastro indisponível no momento. Tente mais tarde.";
  if (/rate limit|too many|security purposes/i.test(msg)) return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  if (/fetch|network/i.test(msg)) return "Sem conexão. Confira a internet e tente de novo.";
  // nunca mostra a mensagem crua (em inglês) do Supabase
  return "Não foi possível concluir agora. Tente de novo.";
}
