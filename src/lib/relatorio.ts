// Tipos e funções puras do relatório de visita (sem acesso a banco).
import { STATUS_OPCOES, STATUS_OPCOES_TABLET } from "./status";
import { formatarData } from "./telas";

// Retrato congelado da conferência, gravado em visitas.retrato (jsonb).
export type RetratoVisita = {
  escola: { nome: string; categoria: string | null };
  dataVisita: string; // AAAA-MM-DD (fuso de Brasília)
  chromebooks: {
    patrimonio: string | null;
    serie: string | null;
    modelo: string | null;
    status: string;
    ultimoSyncGoogle: string | null; // ISO
    ultimoUsuario: string | null;
  }[];
  tablets: { patrimonio: string; imei: string | null; status: string }[];
  telas: {
    patrimonio: string;
    marca: string;
    sala: string;
    dataVistoria: string; // AAAA-MM-DD
    funcionando: string;
    internet: string;
    som: string;
    atualizada: string;
    emailInstalado: string;
  }[];
  observacoes?: string | null; // ausente nos relatórios gerados antes de 11/2026
};

export const LIMITE_OBSERVACOES = 2000;

// Dados da visita que o PDF precisa além do retrato.
export type CabecalhoRelatorio = {
  codigo: string; // REL-2026-0042 ou REL-2026-0042 v2
  diretorNome: string;
  responsavelNome: string;
  responsavelEmail: string;
};

export function codigoRelatorio(ano: number, numero: number, versao: number): string {
  const base = `REL-${ano}-${String(numero).padStart(4, "0")}`;
  return versao > 1 ? `${base} v${versao}` : base;
}

export function nomeArquivoRelatorio(nomeEscola: string, codigo: string): string {
  // barras quebrariam o nome no Drive
  return `${nomeEscola.replace(/[\\/]/g, "-")} - ${codigo}.pdf`;
}

export function rotuloStatus(tipo: "chromebook" | "tablet", valor: string): string {
  const opcoes: readonly { valor: string; rotulo: string }[] =
    tipo === "chromebook" ? STATUS_OPCOES : STATUS_OPCOES_TABLET;
  return opcoes.find((o) => o.valor === valor)?.rotulo ?? valor;
}

// Data de hoje no fuso de Brasília, AAAA-MM-DD.
export function hojeBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export const STATUS_RESUMO = ["localizado", "nao_localizado", "recolhido", "baixado"] as const;

export type LinhaResumo = { tipo: string; total: number } & Record<(typeof STATUS_RESUMO)[number], number>;

export function resumoPorStatus(r: RetratoVisita): LinhaResumo[] {
  const contar = (tipo: string, itens: { status: string }[]): LinhaResumo => {
    const linha = { tipo, total: itens.length, localizado: 0, nao_localizado: 0, recolhido: 0, baixado: 0 };
    for (const i of itens) {
      if (i.status in linha) linha[i.status as (typeof STATUS_RESUMO)[number]]++;
    }
    return linha;
  };
  const linhas: LinhaResumo[] = [];
  if (r.chromebooks.length) linhas.push(contar("Chromebooks", r.chromebooks));
  if (r.tablets.length) linhas.push(contar("Tablets", r.tablets));
  return linhas;
}

export type ItemPendencia = {
  tipo: "Chromebook" | "Tablet";
  patrimonio: string | null;
  identificacao: string | null; // nº de série (Chromebook) ou IMEI (tablet)
  modelo: string | null;
  ultimoSyncGoogle: string | null;
  ultimoUsuario: string | null;
};

export function itensComStatus(r: RetratoVisita, status: string): ItemPendencia[] {
  return [
    ...r.chromebooks
      .filter((c) => c.status === status)
      .map((c) => ({
        tipo: "Chromebook" as const,
        patrimonio: c.patrimonio,
        identificacao: c.serie,
        modelo: c.modelo,
        ultimoSyncGoogle: c.ultimoSyncGoogle,
        ultimoUsuario: c.ultimoUsuario,
      })),
    ...r.tablets
      .filter((t) => t.status === status)
      .map((t) => ({
        tipo: "Tablet" as const,
        patrimonio: t.patrimonio,
        identificacao: t.imei,
        modelo: null,
        ultimoSyncGoogle: null,
        ultimoUsuario: null,
      })),
  ];
}

