"use client";

import { useState, type ReactNode } from "react";

export default function AbasDispositivos({
  temChromebooks,
  totalTablets,
  conteudoChromebooks,
  conteudoTablets,
}: {
  temChromebooks: boolean;
  totalTablets: number;
  conteudoChromebooks: ReactNode;
  conteudoTablets: ReactNode;
}) {
  const [aba, setAba] = useState<"chromebooks" | "tablets">(temChromebooks ? "chromebooks" : "tablets");

  return (
    <div>
      <div className="mt-6 inline-flex rounded-full border border-line bg-white p-1">
        {temChromebooks && (
          <button
            onClick={() => setAba("chromebooks")}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
              aba === "chromebooks" ? "bg-teal text-white" : "text-ink-soft"
            }`}
          >
            Chromebooks
          </button>
        )}
        {totalTablets > 0 && (
          <button
            onClick={() => setAba("tablets")}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
              aba === "tablets" ? "bg-teal text-white" : "text-ink-soft"
            }`}
          >
            Tablets
          </button>
        )}
      </div>

      <div className={aba === "chromebooks" ? "block" : "hidden"}>{conteudoChromebooks}</div>
      <div className={aba === "tablets" ? "block" : "hidden"}>{conteudoTablets}</div>
    </div>
  );
}