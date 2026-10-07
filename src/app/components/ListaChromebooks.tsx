"use client";

import { useMemo, useState } from "react";
import SeletorStatus from "@/app/components/SeletorStatus";

export type ItemChromebook = {
  id: number;
  assetId: string | null;
  model: string | null;
  notes: string | null;
  status: string | null;
  atualizadoEm: string | null; // já formatada no servidor
};

const COLUNAS = "md:grid-cols-[9rem_1fr_18rem_1fr_9rem]";

export default function ListaChromebooks({ itens }: { itens: ItemChromebook[] }) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();

  const filtrados = useMemo(
    () =>
      termo
        ? itens.filter((i) => (i.assetId ?? "").toLowerCase().includes(termo))
        : itens,
    [itens, termo],
  );

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 mt-6 bg-paper px-4 py-3">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por patrimônio"
          aria-label="Buscar por patrimônio"
          className="min-h-12 w-full rounded-xl border-2 border-line bg-white px-4 text-base outline-none focus:border-teal md:max-w-sm"
        />
        {termo && (
          <p className="mt-2 font-mono text-xs text-ink-soft">
            {filtrados.length} de {itens.length} encontrados
          </p>
        )}
      </div>

      <div
        className={`mt-2 hidden gap-4 px-5 font-mono text-xs uppercase tracking-widest text-ink-soft md:grid ${COLUNAS}`}
      >
        <span>Patrimônio</span>
        <span>Modelo</span>
        <span>Status</span>
        <span>Observações</span>
        <span>Última mudança</span>
      </div>

      <ul className="mt-3 flex flex-col gap-3">
        {filtrados.map((c) => (
          <li
            key={c.id}
            className={`flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 md:grid md:items-center md:gap-4 md:px-5 ${COLUNAS}`}
          >
            <div>
              <span className="font-mono text-xs uppercase text-ink-soft md:hidden">
                Patrimônio{" "}
              </span>
              <span className="font-mono text-base font-medium">
                {c.assetId || "sem patrimônio"}
              </span>
            </div>
            <div className="text-sm text-ink-soft">{c.model}</div>
            <SeletorStatus tipo="chromebook" id={c.id} statusInicial={c.status} />
            <div className="text-sm text-ink-soft">{c.notes}</div>
            <div className="font-mono text-xs text-ink-soft">
              {c.atualizadoEm ?? "—"}
            </div>
          </li>
        ))}
      </ul>

      {itens.length === 0 && (
        <p className="mt-8 text-ink-soft">Nenhum Chromebook vinculado a esta escola.</p>
      )}
      {itens.length > 0 && filtrados.length === 0 && (
        <p className="mt-8 text-ink-soft">
          Nenhum patrimônio encontrado para “{busca.trim()}”.
        </p>
      )}
    </>
  );
}