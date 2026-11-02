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

export function useDialog(): Ctx {
  const ctx = useContext(DialogCtx);
  if (!ctx) throw new Error("useDialog precisa do <DialogProvider>");
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [valor, setValor] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => setEstado({ tipo: "confirm", opts, resolve })),
    []
  );
  const prompt = useCallback(
    (opts: PromptOpts) =>
      new Promise<string | null>((resolve) => {
        setValor(opts.valorInicial ?? "");
        setEstado({ tipo: "prompt", opts, resolve });
      }),
    []
  );
  const alerta = useCallback(
    (opts: AlertaOpts) => new Promise<void>((resolve) => setEstado({ tipo: "alerta", opts, resolve })),
    []
  );

  function fechar(resultado: boolean | string | null) {
    if (!estado) return;
    if (estado.tipo === "confirm") estado.resolve(resultado === true);
    else if (estado.tipo === "prompt") estado.resolve(resultado === false ? null : (resultado as string | null));
    else estado.resolve();
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
          className="modal-backdrop fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => fechar(estado.tipo === "prompt" ? null : false)}
          data-dialog-ativo=""
        >
          <div
            role={estado.tipo === "confirm" ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby="am-dialog-titulo"
            className="sheet-panel sm:modal-panel surface shadow-pop w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-default p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {estado.tipo !== "prompt" && (estado as any).opts.perigo && (
                <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-red-500/10 text-red-500">
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
                className="shrink-0 grid place-items-center h-8 w-8 -mr-1 -mt-1 rounded-full text-muted hover:bg-[var(--hover)] hover:text-strong active:scale-90 transition"
              >
                <X size={18} />
              </button>
            </div>

            {estado.tipo === "prompt" && (
              <input
                ref={inputRef}
                className="input"
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
                    ? "bg-red-600 text-white hover:bg-red-700 px-4 py-3"
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
