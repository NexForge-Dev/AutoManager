"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { destinoPosLogin } from "@/lib/destinoPosLogin";
import { registrarMetrica } from "@/lib/metricas/cliente";
import { Gem, Loader2, KeyRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "criar">("criar");
  // Abre direto em "Entrar" quando vem da landing via /login?modo=entrar
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("modo") === "entrar") {
      setModo("entrar");
    }
    // plano clicado na landing (/login?plano=...): o onboarding já abre com ele marcado
    const plano = q.get("plano");
    if (plano) {
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
      .then(async ({ data }) => {
        if (!ativo || !data.user || data.user.is_anonymous) return;
        const destino = await destinoPosLogin();
        if (ativo) router.replace(destino);
      });
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
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/redefinir-senha`,
    });
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

    try {
      let session;
      if (modo === "criar") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          // com confirmação de e-mail ligada no Supabase, o link volta para o "Entrar"
          options: { emailRedirectTo: `${location.origin}/login?modo=entrar` },
        });
        if (error) throw error;
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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        session = data.session;
      }

      if (!session) {
        setErro("Confirme seu e-mail para entrar (verifique a caixa de entrada).");
        setLoading(false);
        return;
      }

      registrarMetrica({ tipo: "sessao" });
      router.replace(await destinoPosLogin());
    } catch (err: any) {
      setErro(traduzErro(err?.message || "Erro ao autenticar"));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 bg-[var(--bg)]">
      <div className="w-full max-w-sm reveal">
        <Link href="/" className="flex items-center justify-center gap-2 font-extrabold text-brand-500 text-xl mb-6">
          <Gem className="text-brand-600" /> AutoManager
        </Link>
        <h1 className="sr-only">Entrar no AutoManager</h1>
        <div className="card space-y-4">
          <div className="flex rounded-xl surface-alt p-1 text-sm font-semibold">
            <button
              type="button"
              aria-pressed={modo === "criar"}
              onClick={() => setModo("criar")}
              className={`flex-1 rounded-lg py-2 transition active:scale-95 ${modo === "criar" ? "surface shadow" : "text-muted hover:text-strong"}`}
            >
              Criar conta
            </button>
            <button
              type="button"
              aria-pressed={modo === "entrar"}
              onClick={() => setModo("entrar")}
              className={`flex-1 rounded-lg py-2 transition active:scale-95 ${modo === "entrar" ? "surface shadow" : "text-muted hover:text-strong"}`}
            >
              Entrar
            </button>
          </div>

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
              <div className="flex items-center justify-between">
                <label htmlFor="login-senha" className="label">Senha</label>
                {modo === "entrar" && (
                  <button
                    type="button"
                    onClick={esqueciSenha}
                    disabled={enviandoReset}
                    className="mb-1 text-xs font-medium text-brand-500 hover:underline disabled:opacity-60"
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
                minLength={6}
                autoComplete={modo === "criar" ? "new-password" : "current-password"}
              />
            </div>
            {modo === "entrar" && (
              <p className="text-xs text-muted">
                Donos, vendedores, entregadores e revendedoras entram aqui — cada um cai direto na sua área.
              </p>
            )}
            {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
            {aviso && <p role="status" className="text-sm text-green-600">{aviso}</p>}
            <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : modo === "criar" ? (
                "Criar conta grátis"
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>
        <Link
          href="/acesso"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand-500/40 bg-brand-500/10 px-4 py-3.5 text-base font-semibold text-brand-600 transition hover:border-brand-500 hover:bg-brand-500/15 active:scale-[.98]"
        >
          <KeyRound size={18} /> É vendedora? Acesse aqui
        </Link>
        <p className="text-center text-xs text-muted mt-4">
          Ao criar a conta você concorda com os{" "}
          <Link href="/termos" className="underline hover:text-strong">Termos de Uso</Link> e a{" "}
          <Link href="/privacidade" className="underline hover:text-strong">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  );
}

function traduzErro(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/already registered|already exists/i.test(msg)) return "E-mail já cadastrado. Tente entrar.";
  if (/password should be at least/i.test(msg)) return "A senha precisa de pelo menos 6 caracteres.";
  if (/rate limit|too many|security purposes/i.test(msg)) return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  return msg;
}
