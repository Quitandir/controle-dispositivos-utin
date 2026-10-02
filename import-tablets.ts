import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "node:fs";
import { parse } from "csv-parse/sync";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { escolas, tablets } from "./src/db/schema"; // ajuste o caminho se necessário

// Mapa: nome da escola exatamente como aparece na planilha de tablets
// -> nome canônico já cadastrado na tabela `escolas`. `null` = sem escola.
const MAPA_ESCOLA: Record<string, string | null> = {
  "": null,
  "CEIA Ana Lucia Ribeiro Jacob Sen": "CEIA Noroeste",
  "CEIA Professora Dirneide Isabel Goulart": "CEIA Nordeste",
  "EMEF Arthur Oscar Jochims": "EMEF Arthur Oscar Jochims",
  "EMEF Arthur Pereira de Vargas": "EMEF Arthur Pereira de Vargas",
  "EMEF Assis Brasil": "EMEF Assis Brasil",
  "EMEF Barão de Mauá": "EMEF Barão de Mauá",
  "EMEF Bilingui Vitória para Surdos": "EMEF Bilíngue para Surdos Vitória",
  "EMEF Carlos Drummond de Andrade": "EMEF Carlos Drummond de Andrade",
  "EMEF Castelo Branco": "EMEF Castelo Branco",
  "EMEF Ceará": "EMEF Ceará",
  "EMEF Coronel Pinto Bandeira": "EMEF Coronel Francisco Pinto Bandeira",
  "EMEF David Canabarro": "EMEF David Canabarro",
  "EMEF Doutor Nelson Paim Terra": "EMEF Doutor Nelson Paim Terra",
  "EMEF Duque de Caxias": "EMEF Duque de Caxias",
  "EMEF ENGENHEIRO ILDO MENEGHETTI": "EMEF Engenheiro Ildo Meneghetti",
  "EMEF ERNA WURTH": "EMEF Erna Würth",
  "EMEF Erna Wurth": "EMEF Erna Würth",
  "EMEF Farroupilha": "EMEF Farroupilha",
  "EMEF General Antônio de Souza Netto": "EMEF General Antônio de Souza Neto",
  "EMEF General Osório": "EMEF General Osório",
  "EMEF Gonçalves Dias": "EMEF Gonçalves Dias",
  "EMEF Governador Leonel de Moura Brizola": "EMEF Governador Leonel de Moura Brizola",
  "EMEF Governador Walter Peracchi de Barcellos": "EMEF Governador Walter Peracchi de Barcellos",
  "EMEF Guajuviras": "EMEF Guajuviras",
  "EMEF Irmão Pedro": "EMEF Irmão Pedro",
  "EMEF Jacob Longoni": "EMEF Jacob Longoni",
  "EMEF João Palma da Silva": "EMEF João Palma da Silva",
  "EMEF João Paulo I": "EMEF João Paulo I",
  "EMEF Max Adolfo Oderich": "EMEF Max Adolfo Oderich",
  "EMEF Ministro Rubem Carlos Ludwig": "EMEF Ministro Rubem Carlos Ludwig",
  "EMEF Monteiro Lobato": "EMEF Monteiro Lobato",
  "EMEF Paulo Freire": "EMEF Paulo Freire",
  "EMEF Paulo VI": "EMEF Paulo VI",
  "EMEF Pernambuco": "EMEF Pernambuco",
  "EMEF Prefeito Edgar Fontoura": "EMEF Prefeito Edgar Fontoura",
  "EMEF Professor Doutor Rui Cirne Lima": "EMEF Professor Doutor Rui Cirne Lima",
  "EMEF Professor Thiago Wurth": "EMEF Professor Thiago Würth",
  "EMEF Professora Nancy Ferreira Pansera": "EMEF Professora Nancy Ferreira Pansera",
  "EMEF Professora Odette Yolanda Oliveira Freitas": "EMEF Professora Odette Yolanda Oliveira Freitas",
  "EMEF Rio Grande do Sul": "EMEF Rio Grande do Sul",
  "EMEF Rio de Janeiro": "EMEF Rio de Janeiro",
  "EMEF Rio de janeiro": "EMEF Rio de Janeiro",
  "EMEF Rondônia": "EMEF Rondônia",
  "EMEF Santos Dumont": "EMEF Santos Dumont",
  "EMEF Sete de Setembro": "EMEF Sete de Setembro",
  "EMEF Tancredo de Almeida Neves": "EMEF Tancredo de Almeida Neves",
  "EMEF Theodoro Bogen": "EMEF Theodoro Bogen",
  "EMEFCM Ícaro": "EMEFCM Ícaro",
  "EMEI ANÍSIO SPÍNOLA TEIXEIRA": "EMEI Anísio Spínola Teixeira",
  "EMEI BEIJA FLOR": "EMEI Beija-Flor",
  "EMEI BEM-ME-QUER": "EMEI Bem-Me-Quer",
  "EMEI CARA MELADA": "EMEI Caramelada",
  "EMEI CARINHA DE ANJO": "EMEI Carinha de Anjo",
  "EMEI CARROSSEL": "EMEI Carrossel",
  "EMEI GILDA SCHIAVON": "EMEI Gilda Schiavon",
  "EMEI IRMA CHIES": "EMEI Irma Chies Stefani",
  "EMEI JORNALISTA MARIONE MACHADO LEITE": "EMEI Jornalista Marione Leite",
  "EMEI JULIETA VILLAMIL BALESTRO": "EMEI Julieta Villamil Balestro",
  "EMEI LANEY LANGARO": "EMEI Laney Langaro",
  "EMEI MÃE AUGUSTA": "EMEI Mãe Augusta",
  "EMEI NILTON LEAL MARIA": "EMEI Nilton Leal Maria",
  "EMEI Nilton Leal Maria": "EMEI Nilton Leal Maria",
  "EMEI OLGA MACHADO RONCHETTI": "EMEI Olga Machado Ronchetti",
  "EMEI PEQUENO POLEGAR": "EMEI Pequeno Polegar",
  "EMEI PINGO DE GENTE": "EMEI Pingo de Gente",
  "EMEI PINTANDO O SETE": "EMEI Pintando o Sete",
  "EMEI PROFESSORA CARMEM FERREIRA": "EMEI Professora Carmem Ferreira",
  "EMEI PROFESSORA IDARA ROCHA": "EMEI Professora Idara Rocha",
  "EMEI PROFESSORA MARILENE DA SILVA MACHADO": "EMEI Professora Marilene da Silva Machado",
  "EMEI PROFESSORA ROSÂNGELA": "EMEI Profª Rosângela Cunha Lanzoni",
  "EMEI PROFESSORA TEREZINHA SANTOS TERGOLINA": "EMEI Professora Terezinha Santos Tergolina",
  "EMEI PÉ DE MOLEQUE": "EMEI Pé-de-Moleque",
  "EMEI RECANTO DO FILHOTE": "EMEI Recanto do Filhote",
  "EMEI TIA LOURDES": "EMEI Tia Lourdes",
  "EMEI TIA MARIA LÚCIA": "EMEI Tia Maria Lúcia",
  "EMEI ULYSSES MACHADO FILHO": "EMEI Ulysses Machado Filho",
  "EMEI VEREADOR ALCY PAULO DE OLIVEIRA": "EMEI Vereador Alcy Paulo de Oliveira",
  "EMEI VOVÓ DORALICE": "EMEI Vovó Doralice",
  "EMEI Vovó Doralice": "EMEI Vovó Doralice",
  "EMEI VÓ BABALI": "EMEI Vó Babali",
  "EMEI VÓ CORINA": "EMEI Vó Corina",
  "EMEI VÓ INEZINHA": "EMEI Vó Inezinha",
  "EMEI VÓ LOLA": "EMEI Vó Lola",
  "EMEI VÓ MARIA ALDINA": "EMEI Vó Maria Aldina",
  "EMEI VÓ NELSA": "EMEI Vó Nelsa",
  "EMEI VÓ PEDRA": "EMEI Vó Pedra",
  "EMEI VÓ PICUCHA": "EMEI Vó Picucha",
  "EMEI VÓ SARA": "EMEI Vó Sara",
  "SME Fiscalização": "SME Fiscalização",
  "SME Tempo de Cuidar": "SME Tempo de Cuidar",
  "SME Time Google": "SME Time Google",
  "SME/Reserva": "SME/Reserva",
};

