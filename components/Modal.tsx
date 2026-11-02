"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Modal único do app: bottom sheet no celular, centralizado no desktop.
// - portal em document.body: escapa do transform da transição de página e das
//   margens de `space-y-*` do pai (antes o modal herdava margem/posição errada);
// - role="dialog" + aria-modal + aria-labelledby; Esc e clique no fundo fecham;
// - foco inicial no primeiro campo/botão, Tab circula dentro, e o foco volta
//   para quem abriu ao fechar.

type Props = {
  onClose: () => void;
  titulo: React.ReactNode;
  children: React.ReactNode;
  /** largura máxima no desktop (classe Tailwind) */
  largura?: string;
  /** classes extras do fundo (ex.: "md:hidden" p/ menu só do celular) */
  backdropClassName?: string;
  /** classes do conteúdo (padrão: espaçamento vertical) */
  className?: string;
  /** ícone/elemento antes do título */
  icone?: React.ReactNode;
  /** rótulo do X (padrão "Fechar") */
  fecharLabel?: string;
};

const FOCAVEIS =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// pilha de modais abertos: só o do topo reage ao Esc
const pilha: string[] = [];

export default function Modal({
  onClose,
  titulo,
  children,
  largura = "md:max-w-md",
  backdropClassName = "",
  className = "space-y-3",
  icone,
  fecharLabel = "Fechar",
}: Props) {
  const id = useId();
  const tituloId = `${id}-titulo`;
  const painelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const cliqueNoFundo = useRef(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!montado) return;
    pilha.push(id);
    const anterior = document.activeElement as HTMLElement | null;
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // foco inicial: primeiro campo; senão o primeiro botão que não seja o X
    const painel = painelRef.current;
    if (painel && !painel.contains(document.activeElement)) {
      // no celular não foca campo (abriria o teclado por cima do sheet)
      const mouse = window.matchMedia?.("(pointer: fine)").matches;
      const campo = mouse
        ? painel.querySelector<HTMLElement>("input:not([type=hidden]):not([type=file]),select,textarea")
        : null;
      const alvo =
        campo ??
        (mouse
          ? Array.from(painel.querySelectorAll<HTMLElement>(FOCAVEIS)).find((el) => !el.dataset.modalFechar)
          : null) ??
        painel;
      alvo.focus({ preventScroll: true });
    }

    function onKey(e: KeyboardEvent) {
      if (pilha[pilha.length - 1] !== id) return;
      if (e.key === "Escape") {
        // um diálogo de confirmação aberto por cima cuida do próprio Esc
        if (document.querySelector("[data-dialog-ativo]")) return;
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && painelRef.current) {
        const els = Array.from(painelRef.current.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
          (el) => el.offsetParent !== null || el === document.activeElement
        );
        if (els.length === 0) return;
        const primeiro = els[0];
        const ultimo = els[els.length - 1];
        const ativo = document.activeElement;
        if (!painelRef.current.contains(ativo)) return; // foco num diálogo por cima
        if (e.shiftKey && (ativo === primeiro || ativo === painelRef.current)) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && ativo === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = pilha.lastIndexOf(id);
      if (i >= 0) pilha.splice(i, 1);
      if (pilha.length === 0) document.body.style.overflow = overflowAntes;
      if (anterior && document.contains(anterior)) anterior.focus({ preventScroll: true });
    };
  }, [montado, id]);

  if (!montado) return null;

  return createPortal(
    <div
      className={`modal-backdrop fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm md:p-4 ${backdropClassName}`}
      // fecha só com clique que começou E terminou no fundo (não ao arrastar seleção)
      onMouseDown={(e) => {
        cliqueNoFundo.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && cliqueNoFundo.current) onClose();
        cliqueNoFundo.current = false;
      }}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={`sheet-panel md:modal-panel surface shadow-pop w-full ${largura} rounded-t-3xl md:rounded-3xl border border-default p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-5 max-h-[92dvh] md:max-h-[88vh] overflow-auto overscroll-contain outline-none ${className}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={tituloId} className="text-lg font-bold flex items-center gap-2 min-w-0">
            {icone}
            <span className="min-w-0">{titulo}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={fecharLabel}
            data-modal-fechar="1"
            className="shrink-0 grid place-items-center h-10 w-10 -mr-2 rounded-full text-muted hover:bg-[var(--hover)] hover:text-strong active:scale-90 transition"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
