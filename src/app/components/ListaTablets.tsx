"use client";

import { useMemo, useState } from "react";
import SeletorStatusTablet from "./SeletorStatusTablet";
import CampoObservacoes from "./CampoObservacoes";

export type ItemTablet = {
  id: number;
  patrimonio: string;
  imei: string | null;
  status: string | null;
  observacoes: string | null;
  atualizadoEm: string | null;
};

export default function ListaTablets({
  itens,
  imeisDuplicados,
}: {
  itens: ItemTablet[];
  imeisDuplicados: string[];
}) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const duplicados = useMemo(() => new Set(imeisDuplicados), [imeisDuplicados]);

  const filtrados = useMemo(
    () => (termo ? itens.filter((i) => i.patrimonio.toLowerCase().includes(termo)) : itens),
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
      <div className="mt-2 hidden grid-cols-[9rem_11rem_15rem_1fr_9rem] gap-4 px-5 font-mono text-xs uppercase tracking-widest text-ink-soft md:grid">
        <span>Patrimônio</span>
        <span>IMEI</span>
        <span>Status</span>
        <span>Observações</span>
        <span>Última mudança</span>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {filtrados.map((t) => {
          const imeiDuplicado = t.imei ? duplicados.has(t.imei) : false;
          return (
            <li
              key={t.id}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 md:grid md:grid-cols-[9rem_11rem_15rem_1fr_9rem] md:items-start md:gap-4 md:px-5"
            >
              <div>
                <span className="font-mono text-xs uppercase text-ink-soft md:hidden">Patrimônio </span>
                <span className="font-mono text-base font-medium">{t.patrimonio}</span>
              </div>
              <div>
                <span className="font-mono text-xs uppercase text-ink-soft md:hidden">IMEI </span>
                <span
                  className={`font-mono text-sm ${imeiDuplicado ? "rounded bg-terracotta/15 px-1.5 py-0.5 font-semibold text-terracotta" : "text-ink-soft"
                    }`}
                >
                  {t.imei || "—"}
                  {imeiDuplicado && " ⚠"}
                </span>
                {imeiDuplicado && (
                  <p className="mt-0.5 text-xs text-terracotta">IMEI repetido em outro tablet</p>
                )}
              </div>
              <SeletorStatusTablet tabletId={t.id} statusInicial={t.status} />
              <CampoObservacoes tabletId={t.id} historico={t.observacoes} />
              <div className="font-mono text-xs text-ink-soft">{t.atualizadoEm ?? "—"}</div>
            </li>
          );
        })}
      </ul>

      {itens.length === 0 && <p className="mt-8 text-ink-soft">Nenhum tablet vinculado a esta escola.</p>}
      {itens.length > 0 && filtrados.length === 0 && (
        <p className="mt-8 text-ink-soft">Nenhum patrimônio encontrado para “{busca.trim()}”.</p>
      )}
    </>
  );
}