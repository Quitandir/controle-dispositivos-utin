// Apaga os dados gerados pelo uso do app durante os testes, preservando o que veio do
// Workspace (sync dos Chromebooks) e da importação da planilha de tablets.
//
// Uso:
//   npx tsx reset-dados-teste.ts                      → só PRÉVIA (não altera nada)
//   npx tsx reset-dados-teste.ts --aplicar <endpoint> → aplica, numa única transação
//
// <endpoint> é o id do endpoint do Neon (ex.: ep-solitary-hill-b6ofljaq), que a prévia
// mostra. Exigi-lo evita rodar no banco errado por engano. Para ensaiar numa branch do Neon,
// defina DATABASE_URL antes de rodar (a variável do ambiente tem prioridade sobre o .env.local).
//
// Antes de aplicar em produção: criar uma branch de backup no Neon.
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local", quiet: true });

const CEIA_NOROESTE = { id: 46, emailOficial: "ceia_prof_analucia@canoasedu.rs.gov.br" };

// Entrada acrescentada pelo app em tablets.observacoes: "[07/10/2026, 12:31 — fulano@...] texto".
// Tudo a partir da primeira entrada dessas é do app (elas são sempre acrescentadas no fim);
// o que vem antes é a linha "[Importado da planilha original] ...".
const ENTRADA_DO_APP = /\n?\[\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} — [^\]\n]+@canoasedu\.rs\.gov\.br\]/;

async function contar(c: Client) {
  const { rows } = await c.query(`select
    (select count(*) from chromebooks
       where status is not null or status_atualizado_em is not null)::int as chromebooks_com_status,
    (select count(*) from tablets where status_atualizado_em is not null)::int as tablets_alterados,
    (select count(*) from tablets t where status_atualizado_em is not null
       and not exists (select 1 from tablet_status_historico h where h.tablet_id = t.id))::int as tablets_alterados_sem_historico,
    (select count(*) from tablets where status = 'baixado')::int as tablets_baixados,
    (select count(*) from tablets where observacoes like '[Importado da planilha original]%')::int as observacoes_importadas,
    (select count(*) from tablets where observacoes like '%@canoasedu.rs.gov.br]%')::int as observacoes_com_entrada_do_app,
    (select count(*) from status_historico)::int as historico_chromebooks,
    (select count(*) from tablet_status_historico)::int as historico_tablets,
    (select count(*) from telas)::int as telas,
    (select count(*) from tela_vistorias)::int as vistorias,
    (select count(*) from tela_vistoria_historico)::int as historico_vistorias,
    (select count(*) from visitas)::int as relatorios,
    (select count(*) from escolas where diretor_nome is not null)::int as escolas_com_diretor,
    (select email from escolas where id = ${CEIA_NOROESTE.id}) as email_ceia_noroeste`);
  return rows[0];
}

