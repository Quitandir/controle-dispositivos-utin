import { sql } from "drizzle-orm";
import { chromebooks } from "./schema";

// Chromebook desprovisionado no Admin Console não faz parte da conferência: fica fora da lista
// da escola, dos contadores, dos pendentes e do relatório, mesmo que já tenha sido conferido.
// Continua no banco (o sync só lê do Google) e volta sozinho se for reprovisionado.
export function chromebookNaConferencia() {
  return sql`${chromebooks.googleStatus} is distinct from 'DEPROVISIONED'`;
}
