// Tipos e funções puras do relatório de visita (sem acesso a banco).
import { STATUS_OPCOES_TABLET } from "./status";

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
};

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

export function rotuloStatus(valor: string): string {
  return STATUS_OPCOES_TABLET.find((o) => o.valor === valor)?.rotulo ?? valor;
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
export const TEXTO_ORIENTACAO_NAO_LOCALIZADOS =
  "Os equipamentos relacionados acima não foram localizados durante a conferência. " +
  "Solicitamos que a equipe diretiva realize a busca na escola. Caso não sejam encontrados, " +
  "deverá ser registrado boletim de ocorrência do extravio e encaminhada cópia à UTIN.";

export const TEXTO_DECLARACAO =
  "Declaramos que a conferência dos dispositivos desta unidade escolar foi realizada na data " +
  "acima, com os resultados registrados neste relatório.";
