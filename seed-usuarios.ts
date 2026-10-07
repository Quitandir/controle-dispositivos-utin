// Contas autorizadas a entrar no sistema (tabela usuarios_autorizados).
// Para dar acesso: inclua na lista e rode de novo — quem já está na tabela é ignorado.
// Para tirar acesso: este script NÃO remove ninguém; apague a linha no banco
// (delete from usuarios_autorizados where email = '...'). O corte vale em até 1 minuto.
// Uso: npx tsx seed-usuarios.ts
import { config } from "dotenv";

config({ path: ".env.local" });

const USUARIOS: [email: string, nome: string][] = [
  ["moises.carniel@canoasedu.rs.gov.br", "Moisés Carniel"],
  ["fabio.faturi@canoasedu.rs.gov.br", "Fábio Faturi"],
  ["mariah.luz@canoasedu.rs.gov.br", "Mariah Oyarzabal da Luz"],
  ["renato.albuquerque@canoasedu.rs.gov.br", "Renato Albuquerque"],
  ["silvia.senna@canoasedu.rs.gov.br", "Silvia Senna"]
];

async function main() {
  // import dinâmico: DATABASE_URL precisa estar carregada antes de criar o Pool
  const { db } = await import("./src/db/index");
  const { usuariosAutorizados } = await import("./src/db/schema");

  const inseridos = await db
    .insert(usuariosAutorizados)
    .values(USUARIOS.map(([email, nome]) => ({ email: email.trim().toLowerCase(), nome })))
    .onConflictDoNothing()
    .returning({ email: usuariosAutorizados.email });

  console.log(`${inseridos.length} conta(s) nova(s); ${USUARIOS.length - inseridos.length} já estava(m) na lista`);
  process.exit(0);
}

main();
