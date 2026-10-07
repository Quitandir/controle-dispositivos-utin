import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { usuariosAutorizados } from "@/db/schema";

const DOMINIO = "@canoasedu.rs.gov.br";

// O proxy consulta isto a cada navegação: um cache curto evita ir ao banco a cada clique.
// Consequência: remover alguém da lista corta o acesso em até CACHE_MS.
const CACHE_MS = 60_000;
const cache = new Map<string, { autorizado: boolean; ate: number }>();

export async function emailAutorizado(email: string | null | undefined): Promise<boolean> {
  const normalizado = email?.trim().toLowerCase();
  if (!normalizado?.endsWith(DOMINIO)) return false;

  const emCache = cache.get(normalizado);
  if (emCache && emCache.ate > Date.now()) return emCache.autorizado;

  const [linha] = await db
    .select({ email: usuariosAutorizados.email })
    .from(usuariosAutorizados)
    .where(eq(usuariosAutorizados.email, normalizado));
  const autorizado = !!linha;
  cache.set(normalizado, { autorizado, ate: Date.now() + CACHE_MS });
  return autorizado;
}
