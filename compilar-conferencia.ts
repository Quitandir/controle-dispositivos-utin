// Compila a conferência do ano de todas as unidades num único PDF, antes de zerar a conferência
// para o ano seguinte. Só LÊ o banco e o Drive: não altera nada.
//
// Uso (na raiz do projeto):
//   npm run compilado:dev                       → banco dev (ensaio)
//   npm run compilado:producao                  → produção
//   npm run compilado:producao -- --ano 2026    → outro ano (padrão: o atual)
//
// Não dá para rodar com `npx tsx` direto: o @react-pdf só funciona como ESM, e o tsx carrega os
// arquivos do projeto como CommonJS. Por isso o npm script empacota antes com o esbuild
// (compilados/compilar.mjs) e roda o pacote com o Node.
//
// O .env.local entra sempre, pelas credenciais do Google; o .env.producao, quando vem depois,
// troca só o DATABASE_URL. O PDF sai em compilados/ (fora do git: tem e-mails de alunos).
//
// Conteúdo, nesta ordem:
//   1. capa com o índice de todas as unidades (status da conferência, relatório, totais);
//   2. para cada unidade com relatório no ano: a versão mais recente, baixada do Drive — o PDF
//      assinado a lápis. Se o Drive falhar, gera de novo a partir do retrato congelado (sem as
//      assinaturas) e avisa no terminal;
//   3. para cada unidade sem relatório, mas com dispositivos: a situação atual do sistema, sem
//      assinaturas. Unidades sem nenhum dispositivo aparecem só no índice.
// O card dos Chromebooks extraviados fica de fora (não é uma unidade).
import { mkdirSync, writeFileSync } from "node:fs";
import { and, desc, eq, sql } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { db } from "./src/db/index";
import { escolas, visitas } from "./src/db/schema";
import { rotuloConferencia, temStatusConferencia } from "./src/lib/conferencia";
import { baixarArquivoDoDrive } from "./src/lib/drive";
import { CATEGORIA_EXTRAVIADOS, GRUPOS_ESCOLA, grupoDaEscola } from "./src/lib/grupos-escolas";
import { codigoRelatorio, hojeBrasilia, type RetratoVisita } from "./src/lib/relatorio";
import { montarRetrato } from "./src/lib/relatorio-dados";
import {
  gerarPdfCapaCompilado,
  gerarPdfRelatorio,
  gerarPdfSituacao,
  type LinhaCompilado,
} from "./src/lib/relatorio-pdf";

const fmtData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
const fmtDataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function lerAno() {
  const i = process.argv.indexOf("--ano");
  const ano = i >= 0 ? Number(process.argv[i + 1]) : Number(hojeBrasilia().slice(0, 4));
  if (!Number.isInteger(ano) || ano < 2026) throw new Error("Ano inválido. Use, por exemplo: --ano 2026");
  return ano;
}

function contar(r: RetratoVisita) {
  const todos = [...r.chromebooks, ...r.tablets];
  return {
    chromebooks: r.chromebooks.length,
    tablets: r.tablets.length,
    naoLocalizados: todos.filter((d) => d.status === "nao_localizado").length,
    comBo: r.tablets.filter((t) => t.status === "com_bo").length,
  };
}

