"use client";

import { useState, type ReactNode } from "react";

export type Aba = { chave: string; rotulo: string; conteudo: ReactNode };

export default function AbasDispositivos({ abas }: { abas: Aba[] }) {
  const [ativa, setAtiva] = useState(abas[0]?.chave);

  if (abas.length === 0) {
    return <p className="mt-8 text-ink-soft">Nenhum dispositivo registrado nesta unidade.</p>;
  }

  return (
    <div>
      <div className="mt-6 inline-flex flex-wrap rounded-full border border-line bg-white p-1">
        {abas.map((a) => (
          <button
            key={a.chave}
            onClick={() => setAtiva(a.chave)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
              ativa === a.chave ? "bg-teal text-white" : "text-ink-soft"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {abas.map((a) => (
        <div key={a.chave} className={ativa === a.chave ? "block" : "hidden"}>
          {a.conteudo}
        </div>
      ))}
    </div>
  );
}