type Linha = {
  Patrimônio: string;
  "Perdido na enchente de maio de 24?": string;
  "Conferidos pela SME 2024": string;
  "Conferidos pela SME 2025": string;
  "Conferidos pela SME 2026": string;
  "Não encontrados na escola na visita do time em novembro de 2024/2025": string;
  IMEI: string;
  ESCOLA: string;
};

function montarObservacoes(l: Linha): string | null {
  const partes: string[] = [];
  const enchente = l["Perdido na enchente de maio de 24?"].trim();
  const c2024 = l["Conferidos pela SME 2024"].trim();
  const c2025 = l["Conferidos pela SME 2025"].trim();
  const c2026 = l["Conferidos pela SME 2026"].trim();
  const visita = l["Não encontrados na escola na visita do time em novembro de 2024/2025"].trim();

  if (enchente) partes.push(`Perdido na enchente (maio/2024): ${enchente}`);
  if (c2024) partes.push(`Conferência 2024: ${c2024}`);
  if (c2025) partes.push(`Conferência 2025: ${c2025}`);
  if (c2026) partes.push(`Conferência 2026: ${c2026}`);
  if (visita) partes.push(`Não encontrado na visita de nov/2024-2025: ${visita}`);

  if (partes.length === 0) return null;
  return `[Importado da planilha original] ${partes.join(" | ")}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const conteudo = fs.readFileSync("./tablets.csv", "utf-8");
  const linhas: Linha[] = parse(conteudo, { columns: true, skip_empty_lines: true });

  const todasEscolas = await db.select().from(escolas);
  const escolaPorNome = new Map(todasEscolas.map((e) => [e.nome, e.id]));

  const paraInserir: (typeof tablets.$inferInsert)[] = [];
  let semEscola = 0;
  let baixados = 0;
  const naoMapeados = new Set<string>();

  for (const l of linhas) {
    const nomeRaw = l.ESCOLA.trim();

    if (!(nomeRaw in MAPA_ESCOLA)) {
      naoMapeados.add(nomeRaw);
      continue; // não insere essa linha até o mapa ser corrigido
    }

    const nomeCanonico = MAPA_ESCOLA[nomeRaw];
    const escolaId = nomeCanonico ? escolaPorNome.get(nomeCanonico) ?? null : null;
    if (!escolaId) semEscola++;

    const enchente = l["Perdido na enchente de maio de 24?"].trim();
    const status = enchente ? "baixado" : null;
    if (status === "baixado") baixados++;

    paraInserir.push({
      patrimonio: l.Patrimônio.trim(),
      imei: l.IMEI.trim() || null,
      escolaId,
      status,
      observacoes: montarObservacoes(l),
    });
  }

  if (naoMapeados.size > 0) {
    console.error("Nomes de escola não mapeados (corrija MAPA_ESCOLA antes de continuar):");
    console.error([...naoMapeados]);
    await pool.end();
    process.exit(1);
  }

  const TAMANHO_LOTE = 500;
  let inseridos = 0;
  for (let i = 0; i < paraInserir.length; i += TAMANHO_LOTE) {
    const lote = paraInserir.slice(i, i + TAMANHO_LOTE);
    const resultado = await db
      .insert(tablets)
      .values(lote)
      .onConflictDoNothing({ target: tablets.patrimonio })
      .returning({ id: tablets.id });
    inseridos += resultado.length;
  }

  console.log(`Linhas na planilha: ${linhas.length}`);
  console.log(`Inseridos: ${inseridos}`);
  console.log(`Sem escola vinculada: ${semEscola}`);
  console.log(`Marcados como baixado (enchente/perda): ${baixados}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Erro ao importar tablets:", err);
  process.exit(1);
});