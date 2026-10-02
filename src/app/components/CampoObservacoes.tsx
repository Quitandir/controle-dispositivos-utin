"use client";

import { useRef, useState, useTransition } from "react";
import { adicionarObservacaoTablet } from "@/app/escola/[id]/actions";

export default function CampoObservacoes({
  tabletId,
  historico,
}: {
  tabletId: number;
  historico: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState(false);
  const [pendente, iniciar] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  function salvar() {
    const texto = ref.current?.value.trim();
    if (!texto) return;
    setErro(false);
    iniciar(async () => {
      try {
        await adicionarObservacaoTablet(tabletId, texto);
        if (ref.current) ref.current.value = "";
      } catch {
        setErro(true);
      }
    });
  }

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="font-semibold text-teal-deep hover:underline"
      >
        {aberto ? "Ocultar observações" : "Ver / adicionar observações"}
      </button>

      {aberto && (
        <div className="mt-2 flex flex-col gap-2">
          {historico && (
            <pre className="whitespace-pre-wrap rounded-lg bg-paper-deep p-2 font-sans text-xs text-ink-soft">
              {historico}
            </pre>
          )}
          <textarea
            ref={ref}
            rows={2}
            placeholder="Adicionar observação…"
            className="min-h-11 w-full rounded-xl border-2 border-line bg-white p-2 text-sm outline-none focus:border-teal"
          />
          <button
            type="button"
            onClick={salvar}
            disabled={pendente}
            className="min-h-11 self-start rounded-xl bg-teal px-4 font-semibold text-white disabled:opacity-60"
          >
            {pendente ? "Salvando…" : "Adicionar"}
          </button>
          {erro && <p className="text-xs font-semibold text-terracotta">Não foi possível salvar.</p>}
        </div>
      )}
    </div>
  );
}