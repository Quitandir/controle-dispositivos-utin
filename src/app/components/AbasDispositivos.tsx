"use client";

import { useState, type ReactNode } from "react";

export type Aba = { chave: string; rotulo: string; conteudo: ReactNode };

// `inicial`: aba pedida no endereço (?aba=tablets, vindo da busca da home); se não existir, abre a primeira
export default function AbasDispositivos({ abas, inicial }: { abas: Aba[]; inicial?: string }) {
  const [ativa, setAtiva] = useState(abas.some((a) => a.chave === inicial) ? inicial : abas[0]?.chave);

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
