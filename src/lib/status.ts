export const STATUS_OPCOES = [
  { valor: "localizado", rotulo: "Localizado" },
  { valor: "nao_localizado", rotulo: "Não localizado" },
  { valor: "recolhido", rotulo: "Recolhido" },
] as const;

export type StatusValor = (typeof STATUS_OPCOES)[number]["valor"];

export function statusValido(v: string): v is StatusValor {
  return STATUS_OPCOES.some((o) => o.valor === v);
}