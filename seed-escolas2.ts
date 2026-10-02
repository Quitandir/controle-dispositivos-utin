import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { escolas } from "./src/db/schema"; // ajuste o caminho se o schema estiver em outro lugar

const EMEIS = [
  "EMEI Anísio Spínola Teixeira",
  "EMEI Beija-Flor",
  "EMEI Bem-Me-Quer",
  "EMEI Caramelada",
  "EMEI Carinha de Anjo",
  "EMEI Carrossel",
  "EMEI Gilda Schiavon",
  "EMEI Irma Chies Stefani",
  "EMEI Jornalista Marione Leite",
  "EMEI Julieta Villamil Balestro",
  "EMEI Laney Langaro",
  "EMEI Ledevino Piccinini",
  "EMEI Mãe Augusta",
  "EMEI Nilton Leal Maria",
  "EMEI Olga Machado Ronchetti",
  "EMEI Pé-de-Moleque",
  "EMEI Pequeno Polegar",
  "EMEI Pingo de Gente",
  "EMEI Pintando o Sete",
  "EMEI Profª Rosângela Cunha Lanzoni",
  "EMEI Professora Carmem Ferreira",
  "EMEI Professora Idara Rocha",
  "EMEI Professora Marilene da Silva Machado",
  "EMEI Professora Terezinha Santos Tergolina",
  "EMEI Recanto do Filhote",
  "EMEI Tia Lourdes",
  "EMEI Tia Maria Lúcia",
  "EMEI Ulysses Machado Filho",
  "EMEI Vereador Alcy Paulo de Oliveira",
  "EMEI Vó Babali",
  "EMEI Vó Corina",
  "EMEI Vó Inezinha",
  "EMEI Vó Lola",
  "EMEI Vó Maria Aldina",
  "EMEI Vó Nelsa",
  "EMEI Vó Picucha",
  "EMEI Vó Pedra",
  "EMEI Vó Sara",
  "EMEI Vovó Doralice",
];

const ADMINISTRATIVAS = [
  "SME Fiscalização",
  "SME Tempo de Cuidar",
  "SME Time Google",
  "SME/Reserva",
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  // 1. Backfill de categoria nas 46 escolas já existentes (EMEFs e CEIAs),
  //    a partir do prefixo do nome — nenhuma linha precisa ser digitada de novo.
  const emefAtualizadas = await db
    .update(escolas)
    .set({ categoria: "EMEF" })
    .where(sql`categoria is null and nome ilike 'EMEF%'`)
    .returning({ id: escolas.id });

  const ceiaAtualizadas = await db
    .update(escolas)
    .set({ categoria: "CEIA" })
    .where(sql`categoria is null and nome ilike 'CEIA%'`)
    .returning({ id: escolas.id });

  console.log(`Categoria preenchida: ${emefAtualizadas.length} EMEFs, ${ceiaAtualizadas.length} CEIAs.`);

  // 2. Inserir as 39 EMEIs (sem OU, pois não têm Chromebook)
  const emeisInseridas = await db
    .insert(escolas)
    .values(EMEIS.map((nome) => ({ nome, categoria: "EMEI" as const, orgUnitPath: null })))
    .onConflictDoNothing({ target: escolas.nome })
    .returning();

  // 3. Inserir as 4 categorias administrativas/reserva
  const adminInseridas = await db
    .insert(escolas)
    .values(
      ADMINISTRATIVAS.map((nome) => ({ nome, categoria: "Administrativo" as const, orgUnitPath: null })),
    )
    .onConflictDoNothing({ target: escolas.nome })
    .returning();

  console.log(`Inseridas ${emeisInseridas.length} EMEIs (de ${EMEIS.length}) e ${adminInseridas.length} categorias administrativas (de ${ADMINISTRATIVAS.length}).`);

  await pool.end();
}

main().catch((err) => {
  console.error("Erro ao rodar o seed da fase 2:", err);
  process.exit(1);
});