// Textos fixos do relatório e do e-mail — ajustar aqui se a orientação mudar.
export const URL_DELEGACIA_ONLINE =
  "https://www.delegaciaonline.rs.gov.br/dol/#!/registroindex/Furto%20~2F%20Roubo/avisos";

// No PDF, o endereço da delegacia entra entre os dois trechos, como link.
export const TEXTO_ORIENTACAO_NAO_LOCALIZADOS = {
  antesDoLink:
    "Os equipamentos relacionados acima não foram localizados durante a conferência. " +
    "A equipe diretiva deve realizar a busca na escola e, em até 5 dias úteis a partir do recebimento " +
    "do relatório por e-mail, responder a esse e-mail com fotos dos equipamentos encontrados, nas quais " +
    "o número de patrimônio esteja visível. Caso algum equipamento não seja localizado nesse prazo, " +
    "a direção deve registrar boletim de ocorrência pela Delegacia Online:\n",
  depoisDoLink:
    "\nA cópia do BO deve ser enviada em resposta ao mesmo e-mail, em até 5 dias úteis após o fim do prazo de busca.",
};

// **assim** = negrito na versão HTML do e-mail
const ORIENTACOES_EMAIL_NAO_LOCALIZADOS = [
  "Orientações:",
  "",
  "1. Realizar a busca dos equipamentos na escola e, **em até 5 dias úteis a partir do recebimento deste e-mail**, " +
    "responder a esta mensagem com fotos dos equipamentos encontrados, nas quais o número de patrimônio esteja visível.",
  "",
  "2. Caso algum equipamento não seja localizado nesse prazo, a direção deve registrar um boletim de ocorrência pela Delegacia Online:",
  URL_DELEGACIA_ONLINE,
  "**A cópia do BO deve ser enviada em resposta a este e-mail em até 5 dias úteis após o fim do prazo de busca.**",
];

function linhasEmailRelatorio(r: RetratoVisita, codigo: string, nomeRemetente: string): string[] {
  const naoLocalizados = itensComStatus(r, "nao_localizado");
  const lista = (titulo: string, tipo: ItemPendencia["tipo"]) => {
    const itens = naoLocalizados.filter((i) => i.tipo === tipo);
    if (!itens.length) return [];
    return [
      `${titulo} (${itens.length}):`,
      ...itens.map((i) => `- ${i.patrimonio || `sem patrimônio (série ${i.identificacao ?? "não informada"})`}`),
      "",
    ];
  };

  return [
    `Prezada equipe diretiva da ${r.escola.nome},`,
    "",
    `Segue em anexo o relatório ${codigo}, referente à conferência de dispositivos realizada em ${formatarData(r.dataVisita)}, assinado pela direção e pela UTIN.`,
    ...(naoLocalizados.length > 0
      ? [
          "",
          "**Os seguintes dispositivos não foram localizados durante a conferência:**",
          "",
          ...lista("Chromebooks", "Chromebook"),
          ...lista("Tablets", "Tablet"),
          ...ORIENTACOES_EMAIL_NAO_LOCALIZADOS,
        ]
      : []),
    ...(r.observacoes
      ? [
          "",
          "**Observações da visita:**",
          // ** no texto digitado viraria negrito no HTML
          ...r.observacoes.replaceAll("**", "*").split(/\r?\n/),
        ]
      : []),
    "",
    "Atenciosamente,",
    nomeRemetente,
    "UTIN · Secretaria Municipal da Educação de Canoas",
  ];
}

export function textoEmailRelatorio(r: RetratoVisita, codigo: string, nomeRemetente: string): string {
  return linhasEmailRelatorio(r, codigo, nomeRemetente).join("\n").replaceAll("**", "");
}

const escaparHtml = (texto: string) =>
  texto.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function htmlEmailRelatorio(r: RetratoVisita, codigo: string, nomeRemetente: string): string {
  return linhasEmailRelatorio(r, codigo, nomeRemetente)
    .map((linha) => {
      if (linha === URL_DELEGACIA_ONLINE) return `<a href="${linha}">${linha}</a>`;
      return escaparHtml(linha).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    })
    .join("<br>\n");
}

export const TEXTO_DECLARACAO =
  "Declaramos que a conferência dos dispositivos desta unidade escolar foi realizada na data " +
  "acima, com os resultados registrados neste relatório.";
