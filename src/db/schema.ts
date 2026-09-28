import { pgTable, serial, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const escolas = pgTable("escolas", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  orgUnitPath: text("org_unit_path").notNull().unique(),

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

export const statusHistorico = pgTable("status_historico", {
  id: serial("id").primaryKey(),
  chromebookId: integer("chromebook_id").references(() => chromebooks.id),
  statusAnterior: text("status_anterior"),
  statusNovo: text("status_novo"),
  alteradoPor: text("alterado_por"),
  alteradoEm: timestamp("alterado_em", { withTimezone: true }).notNull().defaultNow(),
});