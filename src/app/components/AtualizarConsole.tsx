"use client";

import { useState, useTransition } from "react";
import { atualizarDoConsole } from "@/app/escola/[id]/actions";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// Lê agora do Admin Console os Chromebooks da UO desta escola (em vez de esperar o cron do dia
// seguinte). Útil depois de mover um aparelho de UO no Console.
// Botão só com ícone. O wrapper é `contents`: o botão entra na linha do pai (ao lado do status
// da conferência) e o texto da última leitura vai para uma linha própria, sempre a última.
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

  const rotulo = pendente ? "Atualizando do Console…" : "Atualizar do Console";

  return (
    <div className="contents">
      <button
        type="button"
        onClick={atualizar}
        disabled={pendente}
        title={rotulo}
        aria-label={rotulo}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-line bg-white text-teal-deep hover:border-teal disabled:opacity-60"
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
      </button>
      <p className="order-last basis-full font-mono text-[0.7rem] text-ink-soft">
        {pendente
          ? "Lendo o Admin Console…"
          : quando
            ? `Console lido em ${quando}`
            : "Console ainda não lido para esta unidade"}
        {resultado && <span className="text-teal-deep"> · {resultado}</span>}
      </p>
      {erro && <p className="order-last basis-full text-xs font-semibold text-terracotta">{erro}</p>}
    </div>
  );
}
