"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

// Diálogos do design system (confirmar / prompt / alerta) substituindo os
// confirm()/prompt()/alert() nativos — com backdrop blur, animação e teclado.

type ConfirmOpts = {
  titulo: string;
  mensagem?: string;
  confirmar?: string;
  cancelar?: string;
  perigo?: boolean;
};
type PromptOpts = {
  titulo: string;
  mensagem?: string;
  valorInicial?: string;
  placeholder?: string;
  confirmar?: string;
  tipo?: "text" | "number" | "email";
  inputMode?: "text" | "decimal" | "numeric" | "email" | "tel";
};
type AlertaOpts = { titulo: string; mensagem?: string; ok?: string };

type Estado =
  | { tipo: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { tipo: "prompt"; opts: PromptOpts; resolve: (v: string | null) => void }
  | { tipo: "alerta"; opts: AlertaOpts; resolve: () => void };

type Ctx = {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
  alerta: (o: AlertaOpts) => Promise<void>;
};

const DialogCtx = createContext<Ctx | null>(null);

function resolverCancelado(e: Estado) {
  if (e.tipo === "confirm") e.resolve(false);
  else if (e.tipo === "prompt") e.resolve(null);
  else e.resolve();
}

export function useDialog(): Ctx {
  const ctx = useContext(DialogCtx);
  if (!ctx) throw new Error("useDialog precisa do <DialogProvider>");
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [valor, setValor] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // diálogo aberto agora (ref: os callbacks abaixo são estáveis e não veem o state)
  const atualRef = useRef<Estado | null>(null);

  // Um diálogo novo substitui o aberto: antes, a promise do anterior é resolvida
  // como "cancelado" (false / null), senão quem chamou ficaria esperando para sempre.
  const abrir = useCallback((novo: Estado) => {
    const anterior = atualRef.current;
    if (anterior) resolverCancelado(anterior);
    atualRef.current = novo;
    setEstado(novo);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOpts) => new Promise<boolean>((resolve) => abrir({ tipo: "confirm", opts, resolve })),
    [abrir]
  );
  const prompt = useCallback(
    (opts: PromptOpts) =>
      new Promise<string | null>((resolve) => {
        setValor(opts.valorInicial ?? "");
        abrir({ tipo: "prompt", opts, resolve });
      }),
    [abrir]
  );
  const alerta = useCallback(
    (opts: AlertaOpts) => new Promise<void>((resolve) => abrir({ tipo: "alerta", opts, resolve })),
    [abrir]
  );

  function fechar(resultado: boolean | string | null) {
    if (!estado) return;
    if (estado.tipo === "confirm") estado.resolve(resultado === true);
    else if (estado.tipo === "prompt") estado.resolve(resultado === false ? null : (resultado as string | null));
    else estado.resolve();
    if (atualRef.current === estado) atualRef.current = null;
    setEstado(null);
  }

  // Foco inicial: input no prompt; senão "Cancelar" em ações perigosas e o botão
  // principal nas demais. Esc cancela. Enter: num botão, deixa o clique nativo
  // acontecer (Enter em "Cancelar" cancela!); no input do prompt, confirma.
  const confirmarRef = useRef<HTMLButtonElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!estado) return;
    const anterior = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      if (estado.tipo === "prompt") inputRef.current?.focus();
      else if (estado.tipo === "confirm" && estado.opts.perigo) cancelarRef.current?.focus();
      else confirmarRef.current?.focus();
    }, 30);
    return () => {
      clearTimeout(t);
      if (anterior && document.contains(anterior)) anterior.focus({ preventScroll: true });
    };
  }, [estado]);

  useEffect(() => {
    if (!estado) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        fechar(estado!.tipo === "prompt" ? null : false);
        return;
      }
      if (e.key !== "Enter") return;
      const alvo = e.target as HTMLElement | null;
      if (estado!.tipo === "prompt") {
        if (alvo === inputRef.current) {
          e.preventDefault();
          fechar(valor);
        }
        return;
      }
      // foco num botão/link: o Enter nativo já clica nele
      if (alvo && alvo.closest("button,a,[role=button]")) return;
      if (estado!.tipo === "confirm" && !(alvo instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        fechar(true);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, valor]);

  return (
    <DialogCtx.Provider value={{ confirm, prompt, alerta }}>
      {children}
      {estado && (
        <div
          className="modal-backdrop fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => fechar(estado.tipo === "prompt" ? null : false)}
          data-dialog-ativo=""
        >
          <div
            role={estado.tipo === "confirm" ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby="am-dialog-titulo"
            className="sheet-panel sm:modal-panel surface shadow-pop w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-[calc(var(--r-card)+0.5rem)] sm:rounded-[var(--r-card)] border border-default p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {estado.tipo !== "prompt" && (estado as any).opts.perigo && (
                <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl tone-bad" aria-hidden>
                  <AlertTriangle size={20} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 id="am-dialog-titulo" className="font-bold text-lg leading-tight">{estado.opts.titulo}</h2>
                {estado.opts.mensagem && (
                  <p className="text-sm text-muted mt-1 whitespace-pre-line">{estado.opts.mensagem}</p>
                )}
              </div>
              <button
                onClick={() => fechar(estado.tipo === "prompt" ? null : false)}
                aria-label="Fechar"
                className="icon-btn -mr-2 -mt-2"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {estado.tipo === "prompt" && (
              <input
                ref={inputRef}
                className="input"
                aria-labelledby="am-dialog-titulo"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={estado.opts.placeholder}
                type={estado.opts.tipo ?? "text"}
                inputMode={estado.opts.inputMode}
              />
            )}

            <div className="flex gap-2 pt-1">
              {estado.tipo !== "alerta" && (
                <button
                  ref={cancelarRef}
                  type="button"
                  onClick={() => fechar(estado.tipo === "prompt" ? null : false)}
                  className="btn-ghost flex-1"
                >
                  {(estado.opts as ConfirmOpts).cancelar ?? "Cancelar"}
                </button>
              )}
              <button
                ref={confirmarRef}
                type="button"
                onClick={() => fechar(estado.tipo === "prompt" ? valor : estado.tipo === "alerta" ? null : true)}
                className={`flex-1 btn ${
                  estado.tipo !== "prompt" && (estado as any).opts.perigo
                    ? "bg-red-600 text-white hover:bg-red-700 px-4 min-h-[44px] py-2.5"
                    : "btn-primary"
                }`}
              >
                {estado.tipo === "alerta"
                  ? (estado.opts as AlertaOpts).ok ?? "Entendi"
                  : (estado.opts as ConfirmOpts).confirmar ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogCtx.Provider>
  );
}