async function principal() {
  const ano = lerAno();
  const banco = process.env.DATABASE_URL?.match(/ep-[a-z]+-[a-z]+/)?.[0] ?? "?";
  console.log(`Compilando a conferência de ${ano} — banco ${banco}\n`);

  const ordemGrupo = (categoria: string | null) => GRUPOS_ESCOLA.findIndex((g) => g.chave === grupoDaEscola(categoria));
  const unidades = (
    await db
      .select()
      .from(escolas)
      .where(sql`${escolas.categoria} is distinct from ${CATEGORIA_EXTRAVIADOS}`)
  ).sort((a, b) => ordemGrupo(a.categoria) - ordemGrupo(b.categoria) || a.nome.localeCompare(b.nome, "pt-BR"));

  const linhas: LinhaCompilado[] = [];
  const paginas: { unidade: string; pdf: Buffer }[] = [];
  const avisos: string[] = [];

  for (const u of unidades) {
    // versão mais recente do relatório do ano (o número é fixo por escola e ano; a versão sobe)
    const [v] = await db
      .select()
      .from(visitas)
      .where(and(eq(visitas.escolaId, u.id), eq(visitas.ano, ano)))
      .orderBy(desc(visitas.versao))
      .limit(1);

    const base = {
      unidade: u.nome,
      categoria: u.categoria ?? "—",
      conferencia: temStatusConferencia(u.categoria) ? rotuloConferencia(u.statusConferencia) : "—",
    };

    if (v) {
      const codigo = codigoRelatorio(v.ano, v.numero, v.versao);
      let pdf: Buffer;
      let fonte = "PDF do Drive";
      try {
        if (!v.driveFileId) throw new Error("relatório sem arquivo no Drive");
        pdf = await baixarArquivoDoDrive(v.driveFileId);
      } catch (e) {
        pdf = await gerarPdfRelatorio(v.retrato, {
          codigo,
          diretorNome: v.diretorNome,
          responsavelNome: v.geradoPorNome,
          responsavelEmail: v.geradoPor,
        });
        fonte = "Gerado do retrato (sem assinaturas)";
        avisos.push(`${u.nome} (${codigo}): Drive indisponível (${e instanceof Error ? e.message : e}); usei o retrato.`);
      }
      paginas.push({ unidade: u.nome, pdf });
      linhas.push({
        ...base,
        relatorio: codigo,
        enviado: v.enviadoEm ? fmtData.format(v.enviadoEm) : "—",
        ...contar(v.retrato),
        fonte,
      });
      console.log(`  ${codigo.padEnd(16)} ${u.nome} — ${fonte}`);
      continue;
    }

    const retrato = await montarRetrato(u.id);
    const semDispositivos = !retrato.chromebooks.length && !retrato.tablets.length && !retrato.telas.length;
    if (!semDispositivos) paginas.push({ unidade: u.nome, pdf: await gerarPdfSituacao(retrato) });
    linhas.push({
      ...base,
      relatorio: semDispositivos ? "Sem dispositivos" : "Sem relatório",
      enviado: "—",
      ...contar(retrato),
      fonte: semDispositivos ? "Só no índice" : "Situação do sistema",
    });
    console.log(`  ${(semDispositivos ? "sem dispositivos" : "sem relatório").padEnd(16)} ${u.nome}`);
  }

  // junta capa + páginas de cada unidade num único PDF
  const capa = await gerarPdfCapaCompilado(ano, fmtDataHora.format(new Date()), linhas);
  const final = await PDFDocument.create();
  final.setTitle(`Conferência de dispositivos ${ano} — compilado`);
  final.setAuthor("UTIN · SME Canoas");
  for (const { unidade, pdf } of [{ unidade: "capa", pdf: capa }, ...paginas]) {
    try {
      const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
      const copiadas = await final.copyPages(doc, doc.getPageIndices());
      copiadas.forEach((p) => final.addPage(p));
    } catch (e) {
      avisos.push(`${unidade}: não foi possível juntar o PDF (${e instanceof Error ? e.message : e}).`);
    }
  }

  mkdirSync("compilados", { recursive: true });
  const arquivo = `compilados/conferencia-${ano}-compilado-${hojeBrasilia()}.pdf`;
  writeFileSync(arquivo, await final.save());

  const comRelatorio = linhas.filter((l) => l.relatorio.startsWith("REL-")).length;
  console.log(`\n${linhas.length} unidades · ${comRelatorio} com relatório · ${final.getPageCount()} páginas`);
  console.log(`PDF salvo em ${arquivo}`);
  if (avisos.length) {
    console.log(`\nAtenção (${avisos.length}):`);
    avisos.forEach((a) => console.log(`  - ${a}`));
  }
  process.exit(0);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
