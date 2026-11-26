"use client";

import { useState, useTransition } from "react";
import { atualizarDoConsole } from "@/app/escola/[id]/actions";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// Lê agora do Admin Console os Chromebooks da UO desta escola (em vez de esperar o cron do dia
// seguinte). Útil depois de mover um aparelho de UO no Console.
export default function AtualizarConsole({
  escolaId,
  atualizadoEmFmt,
}: {
  escolaId: number;
  atualizadoEmFmt: string | null;
}) {
  const [quando, setQuando] = useState(atualizadoEmFmt);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function atualizar() {
    setErro(null);
    setResultado(null);
    iniciar(async () => {
      const r = await atualizarDoConsole(escolaId);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setQuando(r.emFmt);
      const partes = [plural(r.naUO, "aparelho na UO", "aparelhos na UO")];
      if (r.entraram) partes.push(plural(r.entraram, "entrou", "entraram"));
      if (r.sairam) partes.push(plural(r.sairam, "saiu", "saíram"));
      if (r.excluidosDoConsole) partes.push(plural(r.excluidosDoConsole, "não existe mais no Console", "não existem mais no Console"));
      if (!r.entraram && !r.sairam) partes.push("nenhuma mudança");
      setResultado(partes.join(" · "));
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={atualizar}
        disabled={pendente}
        className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-line bg-white px-4 text-sm font-semibold text-teal-deep hover:border-teal disabled:opacity-60"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${pendente ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
        {pendente ? "Atualizando…" : "Atualizar do Console"}
      </button>
      <span className="font-mono text-xs text-ink-soft">
        {quando ? `Atualizado do Console em ${quando}` : "Ainda não atualizado do Console"}
      </span>
      {resultado && <p className="w-full font-mono text-xs text-teal-deep">{resultado}</p>}
      {erro && <p className="w-full text-sm font-semibold text-terracotta">{erro}</p>}
    </div>
  );
}
