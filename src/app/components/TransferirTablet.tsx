"use client";

import { useState, useTransition } from "react";
import { transferirTablet } from "@/app/escola/[id]/actions";
import { GRUPOS_ESCOLA, type GrupoEscola } from "@/lib/grupos-escolas";

export type EscolaDestino = { id: number; nome: string; grupo: GrupoEscola };

// Lista de escolas agrupada como as abas da home (EMEF, EMEI, Outras Instituições)
export function OpcoesEscolas({ escolas, exceto }: { escolas: EscolaDestino[]; exceto: number }) {
  return GRUPOS_ESCOLA.map((g) => (
    <optgroup key={g.chave} label={g.rotulo}>
      {escolas
        .filter((e) => e.grupo === g.chave && e.id !== exceto)
        .map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
    </optgroup>
  ));
}

// Botão quadrado só com ícone, na linha do tablet. Abre o painel de transferência embaixo da linha.
export function BotaoTransferir({
  aberto,
  aoClicar,
  className = "",
}: {
  aberto: boolean;
  aoClicar: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      title="Transferir para outra escola"
      aria-label="Transferir para outra escola"
      aria-expanded={aberto}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 text-teal-deep hover:border-teal ${
        aberto ? "border-teal bg-teal/10" : "border-line bg-white"
      } ${className}`}
    >
      {/* duas setas em sentidos opostos */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 8h14" />
        <path d="m15 4 4 4-4 4" />
        <path d="M20 16H6" />
        <path d="m9 12-4 4 4 4" />
      </svg>
    </button>
  );
}

// Painel aberto pelo botão: escolhe a escola de destino e transfere. O status não muda.
export default function PainelTransferencia({
  tabletId,
  patrimonio,
  escolaAtualId,
  escolas,
  aoFechar,
  className = "",
}: {
  tabletId: number;
  patrimonio: string;
  escolaAtualId: number;
  escolas: EscolaDestino[];
  aoFechar: () => void;
  className?: string;
}) {
  const [destino, setDestino] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    const escolaDestinoId = Number(destino);
    if (!escolaDestinoId) return;
    const nome = escolas.find((e) => e.id === escolaDestinoId)?.nome;
    if (!window.confirm(`Transferir o tablet ${patrimonio} para ${nome}?`)) return;
    setErro(null);
    iniciar(async () => {
      const r = await transferirTablet(tabletId, escolaDestinoId, escolaAtualId);
      // em caso de sucesso, a página recarrega os dados e o tablet sai desta lista
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <div className={`flex flex-col gap-2 rounded-xl border-2 border-line bg-paper p-3 text-sm ${className}`}>
      <label className="font-semibold text-ink" htmlFor={`destino-${tabletId}`}>
        Transferir o tablet <span className="font-mono">{patrimonio}</span> para
      </label>
      <div className="flex flex-col gap-2 md:flex-row">
        <select
          id={`destino-${tabletId}`}
          value={destino}
          disabled={pendente}
          onChange={(e) => setDestino(e.target.value)}
          className="min-h-11 w-full min-w-0 rounded-xl border-2 border-line bg-white px-3 text-base md:max-w-md"
        >
          <option value="" disabled>
            — escolha a escola —
          </option>
          <OpcoesEscolas escolas={escolas} exceto={escolaAtualId} />
        </select>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={confirmar}
            disabled={pendente || !destino}
            className="min-h-11 rounded-xl bg-teal px-4 font-semibold text-white disabled:opacity-60"
          >
            {pendente ? "Transferindo…" : "Transferir"}
          </button>
          <button
            type="button"
            onClick={aoFechar}
            disabled={pendente}
            className="min-h-11 rounded-xl border border-line bg-white px-4 font-semibold text-ink-soft"
          >
            Cancelar
          </button>
        </div>
      </div>
      <p className="text-xs text-ink-soft">O status do tablet é mantido.</p>
      {erro && <p className="text-xs font-semibold text-terracotta">{erro}</p>}
    </div>
  );
}
