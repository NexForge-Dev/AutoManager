"use client";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { destinoPosLogin } from "@/lib/destinoPosLogin";
import { CheckCircle2, Gem, KeyRound, Loader2 } from "lucide-react";

type Estado = "verificando" | "pronto" | "invalido" | "salvo";

// Destino do link "Esqueci minha senha" (supabase.auth.resetPasswordForEmail).
// Aceita os dois formatos de retorno do Supabase:
//  - PKCE: /redefinir-senha?code=... (troca o code por sessão)
//  - implícito: /redefinir-senha#access_token=...&type=recovery (o client detecta sozinho)
//  - template com token_hash: /redefinir-senha?token_hash=...&type=recovery (verifyOtp)
// Só libera o formulário com o evento PASSWORD_RECOVERY (ou o verifyOtp de recovery).

// O link é de uso único: no StrictMode (dev) o efeito roda 2x e a 2ª troca
// falharia. Guarda a promessa da 1ª troca por link e reaproveita.
const trocasDoLink = new Map<string, Promise<any>>();
function umaVez<T>(chave: string, fn: () => Promise<T>): Promise<T> {
  if (!trocasDoLink.has(chave)) trocasDoLink.set(chave, fn());
  return trocasDoLink.get(chave) as Promise<T>;
}
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [motivo, setMotivo] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // id do usuário da sessão de RECUPERAÇÃO (evento PASSWORD_RECOVERY / troca do
  // link). Qualquer outra sessão — o anônimo do chat da loja ou outra conta já
  // logada neste navegador — NÃO libera a troca de senha.
  const recuperacao = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let ativo = true;
    const liberar = (sessao: Session | null) => {
      if (!ativo || !sessao?.user || sessao.user.is_anonymous) return;
      recuperacao.current = sessao.user.id;
      setEstado("pronto");
    };
    const invalidar = (m: string | null) => {
      if (!ativo) return;
      recuperacao.current = null;
      setMotivo(m);
      setEstado("invalido");
    };

    const { data: sub } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "PASSWORD_RECOVERY") liberar(sessao);
      else if (evento === "SIGNED_OUT" && ativo) {
        recuperacao.current = null;
        setEstado((atual) => (atual === "pronto" ? "invalido" : atual));
      }
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const erroUrl = url.searchParams.get("error_description") || hash.get("error_description");
      if (erroUrl) {
        invalidar(motivoLink(erroUrl));
        return;
      }

      // template de e-mail com token_hash: funciona mesmo abrindo o link em outro
      // aparelho (o PKCE "code" só troca no navegador que pediu a redefinição)
      const tokenHash = url.searchParams.get("token_hash");
      const tipo = url.searchParams.get("type");
      const code = url.searchParams.get("code");
      if (tokenHash) {
        if (tipo && tipo !== "recovery") {
          invalidar(null);
          return;
        }
        const { data, error } = await umaVez(`otp:${tokenHash}`, () =>
          supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
        );
        url.searchParams.delete("token_hash");
        url.searchParams.delete("type");
        window.history.replaceState(null, "", url.pathname + url.search);
        if (error) {
          invalidar(motivoLink(error.message));
          return;
        }
        liberar(data.session);
      } else if (code) {
        // o client pode já ter trocado o code sozinho (detectSessionInUrl) e
        // disparado PASSWORD_RECOVERY; nesse caso a troca manual falha e quem
        // libera é o evento acima. Uma sessão qualquer já existente não conta.
        // A troca manual bem-sucedida de um code de recuperação também dispara
        // PASSWORD_RECOVERY (é o evento que libera, não o retorno da troca).
        await umaVez(`code:${code}`, () => supabase.auth.exchangeCodeForSession(code));
        url.searchParams.delete("code");
        window.history.replaceState(null, "", url.pathname + url.search);
      }

      // dá um tempo para o client processar o link (code/hash) antes de desistir
      timer = setTimeout(() => {
        if (!ativo) return;
        setEstado((atual) => (atual === "verificando" ? "invalido" : atual));
      }, 3000);
    })().catch(() => invalidar(null));

    return () => {
      ativo = false;
      if (timer) clearTimeout(timer);
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
    if (senha.length > 72) {
      setErro("A nova senha pode ter no máximo 72 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas não conferem.");
      return;
    }
    setSalvando(true);
    const supabase = createClient();
    try {
      // a sessão atual ainda tem que ser a da recuperação (não trocou de conta no meio)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || user.is_anonymous || user.id !== recuperacao.current) {
        setSalvando(false);
        recuperacao.current = null;
        setMotivo(null);
        setEstado("invalido");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        setSalvando(false);
        setErro(traduzErroSenha(error.message));
        return;
      }
    } catch {
      setSalvando(false);
      setErro("Sem conexão. Confira a internet e tente de novo.");
      return;
    }
    setSalvando(false);
    setEstado("salvo");
    let destino = "/login?modo=entrar";
    try {
      destino = await destinoPosLogin();
    } catch {
      // sem rede/RPC: o /login (já logado) decide o destino de novo
    }
    setTimeout(() => router.replace(destino), 1500);
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
                {motivo ?? "Este link de redefinição é inválido ou já expirou."} Peça um novo link na tela de login
                (&quot;Esqueci minha senha&quot;).
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

const LINK_EXPIRADO = "Este link de redefinição é inválido ou já expirou.";

// Motivo legível (pt-BR) para um link de recuperação recusado pelo Supabase.
function motivoLink(msg: string): string {
  if (/rate limit|too many|security purposes/i.test(msg))
    return "Muitas tentativas seguidas. Aguarde um minuto antes de tentar de novo.";
  return LINK_EXPIRADO;
}

// Erros do updateUser({ password }) traduzidos; nunca mostra a mensagem crua em inglês.
function traduzErroSenha(msg: string): string {
  if (/different from the old|same.*password|same_password/i.test(msg))
    return "A nova senha precisa ser diferente da anterior.";
  if (/weak|pwned|password should|at least|characters/i.test(msg))
    return "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.";
  if (/rate limit|too many|security purposes/i.test(msg))
    return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  if (/session|jwt|expired|invalid|token|reauthenticat/i.test(msg))
    return "O link expirou. Peça um novo na tela de login.";
  if (/fetch|network/i.test(msg)) return "Sem conexão. Confira a internet e tente de novo.";
  return "Não foi possível salvar a nova senha. Tente de novo.";
}
