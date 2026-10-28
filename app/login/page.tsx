"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import { homeDe } from "@/lib/permissoes";
import { Gem, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const hydrate = useStore((s) => s.hydrate);
  const [modo, setModo] = useState<"entrar" | "criar">("criar");
  // Abre direto em "Entrar" quando vem da landing via /login?modo=entrar
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("modo") === "entrar") {
      setModo("entrar");
    }
  }, []);
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
        const { data, error } = await supabase.auth.signUp({ email, password: senha });
        if (error) throw error;
        session = data.session;
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

      // revendedora (login self-service) vai direto pro painel dela
      const { data: rev } = await supabase.rpc("revendedora_me");
      if (rev) {
        router.replace("/revenda");
        return;
      }

      await hydrate();
      const { config, role } = useStore.getState();
      // dono ainda sem onboarding vai configurar; membros já entram no painel do papel
      if (!config.onboardingCompleto && role === "owner") {
        router.replace("/onboarding");
      } else {
        router.replace(homeDe(role));
      }
    } catch (err: any) {
      setErro(traduzErro(err?.message || "Erro ao autenticar"));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 bg-[var(--bg)]">
      <div className="w-full max-w-sm reveal">
        <div className="flex items-center justify-center gap-2 font-extrabold text-brand-500 text-xl mb-6">
          <Gem className="text-brand-600" /> AutoManager
        </div>
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
