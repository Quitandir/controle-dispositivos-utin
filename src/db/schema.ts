import { pgTable, serial, text, timestamp, integer, date, jsonb, unique } from "drizzle-orm/pg-core";
import type { RetratoVisita } from "../lib/relatorio";

export const escolas = pgTable("escolas", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull().unique(),
  categoria: text("categoria"), // 'EMEF' | 'EMEI' | 'CEIA' | 'Administrativo'
  orgUnitPath: text("org_unit_path").unique(), // agora opcional
  email: text("email"), // e-mail institucional da escola (destino do relatório)
  diretorNome: text("diretor_nome"), // lembrado do último relatório, para pré-preencher o próximo
});

export const chromebooks = pgTable("chromebooks", {
  id: serial("id").primaryKey(),
  googleDeviceId: text("google_device_id").notNull().unique(),
  escolaId: integer("escola_id").references(() => escolas.id),
  assetId: text("asset_id"),
  serialNumber: text("serial_number"),
  model: text("model"),
  notes: text("notes"),
  orgUnitPath: text("org_unit_path"),
  status: text("status"), // 'localizado' | 'nao_localizado' | 'recolhido' | null
  statusAtualizadoEm: timestamp("status_atualizado_em", { withTimezone: true }),
  statusAtualizadoPor: text("status_atualizado_por"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull(),
  googleStatus: text("google_status"), // status bruto do Google: ACTIVE, DEPROVISIONED, DISABLED etc.
  ultimoSyncGoogle: timestamp("ultimo_sync_google", { withTimezone: true }), // lastSync do Admin SDK: último contato do aparelho
  ultimoUsuario: text("ultimo_usuario"), // recentUsers[0] do Admin SDK
});

export const tablets = pgTable("tablets", {
  id: serial("id").primaryKey(),
  patrimonio: text("patrimonio").notNull().unique(),
  imei: text("imei"),
  escolaId: integer("escola_id").references(() => escolas.id),
  status: text("status"), // 'localizado' | 'nao_localizado' | 'recolhido' | 'baixado' | null
  observacoes: text("observacoes"),
  statusAtualizadoEm: timestamp("status_atualizado_em", { withTimezone: true }),
  statusAtualizadoPor: text("status_atualizado_por"),
});

export const statusHistorico = pgTable("status_historico", {
  id: serial("id").primaryKey(),
  chromebookId: integer("chromebook_id").references(() => chromebooks.id),
  statusAnterior: text("status_anterior"),
  statusNovo: text("status_novo"),
  alteradoPor: text("alterado_por"),
  alteradoEm: timestamp("alterado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const tabletStatusHistorico = pgTable("tablet_status_historico", {
  id: serial("id").primaryKey(),
  tabletId: integer("tablet_id").references(() => tablets.id),
  statusAnterior: text("status_anterior"),
  statusNovo: text("status_novo"),
  alteradoPor: text("alterado_por"),
  alteradoEm: timestamp("alterado_em", { withTimezone: true }).notNull().defaultNow(),
});

// Telas interativas: não há lista prévia por escola — a tela passa a existir
// (e fica vinculada à escola) na primeira vistoria registrada para ela.
export const telas = pgTable("telas", {
  id: serial("id").primaryKey(),
  patrimonio: text("patrimonio").notNull().unique(),
  escolaId: integer("escola_id").references(() => escolas.id),
  marca: text("marca").notNull(), // 'Smart Tech' | 'Dahua' | 'Quinyx' | 'Outra'
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  criadoPor: text("criado_por").notNull(),
});

// Uma linha por visita a uma tela. Guarda a escola da visita porque a tela
// pode mudar de escola ao longo do tempo.
export const telaVistorias = pgTable("tela_vistorias", {
  id: serial("id").primaryKey(),
  telaId: integer("tela_id").notNull().references(() => telas.id),
  escolaId: integer("escola_id").references(() => escolas.id),
  dataVisita: date("data_visita", { mode: "string" }).notNull(),
  sala: text("sala").notNull(),
  funcionando: text("funcionando").notNull(), // 'sim' | 'nao' | 'somente_android' | 'somente_ops'
  emailInstalado: text("email_instalado").notNull(), // 'sim' | 'nao' | 'nao_se_aplica'
  internet: text("internet").notNull(), // 'cabo' | 'wifi' | 'nao'
  atualizada: text("atualizada").notNull(), // 'sim' | 'nao' | 'em_andamento'
  som: text("som").notNull(), // 'sim' | 'nao' | 'com_chiado'
  apps: text("apps").array().notNull().default([]),
  medidasRealizadas: text("medidas_realizadas"),
  anotacoes: text("anotacoes"),
  registradoPor: text("registrado_por").notNull(),
  registradoEm: timestamp("registrado_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadoPor: text("atualizado_por"),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }),
});

// Log de edições de vistoria: cada linha guarda só os campos que mudaram,
// no formato { campo: { de, para } }.
export const telaVistoriaHistorico = pgTable("tela_vistoria_historico", {
  id: serial("id").primaryKey(),
  vistoriaId: integer("vistoria_id").notNull().references(() => telaVistorias.id),
  alteracoes: jsonb("alteracoes").$type<Record<string, { de: unknown; para: unknown }>>().notNull(),
  alteradoPor: text("alterado_por").notNull(),
  alteradoEm: timestamp("alterado_em", { withTimezone: true }).notNull().defaultNow(),
});

// Relatório de visita: um retrato congelado da conferência no momento da geração.
// O PDF assinado na escola corresponde a este retrato, mesmo que os status mudem depois.
// Refazer o relatório da mesma escola no mesmo ano mantém o número e sobe a versão.
export const visitas = pgTable(
  "visitas",
  {
    id: serial("id").primaryKey(),
    escolaId: integer("escola_id").notNull().references(() => escolas.id),
    ano: integer("ano").notNull(),
    numero: integer("numero").notNull(), // sequencial por ano: REL-2026-0042
    versao: integer("versao").notNull(),
    retrato: jsonb("retrato").$type<RetratoVisita>().notNull(),
    diretorNome: text("diretor_nome").notNull(),
    geradoPor: text("gerado_por").notNull(), // e-mail
    geradoPorNome: text("gerado_por_nome").notNull(),
    geradoEm: timestamp("gerado_em", { withTimezone: true }).notNull().defaultNow(),
    driveFileId: text("drive_file_id"),
    driveUrl: text("drive_url"),
    enviadoPara: text("enviado_para"),
    enviadoPor: text("enviado_por"),
    enviadoEm: timestamp("enviado_em", { withTimezone: true }),
  },
  (t) => [unique().on(t.ano, t.numero, t.versao)],
);

// Refresh token do Google de cada usuário, para enviar e-mail (gmail.send) em nome
// de quem está logado. Fica só no servidor — nunca vai para a sessão do navegador.
export const tokensGoogle = pgTable("tokens_google", {
  email: text("email").primaryKey(),
  refreshToken: text("refresh_token").notNull(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
});

// Contas que podem entrar no sistema (além da trava de domínio @canoasedu).
// Mantida por script/SQL — ver seed-usuarios.ts. Remover a linha corta o acesso em até 1 minuto.
export const usuariosAutorizados = pgTable("usuarios_autorizados", {
  email: text("email").primaryKey(), // sempre em minúsculas
  nome: text("nome"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});
