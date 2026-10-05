import { pgTable, serial, text, timestamp, integer, date, jsonb } from "drizzle-orm/pg-core";

export const escolas = pgTable("escolas", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull().unique(),
  categoria: text("categoria"), // 'EMEF' | 'EMEI' | 'CEIA' | 'Administrativo'
  orgUnitPath: text("org_unit_path").unique(), // agora opcional
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
