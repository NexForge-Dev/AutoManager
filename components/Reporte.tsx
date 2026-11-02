"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { SUPORTE_WHATSAPP_LABEL, linkWhatsappSuporte } from "@/lib/admin";
import type { TipoChamado } from "@/lib/types";
import Modal from "./Modal";
import { LifeBuoy, Send, MessageCircle, CheckCircle2, Zap, Loader2 } from "lucide-react";

const TIPOS: { id: TipoChamado; label: string }[] = [
  { id: "erro", label: "Erro / bug" },
  { id: "duvida", label: "Dúvida" },
  { id: "sugestao", label: "Sugestão" },
];

export default function Reporte() {
  const abrirChamado = useStore((s) => s.abrirChamado);
  const nomeLoja = useStore((s) => s.config.nomeLoja);
  const emailSessao = useStore((s) => s.email);

  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoChamado>("erro");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [emailContato, setEmailContato] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  function fechar() {
    setAberto(false);
    // reseta depois da animação de saída
    setTimeout(() => {
      setTipo("erro");
      setAssunto("");
      setMensagem("");
      setEmailContato("");
      setErro(null);
      setEnviado(false);
      setEnviando(false);
    }, 150);
  }

  async function enviar() {
    setErro(null);
    if (!assunto.trim() || !mensagem.trim()) {
      setErro("Preencha o assunto e a mensagem.");
      return;
    }
    setEnviando(true);
    const r = await abrirChamado({
      tipo,
      assunto,
      mensagem,
      emailContato: emailContato || emailSessao || undefined,
    });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro || "Não foi possível registrar. Tente pelo WhatsApp.");
      return;
    }
    setEnviado(true);
  }

  const textoWhats = `Olá! Sou da loja "${nomeLoja || "(sem nome)"}" no AutoManager e preciso de ajuda.`;

  return (
    <>
      {/* card de acesso no painel */}
      <button
        onClick={() => setAberto(true)}
        className="card w-full text-left flex items-center gap-3 hover:surface-alt transition"
      >
        <span className="shrink-0 rounded-xl bg-brand-500/10 text-brand-600 p-2.5">
          <LifeBuoy size={20} />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">Reportar um problema</span>
          <span className="block text-sm text-muted">
            Fale com o suporte ou registre um ticket de erro.
          </span>
        </span>
      </button>

      {/* modal */}
      {aberto && (
        <Modal
          onClose={fechar}
          largura="md:max-w-lg"
          icone={<LifeBuoy size={18} className="text-brand-600" />}
          titulo="Suporte AutoManager"
          className="space-y-4"
        >
            {enviado ? (
              <div className="py-2 text-center space-y-3">
                <CheckCircle2 size={40} className="text-green-600 mx-auto" />
                <div className="font-semibold text-lg">Ticket registrado!</div>
                <p className="text-sm text-muted">
                  Recebemos seu chamado e vamos analisar. Se for urgente, chame também no
                  WhatsApp.
                </p>
                <a
                  href={linkWhatsappSuporte(textoWhats)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost inline-flex items-center gap-2"
                >
                  <MessageCircle size={16} /> Falar no WhatsApp
                </a>
                <div>
                  <button onClick={fechar} className="text-sm text-muted underline mt-1">
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* WhatsApp */}
                <a
                  href={linkWhatsappSuporte(textoWhats)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-green-500/40 bg-green-500/5 p-3 hover:bg-green-500/10 transition"
                >
                  <span className="shrink-0 rounded-lg bg-green-500/15 text-green-600 p-2">
                    <MessageCircle size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">WhatsApp do suporte</span>
                    <span className="block text-sm text-muted">{SUPORTE_WHATSAPP_LABEL}</span>
                  </span>
                </a>

                {/* aviso: ticket é mais rápido */}
                <div className="flex items-start gap-2 rounded-xl bg-brand-500/10 border border-brand-500/30 p-3 text-sm text-brand-600">
                  <Zap size={16} className="shrink-0 mt-0.5" />
                  <span>
                    <strong>Registrar um ticket é mais rápido.</strong> Descreva o problema
                    abaixo que conseguimos resolver com mais detalhes e histórico.
                  </span>
                </div>

                {/* formulário de ticket */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Tipo</label>
                    <div className="flex gap-2">
                      {TIPOS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTipo(t.id)}
                          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                            tipo === t.id
                              ? "bg-brand-600 text-white border-brand-600"
                              : "border-default text-muted hover:surface-alt"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1">Assunto</label>
                    <input
                      value={assunto}
                      onChange={(e) => setAssunto(e.target.value)}
                      placeholder="Ex.: Não consigo registrar venda fiado"
                      className="input w-full"
                      maxLength={120}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1">O que aconteceu?</label>
                    <textarea
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      placeholder="Conte o que você estava fazendo e o que deu errado."
                      className="input w-full min-h-[110px] resize-y"
                      maxLength={2000}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1">
                      E-mail para retorno{" "}
                      <span className="text-muted font-normal">(opcional)</span>
                    </label>
                    <input
                      value={emailContato}
                      onChange={(e) => setEmailContato(e.target.value)}
                      placeholder={emailSessao || "voce@email.com"}
                      className="input w-full"
                      type="email"
                    />
                  </div>

                  {erro && <p className="text-sm text-red-500">{erro}</p>}

                  <button
                    onClick={enviar}
                    disabled={enviando}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {enviando ? "Enviando…" : "Registrar ticket"}
                  </button>
                </div>
              </div>
            )}
        </Modal>
      )}
    </>
  );
}
