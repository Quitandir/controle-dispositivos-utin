// Andamento da conferência de cada escola, marcado à mão pelo time (escolas.status_conferencia).

export const STATUS_CONFERENCIA = [
  { valor: "a_conferir", rotulo: "A conferir" },
  { valor: "em_conferencia", rotulo: "Em conferência" },
  { valor: "aguardando_retorno", rotulo: "Aguardando retorno da escola" },
  // só depois de a escola responder sobre os não localizados (fotos ou BO): exige relatório enviado
  { valor: "finalizado", rotulo: "Finalizado" },
] as const;

export type StatusConferencia = (typeof STATUS_CONFERENCIA)[number]["valor"];

export const FILTRO_CONFERENCIA_TODAS = "todas";

// Por enquanto, só as escolas têm esse status (CEIA, setores e extraviados não)
export const CATEGORIAS_COM_STATUS_CONFERENCIA = ["EMEF", "EMEI"];

export function temStatusConferencia(categoria: string | null) {
  return CATEGORIAS_COM_STATUS_CONFERENCIA.includes(categoria ?? "");
}

export function statusConferenciaValido(v: string): v is StatusConferencia {
  return STATUS_CONFERENCIA.some((o) => o.valor === v);
}

// null no banco = ainda não mexeram = "A conferir"
export function statusConferenciaDe(valor: string | null): StatusConferencia {
  return valor && statusConferenciaValido(valor) ? valor : "a_conferir";
}

export function rotuloConferencia(valor: string | null) {
  const v = statusConferenciaDe(valor);
  return STATUS_CONFERENCIA.find((o) => o.valor === v)!.rotulo;
}

// Cores do card na home e do seletor na página da escola
export const COR_CONFERENCIA: Record<StatusConferencia, { card: string; etiqueta: string }> = {
  a_conferir: { card: "border-line bg-white", etiqueta: "bg-paper-deep text-ink-soft" },
  em_conferencia: { card: "border-line bg-white", etiqueta: "bg-teal/10 text-teal-deep" },
  aguardando_retorno: { card: "border-amber bg-amber/15", etiqueta: "bg-amber/30 text-ink" },
  finalizado: { card: "border-teal bg-teal/10", etiqueta: "bg-teal text-white" },
};
