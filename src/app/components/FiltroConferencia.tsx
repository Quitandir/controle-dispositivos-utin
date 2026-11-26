"use client";

import { useRouter } from "next/navigation";
import { FILTRO_CONFERENCIA_TODAS, STATUS_CONFERENCIA, type StatusConferencia } from "@/lib/conferencia";

// Filtro da home pelo status da conferência. Fica no endereço (?conferencia=...), junto da aba.
export default function FiltroConferencia({
  grupo,
  valor,
  contagem,
  total,
}: {
  grupo: string;
  valor: string;
  contagem: Record<StatusConferencia, number>;
  total: number;
}) {
  const router = useRouter();

  function aoMudar(novo: string) {
    const params = new URLSearchParams({ grupo });
    if (novo !== FILTRO_CONFERENCIA_TODAS) params.set("conferencia", novo);
    router.push(`/?${params}`);
  }

  return (
    <label className="flex flex-col gap-1 text-sm md:flex-row md:items-center md:gap-3">
      <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">Status da conferência</span>
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="min-h-11 rounded-xl border-2 border-line bg-white px-3 text-base font-semibold text-ink"
      >
        <option value={FILTRO_CONFERENCIA_TODAS}>Todas ({total})</option>
        {STATUS_CONFERENCIA.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo} ({contagem[o.valor]})
          </option>
        ))}
      </select>
    </label>
  );
}
