"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Gem, KeyRound, Loader2 } from "lucide-react";

type Estado = "verificando" | "pronto" | "invalido" | "salvo";

// Destino do link "Esqueci minha senha" (supabase.auth.resetPasswordForEmail).
// Aceita os dois formatos de retorno do Supabase:
//  - PKCE: /redefinir-senha?code=... (troca o code por sessão)
//  - implícito: /redefinir-senha#access_token=...&type=recovery (o client detecta sozinho)
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [motivo, setMotivo] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let ativo = true;
    const pronto = () => ativo && setEstado("pronto");

    const { data: sub } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "PASSWORD_RECOVERY" || (sessao && (evento === "SIGNED_IN" || evento === "INITIAL_SESSION"))) {
        pronto();
      }
    });

    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const erroUrl = url.searchParams.get("error_description") || hash.get("error_description");
      if (erroUrl) {
        if (ativo) {
          setMotivo(erroUrl);
          setEstado("invalido");
        }
        return;
      }

      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        // o client pode já ter trocado o code sozinho (detectSessionInUrl); nesse caso
        // a troca manual falha, mas a sessão existe - conferimos abaixo.
        if (!error) {
          url.searchParams.delete("code");
          window.history.replaceState(null, "", url.pathname + url.search);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        pronto();
        return;
      }
      // dá um tempo para o client processar tokens no hash antes de desistir
      setTimeout(async () => {
        if (!ativo) return;
        const { data: d2 } = await supabase.auth.getSession();
        if (!ativo) return;
        setEstado((atual) => (atual === "verificando" ? (d2.session ? "pronto" : "invalido") : atual));
      }, 2500);
    })();

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) {
      setErro("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas não conferem.");
      return;
    }
    setSalvando(true);
    const { error } = await createClient().auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      setErro(
        /different from the old|same.*password/i.test(error.message)
          ? "A nova senha precisa ser diferente da anterior."
          : /session|jwt|expired/i.test(error.message)
            ? "O link expirou. Peça um novo na tela de login."
            : error.message
      );
      return;
    }
    setEstado("salvo");
    setTimeout(() => router.replace("/painel"), 1500);
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 bg-[var(--bg)]">
      <div className="w-full max-w-sm reveal">
        <Link href="/" className="flex items-center justify-center gap-2 font-extrabold text-brand-500 text-xl mb-6">
          <Gem className="text-brand-600" /> AutoManager
        </Link>
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="text-brand-600" size={20} />
            <h1 className="text-lg font-bold">Criar nova senha</h1>
          </div>

          {estado === "verificando" && (
            <p className="flex items-center gap-2 text-sm text-muted" role="status">
              <Loader2 className="animate-spin" size={16} /> Validando o link…
            </p>
          )}

          {estado === "invalido" && (
            <div className="space-y-3">
              <p className="text-sm text-muted" role="alert">
                Este link de redefinição é inválido ou já expirou
                {motivo ? ` (${motivo})` : ""}. Peça um novo link na tela de login.
              </p>
              <Link href="/login?modo=entrar" className="btn-primary w-full">
                Voltar ao login
              </Link>
            </div>
          )}

          {estado === "salvo" && (
            <p className="flex items-center gap-2 text-sm text-green-600" role="status">
              <CheckCircle2 size={18} /> Senha alterada! Entrando no painel…
            </p>
          )}

          {estado === "pronto" && (
            <form onSubmit={salvar} className="space-y-3">
              <div>
                <label htmlFor="nova-senha" className="label">Nova senha</label>
                <input
                  id="nova-senha"
                  type="password"
                  className="input"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
                />
                <p className="mt-1 text-xs text-muted">Mínimo de 8 caracteres.</p>
              </div>
              <div>
                <label htmlFor="confirma-senha" className="label">Confirme a nova senha</label>
                <input
                  id="confirma-senha"
                  type="password"
                  className="input"
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
              <button disabled={salvando} className="btn-primary w-full disabled:opacity-60">
                {salvando ? <Loader2 className="animate-spin" size={18} /> : "Salvar nova senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
