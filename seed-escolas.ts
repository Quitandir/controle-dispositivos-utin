import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { escolas } from "./src/db/schema";

const NOMES_ESCOLAS = [
  "EMEF Arthur Oscar Jochims",
  "EMEF Arthur Pereira de Vargas",
  "EMEF Assis Brasil",
  "EMEF Barão de Mauá",
  "EMEF Bilíngue para Surdos Vitória",
  "EMEF Carlos Drummond de Andrade",
  "EMEF Castelo Branco",
  "EMEF Ceará",
  "EMEF Coronel Francisco Pinto Bandeira",
  "EMEF David Canabarro",
  "EMEF Doutor Nelson Paim Terra",
  "EMEF Duque de Caxias",
  "EMEF Engenheiro Ildo Meneghetti",
  "EMEF Erna Würth",
  "EMEF Farroupilha",
  "EMEF General Antônio de Souza Neto",
  "EMEF General Osório",
  "EMEF Gonçalves Dias",
  "EMEF Governador Leonel de Moura Brizola",
  "EMEF Governador Walter Peracchi de Barcellos",
  "EMEF Guajuviras",
  "EMEFCM Ícaro",
  "EMEF Irmão Pedro",
  "EMEF Jacob Longoni",
  "EMEF João Palma da Silva",
  "EMEF João Paulo I",
  "EMEF Max Adolfo Oderich",
  "EMEF Ministro Rubem Carlos Ludwig",
  "EMEF Monteiro Lobato",
  "EMEF Paulo Freire",
  "EMEF Paulo VI",
  "EMEF Pernambuco",
  "EMEF Prefeito Edgar Fontoura",
  "EMEF Professor Doutor Rui Cirne Lima",
  "EMEF Professor Thiago Würth",
  "EMEF Professora Nancy Ferreira Pansera",
  "EMEF Professora Odette Yolanda Oliveira Freitas",
  "EMEF Rio de Janeiro",
  "EMEF Rio Grande do Sul",
  "EMEF Rondônia",
  "EMEF Santos Dumont",
  "EMEF Sete de Setembro",
  "EMEF Tancredo de Almeida Neves",
  "EMEF Theodoro Bogen",
  "CEIA Nordeste - Centro de Educação Inclusiva e Acessibilidade",
  "CEIA Noroeste - Centro de Educação Inclusiva e Acessibilidade",
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const rows = NOMES_ESCOLAS.map((nome) => ({
    nome,
    orgUnitPath: `/Dispositivos/Escola/${nome}`,
  }));

  const inserted = await db
    .insert(escolas)
    .values(rows)
    .onConflictDoNothing({ target: escolas.orgUnitPath })
    .returning();

  console.log(`Inseridas ${inserted.length} escolas (de ${rows.length} no total).`);
  if (inserted.length < rows.length) {
    console.log("Algumas já existiam (org_unit_path duplicado) e foram ignoradas.");
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Erro ao rodar o seed:", err);
  process.exit(1);
});