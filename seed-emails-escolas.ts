// Grava o e-mail institucional de cada escola (destino do relatório de visita).
// Fonte: planilhas "Emails das Escolas" (EMEFs e EMEIs/CEIAs) fornecidas pela equipe, out/2026.
// Padrão: endereço com sublinhado (emef_x@), não o antigo com ponto (emef.x@).
// Cada linha confere id E nome antes de atualizar, para não gravar e-mail na escola errada.
// Uso: npx tsx seed-emails-escolas.ts
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

config({ path: ".env.local" });

const D = "@canoasedu.rs.gov.br";

const EMAILS: [number, string, string][] = [
  [1, "EMEF Arthur Oscar Jochims", "emef_arthurjochims"],
  [2, "EMEF Arthur Pereira de Vargas", "emef_arthurpereira"],
  [3, "EMEF Assis Brasil", "emef_assisbrasil"],
  [4, "EMEF Barão de Mauá", "emef_baraodemaua"],
  [5, "EMEF Bilíngue para Surdos Vitória", "emef_bilinguevitoria"],
  [6, "EMEF Carlos Drummond de Andrade", "emef_carlosdrummond"],
  [7, "EMEF Castelo Branco", "emef_castelobranco"],
  [8, "EMEF Ceará", "emef_ceara"],
  [9, "EMEF Coronel Francisco Pinto Bandeira", "emef_pintobandeira"],
  [10, "EMEF David Canabarro", "emef_davidcanabarro"],
  [11, "EMEF Doutor Nelson Paim Terra", "emef_nelsonpaimterra"],
  [12, "EMEF Duque de Caxias", "emef_duquedecaxias"],
  [13, "EMEF Engenheiro Ildo Meneghetti", "emef_ildomeneghetti"],
  [14, "EMEF Erna Würth", "emef_ernawurth"],
  [15, "EMEF Farroupilha", "emef_farroupilha"],
  [16, "EMEF General Antônio de Souza Neto", "emef_generalneto"],
  [17, "EMEF General Osório", "emef_osorio"],
  [18, "EMEF Gonçalves Dias", "emef_goncalvesdias"],
  [19, "EMEF Governador Leonel de Moura Brizola", "emef_leonelbrizola"],
  [20, "EMEF Governador Walter Peracchi de Barcellos", "emef_walterperacchi"],
  [21, "EMEF Guajuviras", "emef_guajuviras"],
  [22, "EMEFCM Ícaro", "emef_icaro"],
  [23, "EMEF Irmão Pedro", "emef_irmaopedro"],
  [24, "EMEF Jacob Longoni", "emef_jacoblongoni"],
  [25, "EMEF João Palma da Silva", "emef_joaopalma"],
  [26, "EMEF João Paulo I", "emef_joaopaulo"],
  [27, "EMEF Max Adolfo Oderich", "emef_maxoderich"],
  [28, "EMEF Ministro Rubem Carlos Ludwig", "emef_rubemludwig"],
  [29, "EMEF Monteiro Lobato", "emef_monteirolobato"],
  [30, "EMEF Paulo Freire", "emef_paulofreire"],
  [31, "EMEF Paulo VI", "emef_paulovi"],
  [32, "EMEF Pernambuco", "emef_pernambuco"],
  [33, "EMEF Prefeito Edgar Fontoura", "emef_edgarfontoura"],
  [34, "EMEF Professor Doutor Rui Cirne Lima", "emef_ruicirnelima"],
  [35, "EMEF Professor Thiago Würth", "emef_thiagowurth"],
  [36, "EMEF Professora Nancy Ferreira Pansera", "emef_nancypansera"],
  [37, "EMEF Professora Odette Yolanda Oliveira Freitas", "emef_odettefreitas"],
  [38, "EMEF Rio de Janeiro", "emef_riodejaneiro"],
  [39, "EMEF Rio Grande do Sul", "emef_riograndedosul"],
  [40, "EMEF Rondônia", "emef_rondonia"],
  [41, "EMEF Santos Dumont", "emef_santosdumont"],
  [42, "EMEF Sete de Setembro", "emef_setedesetembro"],
  [43, "EMEF Tancredo de Almeida Neves", "emef_tancredoneves"],
  [44, "EMEF Theodoro Bogen", "emef_theodorobogen"],
  [45, "CEIA Nordeste - Centro de Educação Inclusiva e Acessibilidade", "ceia_prof_dirneide"],
  [46, "CEIA Noroeste - Centro de Educação Inclusiva e Acessibilidade", "ceia_prof_analucia"],
  [47, "EMEI Anísio Spínola Teixeira", "emei_anisioteixeira"],
  [48, "EMEI Beija-Flor", "emei_beijaflor"],
  [49, "EMEI Bem-Me-Quer", "emei_bem-me-quer"],
  [50, "EMEI Caramelada", "emei_caramelada"],
  [51, "EMEI Carinha de Anjo", "emei_carinhadeanjo"],
  [52, "EMEI Carrossel", "emei_carrossel"],
  [53, "EMEI Gilda Schiavon", "emei_gilda"],
  [54, "EMEI Irma Chies Stefani", "emei_irmachies"],
  [55, "EMEI Jornalista Marione Leite", "emei_jornalistamarione"],
  [56, "EMEI Julieta Villamil Balestro", "emei_julietabalestro"],
  [57, "EMEI Laney Langaro", "emei_laneylangaro"],
  [58, "EMEI Ledevino Piccinini", "emei_ledevinopiccinini"],
  [59, "EMEI Mãe Augusta", "emei_maeaugusta"],
  [60, "EMEI Nilton Leal Maria", "emei_niltonleal"],
  [61, "EMEI Olga Machado Ronchetti", "emei_olgaronchetti"],
  [62, "EMEI Pé-de-Moleque", "emei_pe-de-moleque"],
  [63, "EMEI Pequeno Polegar", "emei_pequenopolegar"],
  [64, "EMEI Pingo de Gente", "emei_pingodegente"],
  [65, "EMEI Pintando o Sete", "emei_pintandoosete"],
  [66, "EMEI Professora Rosângela Cunha Lanzoni", "emei_prof_rosangela"],
  [67, "EMEI Professora Carmem Ferreira", "emei_prof_carmemferreira"],
  [68, "EMEI Professora Idara Rocha", "emei_prof_idararocha"],
  [69, "EMEI Professora Marilene da Silva Machado", "emei_prof_marilenemachado"],
  [70, "EMEI Professora Terezinha Santos Tergolina", "emei_prof_terezinhatergolina"],
  [71, "EMEI Recanto do Filhote", "emei_recantodofilhote"],
  [72, "EMEI Tia Lourdes", "emei_tia_lourdes"],
  [73, "EMEI Tia Maria Lúcia", "emei_tia_marialucia"],
  [74, "EMEI Ulysses Machado Filho", "emei_ulysses"],
  [75, "EMEI Vereador Alcy Paulo de Oliveira", "emei_vereador_alcy"],
  [76, "EMEI Vó Babali", "emei_vo_babali"],
  [77, "EMEI Vó Corina", "emei_vo_corina"],
  [78, "EMEI Vó Inezinha", "emei_vo_inezinha"],
  [79, "EMEI Vó Lola", "emei_vo_lola"],
  [80, "EMEI Vó Maria Aldina", "emei_vo_mariaaldina"],
  [81, "EMEI Vó Nelsa", "emei_vo_nelsa"],
  [82, "EMEI Vó Picucha", "emei_vo_picucha"],
  [83, "EMEI Vó Pedra", "emei_vo_pedra"],
  [84, "EMEI Vó Sara", "emei_vo_sara"],
  [85, "EMEI Vovó Doralice", "emei_vovo_doralice"],
];

async function main() {
  // import dinâmico: DATABASE_URL precisa estar carregada antes de criar o Pool
  const { db } = await import("./src/db/index");
  const { escolas } = await import("./src/db/schema");

  let ok = 0;
  for (const [id, nome, usuario] of EMAILS) {
    const res = await db
      .update(escolas)
      .set({ email: usuario + D })
      .where(and(eq(escolas.id, id), eq(escolas.nome, nome)))
      .returning({ id: escolas.id });
    if (res.length) ok++;
    else console.warn(`NÃO atualizada (id/nome não conferem): ${id} ${nome}`);
  }
  console.log(`${ok} de ${EMAILS.length} escolas atualizadas`);
  process.exit(0);
}

main();
