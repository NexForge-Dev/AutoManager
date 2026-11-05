"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { lerConviteDoHash } from "@/lib/acessoRevendedora";
import { destinoPosLogin, MOTIVOS_ACESSO, motivoDaUrl } from "@/lib/destinoPosLogin";
import { AlertCircle, CheckCircle2, ClipboardList, Lock, Loader2, Smartphone, Wallet } from "lucide-react";
import EntradaShell, { type ItemEntrada } from "@/components/landing/EntradaShell";
import { Aviso, Segmentado } from "@/components/ui";

const LADO: { titulo: string; itens: ItemEntrada[] } = {
  titulo: "Sua área para vender pelo celular.",
  itens: [
    { icone: Smartphone, titulo: "Catálogo da loja", texto: "Veja os produtos disponíveis" },
    { icone: ClipboardList, titulo: "Suas vendas", texto: "Registre cada venda e acompanhe o histórico" },
    { icone: Wallet, titulo: "Sua comissão", texto: "Calculada a cada venda registrada" },
    { icone: Lock, titulo: "Acesso próprio", texto: "Entre com o seu e-mail e a sua senha" },
  ],
};

const MODOS = [
  ["ativar", "Primeiro acesso"],
  ["entrar", "Entrar"],
] as const;

export default function AcessoPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"ativar" | "entrar">("ativar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [doLink, setDoLink] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // /acesso?motivo=suspenso|sem_loja (destinoPosLogin): conta sem loja ativa.
  // Mostra o motivo e encerra a sessão, para não ficar preso num login sem acesso.
  // Só neste aparelho: quem chega aqui nunca é motivo para derrubar os outros.
  useEffect(() => {
    const motivo = motivoDaUrl(window.location.search);
    if (!motivo) return;
    setModo("entrar");
    setErro(MOTIVOS_ACESSO[motivo]);
    void createClient().auth.signOut({ scope: "local" });
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
      await createClient().auth.signOut({ scope: "local" });
      setErro(MOTIVOS_ACESSO[motivo]);
      setLoading(false);
      return;
    }
    router.replace(destino);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
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
          setErro(typeof data?.erro === "string" && data.erro ? data.erro : "Não foi possível ativar o acesso.");
          setLoading(false);
          return;
        }
        // o código é de uso único: daqui em diante é só "Entrar" (mantém o e-mail).
        // Se o login abaixo falhar, tentar de novo não reenvia o código já usado.
        setModo("entrar");
        setCodigo("");
        setDoLink(false);
      }

      const { error } = await supabase.auth.signInWithPassword({ email: mail, password: senha });
      if (error) {
        if (modo === "ativar") setAviso("Acesso ativado! Agora é só entrar com o e-mail e a senha que você acabou de criar.");
        setErro(traduzErroLogin(error.message));
        setLoading(false);
        return;
      }
      await entrarERedirecionar();
    } catch {
      setErro("Erro inesperado. Confira sua conexão e tente novamente.");
      setLoading(false);
    }
  }

  function trocarModo(m: "ativar" | "entrar") {
    setModo(m);
    setErro(null);
    setAviso(null);
  }

  return (
    <EntradaShell lado={LADO}>
      <h1 className="page-title text-center">Área da Vendedora</h1>
      <p className="mt-1 text-center text-sm text-muted">
        Revendedoras e equipe da loja: acesse o catálogo e registre suas vendas.
      </p>

      <div className="card mt-5 space-y-4 p-5">
        <Segmentado
          rotulo="Primeiro acesso ou entrar"
          opcoes={MODOS}
          valor={modo}
          onChange={trocarModo}
          className="flex w-full [&>button]:flex-1"
        />

        <p className="text-sm text-muted">
          {modo === "ativar"
            ? doLink
              ? "Seu e-mail e código já foram preenchidos pelo link da loja. Só falta criar a sua senha."
              : "Use o e-mail que a loja cadastrou, o código de acesso que ela te enviou e crie a sua senha agora."
            : "Entre com o e-mail e a senha que você criou."}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="acesso-email" className="label">E-mail</label>
            <input id="acesso-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          {modo === "ativar" && (
            <div>
              <label htmlFor="acesso-codigo" className="label">Código de acesso</label>
              <input
                id="acesso-codigo"
                className="input tracking-[0.3em] font-mono uppercase"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                required
                maxLength={6}
                placeholder="ABC123"
                autoCapitalize="characters"
                autoComplete="off"
              />
              <p className="hint">A loja te passa esse código junto com o link de acesso.</p>
            </div>
          )}
          <div>
            <label htmlFor="acesso-senha" className="label">{modo === "ativar" ? "Crie sua senha" : "Senha"}</label>
            <input
              id="acesso-senha"
              type="password"
              className="input"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={modo === "ativar" ? 8 : 6}
              maxLength={72}
              autoComplete={modo === "ativar" ? "new-password" : "current-password"}
            />
          </div>
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
            {loading ? <Loader2 className="animate-spin" size={18} aria-hidden /> : modo === "ativar" ? "Ativar e entrar" : "Entrar"}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        É dono(a) da loja?{" "}
        <Link href="/login?modo=entrar" className="font-semibold text-accent hover:underline">
          Entrar aqui
        </Link>
      </p>
    </EntradaShell>
  );
}

// Erros do signInWithPassword em pt-BR (nunca a mensagem crua em inglês).
function traduzErroLogin(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar.";
  if (/rate limit|too many|security purposes/i.test(msg))
    return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  if (/fetch|network/i.test(msg)) return "Sem conexão. Confira a internet e tente de novo.";
  return "Não foi possível entrar agora. Tente de novo.";
}
