"use client";

import { useMemo, useState } from "react";
import AvisoFoco from "./AvisoFoco";

export type ItemExtraviado = {
  id: number;
  assetId: string | null;
  model: string | null;
  notes: string | null;
  ultimoSync: string | null; // último contato com o Google, já formatado no servidor
};

const COLUNAS = "md:grid-cols-[9rem_1fr_2fr_10rem]";

// sem acento e em minúsculas: "goncalves" encontra "Gonçalves"
const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Só exibição: a busca procura no patrimônio e nas anotações do Admin Console, onde fica a
// escola de origem do aparelho.
export default function ListaExtraviados({
  itens,
  focoInicial = null,
}: {
  itens: ItemExtraviado[];
  focoInicial?: number | null; // id vindo da busca da home: a lista abre só com ele
}) {
  const [busca, setBusca] = useState("");
  const [foco, setFoco] = useState(focoInicial);
  const termo = normalizar(busca.trim());

  const filtrados = useMemo(
    () =>
      foco !== null
        ? itens.filter((i) => i.id === foco)
        : itens.filter((i) => normalizar(`${i.assetId ?? ""} ${i.notes ?? ""}`).includes(termo)),
    [itens, termo, foco],
  );

  return (
    <>
      {foco !== null && <AvisoFoco aoLimpar={() => setFoco(null)} />}
      <div className="sticky top-0 z-10 -mx-4 mt-6 bg-paper px-4 py-3">
        <input
          type="search"
          value={busca}
          onChange={(e) => {
            setFoco(null);
            setBusca(e.target.value);
          }}
          placeholder="Buscar por patrimônio ou escola nas observações"
          aria-label="Buscar por patrimônio ou observação"
          className="min-h-12 w-full rounded-xl border-2 border-line bg-white px-4 text-base outline-none focus:border-teal md:max-w-md"
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
        <span>Observações</span>
        <span>Última sincronização</span>
      </div>

      <ul className="mt-3 flex flex-col gap-3">
        {filtrados.map((c) => (
          <li
            key={c.id}
            className={`flex flex-col gap-2 rounded-2xl border border-line bg-white p-4 md:grid md:items-center md:gap-4 md:px-5 ${COLUNAS}`}
          >
            <div>
              <span className="font-mono text-xs uppercase text-ink-soft md:hidden">Patrimônio </span>
              <span className="font-mono text-base font-medium">{c.assetId || "sem patrimônio"}</span>
            </div>
            <div className="text-sm text-ink-soft">{c.model}</div>
            <div className="text-sm">{c.notes || "—"}</div>
            <div className="font-mono text-xs text-ink-soft">
              <span className="uppercase md:hidden">Última sincronização </span>
              {c.ultimoSync ?? "sem registro"}
            </div>
          </li>
        ))}
      </ul>

      {itens.length === 0 && <p className="mt-8 text-ink-soft">Nenhum Chromebook extraviado no momento.</p>}
      {itens.length > 0 && filtrados.length === 0 && (
        <p className="mt-8 text-ink-soft">Nenhum Chromebook encontrado para “{busca.trim()}”.</p>
      )}
    </>
  );
}