// Quantos tablets ficarão "baixado" depois do reset: os não alterados que já são "baixado"
// + os alterados cujo status original (antes do 1º registro no histórico) era "baixado".
async function baixadosEsperados(c: Client): Promise<number> {
  const { rows } = await c.query(`
    with original as (
      select distinct on (tablet_id) tablet_id, status_anterior
      from tablet_status_historico order by tablet_id, alterado_em, id
    )
    select (
      (select count(*) from tablets t where t.status = 'baixado'
         and not exists (select 1 from original o where o.tablet_id = t.id))
      + (select count(*) from original where status_anterior = 'baixado')
    )::int as n`);
  return rows[0].n;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida");
  const endpoint = new URL(url).hostname.split(".")[0].replace(/-pooler$/, "");

  const i = process.argv.indexOf("--aplicar");
  const aplicar = i !== -1;
  if (aplicar && process.argv[i + 1] !== endpoint) {
    throw new Error(`Para aplicar, informe o endpoint do banco: --aplicar ${endpoint}`);
  }

  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const antes = await contar(c);
    const esperadoBaixados = await baixadosEsperados(c);
    console.log(`Banco: ${endpoint}`);
    console.log("Situação atual:", antes);
    console.log(`Tablets "baixado" depois do reset (devem ser os da importação): ${esperadoBaixados}`);

    if (!aplicar) {
      console.log(`\nPRÉVIA apenas — nada foi alterado. Para aplicar: npx tsx reset-dados-teste.ts --aplicar ${endpoint}`);
      return;
    }

    await c.query("begin");

    // 1. Tablets alterados voltam ao status original (o "anterior" do 1º registro do histórico).
    //    Precisa vir ANTES de apagar o histórico.
    await c.query(`
      update tablets t set status = o.status_anterior, status_atualizado_em = null, status_atualizado_por = null
      from (select distinct on (tablet_id) tablet_id, status_anterior
            from tablet_status_historico order by tablet_id, alterado_em, id) o
      where o.tablet_id = t.id`);
    // alterados sem histórico (não deveria haver): mantém o status, só limpa quem/quando
    await c.query(`update tablets set status_atualizado_em = null, status_atualizado_por = null
                   where status_atualizado_em is not null`);

    // 2. Observações: remove as entradas do app, mantém a linha importada.
    const { rows: comEntrada } = await c.query(
      `select id, observacoes from tablets where observacoes like '%@canoasedu.rs.gov.br]%'`,
    );
    for (const { id, observacoes } of comEntrada) {
      const corte = observacoes.search(ENTRADA_DO_APP);
      if (corte === -1) continue;
      const restante = observacoes.slice(0, corte).trim();
      await c.query("update tablets set observacoes = $1 where id = $2", [restante || null, id]);
    }

    // 3. Chromebooks: status só existe pelo uso do app; os dados do Workspace ficam intactos.
    await c.query(`update chromebooks set status = null, status_atualizado_em = null, status_atualizado_por = null
                   where status is not null or status_atualizado_em is not null`);

    // 4. Tabelas inteiramente geradas pelo app. RESTART IDENTITY: ids voltam a começar em 1.
    await c.query(`truncate status_historico, tablet_status_historico,
                   tela_vistoria_historico, tela_vistorias, telas, visitas restart identity`);

    // 5. Escolas: nome do diretor era lembrado dos relatórios de teste; e-mail do CEIA Noroeste
    //    estava trocado para o do time durante o teste de envio.
    await c.query("update escolas set diretor_nome = null where diretor_nome is not null");
    await c.query("update escolas set email = $1 where id = $2", [CEIA_NOROESTE.emailOficial, CEIA_NOROESTE.id]);

    // Conferência antes de confirmar: qualquer divergência desfaz tudo.
    const depois = await contar(c);
    const problemas: string[] = [];
    const deveSerZero = [
      "chromebooks_com_status", "tablets_alterados", "observacoes_com_entrada_do_app",
      "historico_chromebooks", "historico_tablets", "telas", "vistorias",
      "historico_vistorias", "relatorios", "escolas_com_diretor",
    ] as const;
    for (const campo of deveSerZero) if (depois[campo] !== 0) problemas.push(`${campo} = ${depois[campo]}`);
    if (depois.tablets_baixados !== esperadoBaixados)
      problemas.push(`tablets_baixados = ${depois.tablets_baixados}, esperado ${esperadoBaixados}`);
    if (depois.observacoes_importadas !== antes.observacoes_importadas)
      problemas.push(`observacoes_importadas mudou: ${antes.observacoes_importadas} → ${depois.observacoes_importadas}`);
    if (depois.email_ceia_noroeste !== CEIA_NOROESTE.emailOficial)
      problemas.push(`email_ceia_noroeste = ${depois.email_ceia_noroeste}`);

    if (problemas.length) {
      await c.query("rollback");
      console.error("\nDIVERGÊNCIAS — nada foi alterado (rollback):\n- " + problemas.join("\n- "));
      process.exitCode = 1;
      return;
    }

    await c.query("commit");
    console.log("\nReset aplicado. Situação final:", depois);
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
