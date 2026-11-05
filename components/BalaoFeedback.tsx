"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lightbulb, Loader2, MessageSquareText, Send, TriangleAlert, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { FEEDBACK_MAX, ROTULO_FEEDBACK } from "@/lib/feedback";

type Opcao = "sugestao" | "erro";

const OPCOES = [
  { id: "sugestao", icone: Lightbulb, tom: "tone-brand" },
  { id: "erro", icone: TriangleAlert, tom: "tone-bad" },
] as const;

const DICA: Record<Opcao, string> = {
  sugestao: "O que podemos fazer melhor?",
  erro: "O que você estava fazendo e o que deu errado?",
};

// Balão flutuante: painel não modal (a tela atrás segue utilizável), acima da barra
// inferior no celular e abaixo dos modais (z-50). Mantém o rascunho ao fechar.
export default function BalaoFeedback() {
  const path = usePathname();
  const abrirChamado = useStore((s) => s.abrirChamado);

  const [aberto, setAberto] = useState(false);
  const [opcao, setOpcao] = useState<Opcao | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const painelRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  function fechar() {
    setAberto(false);
    botaoRef.current?.focus({ preventScroll: true });
    if (enviado) {
      setEnviado(false);
      setOpcao(null);
    }
  }
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;

  useEffect(() => {
    setAberto(false);
  }, [path]);

  // cada etapa foca o próprio primeiro controle
  useEffect(() => {
    if (aberto) painelRef.current?.querySelector<HTMLElement>("[data-foco]")?.focus({ preventScroll: true });
  }, [aberto, opcao, enviado]);

  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) {
      // um modal por cima cuida do próprio Esc
      if (e.key === "Escape" && !document.querySelector(".modal-backdrop")) fecharRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!opcao || enviando) return;
    setErro(null);
    if (!mensagem.trim()) {
      setErro("Escreva sua mensagem.");
      return;
    }
    setEnviando(true);
    const r = await abrirChamado({ tipo: opcao, mensagem });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro || "Não foi possível enviar. Tente de novo.");
      return;
    }
    setMensagem("");
    setEnviado(true);
  }

  return (
    <div className="print-hidden">
      {aberto && (
        <div
          ref={painelRef}
          id="balao-feedback"
          role="dialog"
          aria-labelledby="balao-feedback-titulo"
          className="modal-panel fixed z-40 right-4 md:right-6 bottom-[calc(8rem+env(safe-area-inset-bottom))] md:bottom-20 w-[min(22rem,calc(100vw-2rem))] max-h-[calc(100dvh-13rem)] md:max-h-[calc(100dvh-7rem)] overflow-auto overscroll-contain surface border border-default rounded-2xl shadow-pop p-4 space-y-3"
        >
          <div className="flex items-center gap-1 -mt-1 -mr-1.5">
            {opcao && !enviado && (
              <button
                type="button"
                onClick={() => {
                  setOpcao(null);
                  setErro(null);
                }}
                aria-label="Voltar às opções"
                className="icon-btn -ml-2.5"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
            )}
            <h2 id="balao-feedback-titulo" className="flex-1 min-w-0 font-bold">
              {opcao ? ROTULO_FEEDBACK[opcao] : "Fale com a gente"}
            </h2>
            <button type="button" onClick={fechar} aria-label="Fechar" className="icon-btn">
              <X size={18} aria-hidden />
            </button>
          </div>

          {enviado ? (
            <div role="status" className="py-2 text-center space-y-3">
              <span className="mx-auto grid place-items-center h-11 w-11 rounded-xl tone-ok" aria-hidden>
                <CheckCircle2 size={22} />
              </span>
              <p className="text-sm">Mensagem enviada. Obrigado!</p>
              <button type="button" data-foco onClick={fechar} className="btn-ghost w-full">
                Fechar
              </button>
            </div>
          ) : opcao ? (
            <form onSubmit={enviar} className="space-y-2">
              <label className="sr-only" htmlFor="balao-feedback-mensagem">
                Sua mensagem
              </label>
              <textarea
                id="balao-feedback-mensagem"
                data-foco
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder={DICA[opcao]}
                className="input min-h-[110px] resize-y"
                maxLength={FEEDBACK_MAX}
                aria-describedby="balao-feedback-contador"
              />
              <p id="balao-feedback-contador" className="text-xs text-muted text-right tnum">
                {mensagem.length}/{FEEDBACK_MAX}
              </p>
              <p className="text-xs text-muted">
                Não escreva dados pessoais. Uma cópia vai, sem sua identificação, para nosso painel interno.{" "}
                <Link href="/privacidade" target="_blank" className="underline underline-offset-2 hover:text-strong">
                  Saiba mais
                </Link>
              </p>
              {erro && (
                <p className="text-sm text-bad" role="alert">
                  {erro}
                </p>
              )}
              <button type="submit" disabled={enviando} className="btn-primary w-full">
                {enviando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </form>
          ) : (
            <div className="card-list">
              {OPCOES.map(({ id, icone: Icone, tom }, i) => (
                <button
                  key={id}
                  type="button"
                  data-foco={i === 0 ? true : undefined}
                  onClick={() => setOpcao(id)}
                  className="row min-h-[48px] font-medium focus-visible:-outline-offset-2"
                >
                  <span className={`grid place-items-center h-8 w-8 shrink-0 rounded-lg ${tom}`} aria-hidden>
                    <Icone size={17} />
                  </span>
                  {ROTULO_FEEDBACK[id]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        ref={botaoRef}
        type="button"
        onClick={() => (aberto ? fechar() : setAberto(true))}
        aria-label={aberto ? "Fechar feedback" : "Enviar sugestão ou reportar um problema"}
        aria-expanded={aberto}
        aria-controls={aberto ? "balao-feedback" : undefined}
        className="fixed z-40 right-4 md:right-6 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 grid place-items-center h-11 w-11 rounded-full surface border border-default text-accent shadow-pop hover:bg-[var(--hover)] active:scale-95 transition"
      >
        {aberto ? <X size={20} aria-hidden /> : <MessageSquareText size={20} aria-hidden />}
      </button>
    </div>
  );
}
