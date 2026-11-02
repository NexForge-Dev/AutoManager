"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { lerConviteDoHash } from "@/lib/acessoRevendedora";
import { destinoPosLogin, MOTIVOS_ACESSO, motivoDaUrl } from "@/lib/destinoPosLogin";
import { Gem, Loader2 } from "lucide-react";

export default function AcessoPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"ativar" | "entrar">("ativar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [doLink, setDoLink] = useState(false);

  // /acesso?motivo=suspenso|sem_loja (destinoPosLogin): conta sem loja ativa.
  // Mostra o motivo e encerra a sessão, para não ficar preso num login sem acesso.
  useEffect(() => {
    const motivo = motivoDaUrl(window.location.search);
    if (!motivo) return;
    setModo("entrar");
    setErro(MOTIVOS_ACESSO[motivo]);
    void createClient().auth.signOut();
  }, []);

  // link enviado pela loja (/acesso#email=…&codigo=…): preenche e limpa a barra de endereço
  useEffect(() => {
    if (!window.location.hash) return;
    const convite = lerConviteDoHash(window.location.hash);
    if (convite.email) setEmail(convite.email);
    if (convite.codigo) setCodigo(convite.codigo);
    if (convite.email || convite.codigo) {
      setModo("ativar");
      setDoLink(Boolean(convite.email && convite.codigo));
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function entrarERedirecionar() {
    // revendedora vai para /revenda; vendedora/entregador/dono que entrou por aqui
    // também é levado para a própria área, em vez de barrado
    const destino = await destinoPosLogin();
    const motivo = destino.startsWith("/acesso") ? motivoDaUrl(destino.slice(destino.indexOf("?"))) : null;
    if (motivo) {
      // já estamos no /acesso: mostra o motivo aqui mesmo e sai da sessão sem acesso
      await createClient().auth.signOut();
      setErro(MOTIVOS_ACESSO[motivo]);
      setLoading(false);
      return;
    }
    router.replace(destino);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    const supabase = createClient();
    const mail = email.trim().toLowerCase();

    try {
      if (modo === "ativar") {
        const res = await fetch("/api/revendedora/ativar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: mail, senha, codigo: codigo.trim().toUpperCase() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErro(data?.erro || "Não foi possível ativar o acesso.");
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase.auth.signInWithPassword({ email: mail, password: senha });
      if (error) {
        setErro(/invalid login/i.test(error.message) ? "E-mail ou senha incorretos." : error.message);
        setLoading(false);
        return;
      }
      await entrarERedirecionar();
    } catch {
      setErro("Erro inesperado. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 bg-[var(--bg)]">
      <div className="w-full max-w-sm reveal">
        <div className="flex items-center justify-center gap-2 font-extrabold text-brand-500 text-xl mb-2">
          <Gem className="text-brand-600" /> Área da Vendedora
        </div>
        <p className="text-center text-sm text-muted mb-6">Revendedoras e equipe da loja: acesse o catálogo e registre suas vendas.</p>

        <div className="card space-y-4">
          <div className="flex rounded-xl surface-alt p-1 text-sm font-semibold">
            <button
              onClick={() => setModo("ativar")}
              className={`flex-1 rounded-lg py-2 transition active:scale-95 ${modo === "ativar" ? "surface shadow" : "text-muted hover:text-strong"}`}
            >
              Primeiro acesso
            </button>
            <button
              onClick={() => setModo("entrar")}
              className={`flex-1 rounded-lg py-2 transition active:scale-95 ${modo === "entrar" ? "surface shadow" : "text-muted hover:text-strong"}`}
            >
              Entrar
            </button>
          </div>

          <p className="text-xs text-muted">
            {modo === "ativar"
              ? doLink
                ? "Seu e-mail e código já foram preenchidos pelo link da loja. Só falta criar a sua senha."
                : "Use o e-mail que a loja cadastrou, o código de acesso que ela te enviou e crie a sua senha agora."
              : "Entre com o e-mail e a senha que você criou."}
          </p>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">E-mail</label>
              <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            {modo === "ativar" && (
              <div>
                <label className="label">Código de acesso</label>
                <input
                  className="input tracking-[0.3em] font-mono uppercase"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  required
                  maxLength={6}
                  placeholder="ABC123"
                  autoCapitalize="characters"
                  autoComplete="off"
                />
                <p className="text-xs text-muted mt-1">A loja te passa esse código junto com o link de acesso.</p>
              </div>
            )}
            <div>
              <label className="label">{modo === "ativar" ? "Crie sua senha" : "Senha"}</label>
              <input
                type="password"
                className="input"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={6}
                autoComplete={modo === "ativar" ? "new-password" : "current-password"}
              />
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
              {loading ? <Loader2 className="animate-spin" size={18} /> : modo === "ativar" ? "Ativar e entrar" : "Entrar"}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-muted mt-4">
          É dono(a) da loja?{" "}
          <Link href="/login?modo=entrar" className="font-semibold text-brand-500 hover:underline">
            Entrar aqui
          </Link>
        </p>
      </div>
    </div>
  );
}
