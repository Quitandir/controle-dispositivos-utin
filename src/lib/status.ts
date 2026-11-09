export const FILTRO_TODOS = "todos";
export const FILTRO_NAO_CONFERIDO = "nao_conferido";

export function passaNoFiltro(status: string | null, filtro: string) {
  if (filtro === FILTRO_TODOS) return true;
  if (filtro === FILTRO_NAO_CONFERIDO) return status === null;
  return status === filtro;
}

export const STATUS_OPCOES = [
  { valor: "localizado", rotulo: "Localizado" },
  { valor: "nao_localizado", rotulo: "Não localizado" },
  // Chromebook recolhido fica com a UTIN esperando a escola comprar a tela para o reparo
  { valor: "recolhido", rotulo: "Aguardando tela" },
] as const;

export type StatusValor = (typeof STATUS_OPCOES)[number]["valor"];

export function statusValido(v: string): v is StatusValor {
  return STATUS_OPCOES.some((o) => o.valor === v);
}

export const STATUS_OPCOES_TABLET = [
  { valor: "localizado", rotulo: "Localizado" },
  { valor: "nao_localizado", rotulo: "Não localizado" },
  { valor: "recolhido", rotulo: "Recolhido" },
  { valor: "baixado", rotulo: "Baixado" },
] as const;

export type StatusValorTablet = (typeof STATUS_OPCOES_TABLET)[number]["valor"];

export function statusValidoTablet(v: string): v is StatusValorTablet {
  return STATUS_OPCOES_TABLET.some((o) => o.valor === v);
}