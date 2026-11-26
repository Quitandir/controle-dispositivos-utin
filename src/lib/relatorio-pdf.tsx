import { Document, Font, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { rotuloOpcao, formatarData, type CampoOpcao } from "./telas";
import {
  TEXTO_COM_BO,
  TEXTO_DECLARACAO,
  TEXTO_ORIENTACAO_NAO_LOCALIZADOS,
  URL_DELEGACIA_ONLINE,
  itensComStatus,
  resumoPorStatus,
  rotuloStatus,
  type CabecalhoRelatorio,
  type ItemPendencia,
  type RetratoVisita,
} from "./relatorio";

// Cores da identidade visual do sistema (globals.css)
const COR = {
  ink: "#2C2620",
  inkSoft: "#5B534A",
  teal: "#2F6659",
  tealDeep: "#204A41",
  terracotta: "#C1653C",
  line: "#E3DBCA",
  paperDeep: "#F1EADC",
};

// Sem hifenização: o padrão (inglês) quebra palavras como "Atualiza-da".
Font.registerHyphenationCallback((palavra) => [palavra]);

// Helvetica embutida no PDF cobre os acentos do português (WinAnsi), sem carregar fontes.
const s = StyleSheet.create({
  pagina: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontFamily: "Helvetica", fontSize: 9, color: COR.ink },
  orgao: { fontSize: 7.5, color: COR.inkSoft, letterSpacing: 1, textTransform: "uppercase" },
  titulo: { fontFamily: "Helvetica-Bold", fontSize: 15, color: COR.tealDeep, marginTop: 6 },
  escola: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 4 },
  meta: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COR.line },
  metaItem: { marginRight: 18, marginBottom: 2 },
  metaRotulo: { fontSize: 7, color: COR.inkSoft, textTransform: "uppercase" },
  metaValor: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  secao: { fontFamily: "Helvetica-Bold", fontSize: 11, color: COR.tealDeep, marginTop: 16, marginBottom: 6 },
  linhaCab: { flexDirection: "row", backgroundColor: COR.paperDeep, borderBottomWidth: 1, borderBottomColor: COR.line },
  linha: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COR.line },
  celCab: { paddingVertical: 4, paddingHorizontal: 4, fontFamily: "Helvetica-Bold", fontSize: 8 },
  cel: { paddingVertical: 3, paddingHorizontal: 4 },
  alerta: { color: COR.terracotta, fontFamily: "Helvetica-Bold" },
  vazio: { color: COR.inkSoft, fontStyle: "italic" },
  paragrafo: { marginTop: 6 },
  assinaturas: { flexDirection: "row", marginTop: 72, justifyContent: "space-between" },
  assinatura: { width: "45%", borderTopWidth: 1, borderTopColor: COR.ink, paddingTop: 4 },
  rodape: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: COR.inkSoft },
});

type Coluna<T> = { titulo: string; largura: string; valor: (item: T, i: number) => string; destaque?: (item: T) => boolean };

function Tabela<T>({ colunas, itens }: { colunas: Coluna<T>[]; itens: T[] }) {
  return (
    <View>
      <View style={s.linhaCab} wrap={false}>
        {colunas.map((c) => (
          <Text key={c.titulo} style={[s.celCab, { width: c.largura }]}>
            {c.titulo}
          </Text>
        ))}
      </View>
      {itens.map((item, i) => (
        <View key={i} style={s.linha} wrap={false}>
          {colunas.map((c) => (
            <Text key={c.titulo} style={c.destaque?.(item) ? [s.cel, s.alerta, { width: c.largura }] : [s.cel, { width: c.largura }]}>
              {c.valor(item, i)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const fmtDataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function ultimoContato(i: ItemPendencia): string {
  if (i.tipo !== "Chromebook") return "—";
  const partes = [];
  if (i.ultimoSyncGoogle) partes.push(fmtDataHora.format(new Date(i.ultimoSyncGoogle)));
  if (i.ultimoUsuario) partes.push(i.ultimoUsuario);
  return partes.length ? partes.join(" · ") : "sem registro";
}

const traco = (v: string | null) => v || "—";

// As páginas do relatório de uma escola. Sem `cab` (unidade sem relatório gerado, no compilado
// do fim do ano), vira "situação da conferência": sem código, orientações nem assinaturas.
export function PaginaRelatorio({ retrato: r, cab }: { retrato: RetratoVisita; cab: CabecalhoRelatorio | null }) {
  const resumo = resumoPorStatus(r);
  const naoLocalizados = itensComStatus(r, "nao_localizado");
  const recolhidos = itensComStatus(r, "recolhido");
  const comBo = itensComStatus(r, "com_bo");
  const telasFuncionando = r.telas.filter((t) => t.funcionando === "sim").length;

  const colunasPendencia: Coluna<ItemPendencia>[] = [
    { titulo: "Tipo", largura: "12%", valor: (i) => i.tipo },
    { titulo: "Patrimônio", largura: "13%", valor: (i) => i.patrimonio ?? "sem patrimônio" },
    { titulo: "Nº de série / IMEI", largura: "20%", valor: (i) => traco(i.identificacao) },
    { titulo: "Modelo", largura: "25%", valor: (i) => traco(i.modelo) },
    { titulo: "Último uso registrado no Google", largura: "30%", valor: ultimoContato },
  ];

  return (
    <Page size="A4" style={s.pagina}>
        <Text style={s.orgao}>Secretaria Municipal da Educação de Canoas · UTIN</Text>
        <Text style={s.titulo}>
          {cab ? "Relatório de conferência de dispositivos" : "Situação da conferência de dispositivos"}
        </Text>
        <Text style={s.escola}>{r.escola.nome}</Text>
        {cab ? (
          <View style={s.meta}>
            <View style={s.metaItem}>
              <Text style={s.metaRotulo}>Relatório</Text>
              <Text style={s.metaValor}>{cab.codigo}</Text>
            </View>
            <View style={s.metaItem}>
              <Text style={s.metaRotulo}>Data da visita</Text>
              <Text style={s.metaValor}>{formatarData(r.dataVisita)}</Text>
            </View>
            <View style={s.metaItem}>
              <Text style={s.metaRotulo}>Responsável UTIN</Text>
              <Text style={s.metaValor}>{cab.responsavelNome}</Text>
            </View>
            <View style={s.metaItem}>
              <Text style={s.metaRotulo}>Direção</Text>
              <Text style={s.metaValor}>{cab.diretorNome}</Text>
            </View>
          </View>
        ) : (
          <View style={s.meta}>
            <Text style={s.vazio}>
              Nenhum relatório de visita foi gerado para esta unidade no ano. Dados do sistema em{" "}
              {formatarData(r.dataVisita)}.
            </Text>
          </View>
        )}

        {r.chromebooks.length > 0 && (
          <>
            <Text style={s.secao}>Chromebooks ({r.chromebooks.length})</Text>
            <Tabela
              itens={r.chromebooks}
              colunas={[
                { titulo: "#", largura: "6%", valor: (_, i) => String(i + 1) },
                { titulo: "Patrimônio", largura: "20%", valor: (c) => c.patrimonio ?? "sem patrimônio" },
                { titulo: "Nº de série", largura: "24%", valor: (c) => traco(c.serie) },
                { titulo: "Modelo", largura: "30%", valor: (c) => traco(c.modelo) },
                { titulo: "Status", largura: "20%", valor: (c) => rotuloStatus("chromebook", c.status), destaque: (c) => c.status === "nao_localizado" },
              ]}
            />
          </>
        )}

        {r.tablets.length > 0 && (
          <>
            <Text style={s.secao}>Tablets ({r.tablets.length})</Text>
            <Tabela
              itens={r.tablets}
              colunas={[
                { titulo: "#", largura: "6%", valor: (_, i) => String(i + 1) },
                { titulo: "Patrimônio", largura: "30%", valor: (t) => t.patrimonio },
                { titulo: "IMEI", largura: "40%", valor: (t) => traco(t.imei) },
                { titulo: "Status", largura: "24%", valor: (t) => rotuloStatus("tablet", t.status), destaque: (t) => t.status === "nao_localizado" },
              ]}
            />
          </>
        )}

        {r.telas.length > 0 && (
          <>
            <Text style={s.secao}>Telas interativas ({r.telas.length})</Text>
            <Tabela
              itens={r.telas}
              colunas={[
                { titulo: "Patrimônio", largura: "12%", valor: (t) => t.patrimonio },
                { titulo: "Marca", largura: "11%", valor: (t) => t.marca },
                { titulo: "Sala", largura: "13%", valor: (t) => t.sala },
                { titulo: "Vistoria", largura: "10%", valor: (t) => formatarData(t.dataVistoria) },
                ...(["funcionando", "internet", "som", "atualizada", "emailInstalado"] as CampoOpcao[]).map((campo) => ({
                  titulo: { funcionando: "Funcionando", internet: "Internet", som: "Som", atualizada: "Atualizada", emailInstalado: "E-mail" }[campo],
                  largura: { funcionando: "12%", internet: "13%", som: "10%", atualizada: "11%", emailInstalado: "8%" }[campo],
                  valor: (t: RetratoVisita["telas"][number]) => rotuloOpcao(campo, t[campo]),
                  destaque: (t: RetratoVisita["telas"][number]) => t[campo] === "nao",
                })),
              ]}
            />
          </>
        )}

        <View wrap={false}>
          <Text style={s.secao}>Resumo da conferência</Text>
          {resumo.length > 0 && (
            <Tabela
              itens={resumo}
              colunas={[
                { titulo: "Dispositivo", largura: "20%", valor: (l) => l.tipo },
                { titulo: "Total", largura: "9%", valor: (l) => String(l.total) },
                { titulo: "Localizados", largura: "14%", valor: (l) => String(l.localizado) },
                { titulo: "Não localizados", largura: "17%", valor: (l) => String(l.nao_localizado), destaque: (l) => l.nao_localizado > 0 },
                { titulo: "Recolhidos", largura: "14%", valor: (l) => String(l.recolhido) },
                { titulo: "Baixados", largura: "12%", valor: (l) => (l.tipo === "Tablets" ? String(l.baixado) : "—") },
                { titulo: "Com BO", largura: "14%", valor: (l) => (l.tipo === "Tablets" ? String(l.com_bo) : "—") },
              ]}
            />
          )}
          {r.telas.length > 0 && (
            <Text style={s.paragrafo}>
              Telas interativas: {r.telas.length} registrada{r.telas.length === 1 ? "" : "s"}, {telasFuncionando}{" "}
              funcionando plenamente.
            </Text>
          )}
        </View>

        <Text style={s.secao}>Dispositivos não localizados ({naoLocalizados.length})</Text>
        {naoLocalizados.length > 0 ? (
          <>
            <Tabela itens={naoLocalizados} colunas={colunasPendencia} />
            {cab && (
              <Text style={s.paragrafo}>
                {TEXTO_ORIENTACAO_NAO_LOCALIZADOS.antesDoLink}
                <Link src={URL_DELEGACIA_ONLINE} style={{ color: COR.teal }}>
                  {URL_DELEGACIA_ONLINE}
                </Link>
                {TEXTO_ORIENTACAO_NAO_LOCALIZADOS.depoisDoLink}
              </Text>
            )}
          </>
        ) : (
          <Text style={s.vazio}>
            {cab ? "Todos os dispositivos foram localizados." : "Nenhum dispositivo marcado como não localizado."}
          </Text>
        )}

        {recolhidos.length > 0 && (
          <>
            <Text style={s.secao}>Dispositivos recolhidos pela UTIN ({recolhidos.length})</Text>
            <Tabela itens={recolhidos} colunas={colunasPendencia.slice(0, 4).map((c) => (c.titulo === "Modelo" ? { ...c, largura: "50%" } : c))} />
          </>
        )}

        {comBo.length > 0 && (
          <>
            <Text style={s.secao}>Dispositivos com boletim de ocorrência ({comBo.length})</Text>
            <Tabela itens={comBo} colunas={colunasPendencia.slice(0, 4).map((c) => (c.titulo === "Modelo" ? { ...c, largura: "50%" } : c))} />
            <Text style={s.paragrafo}>{TEXTO_COM_BO}</Text>
          </>
        )}

        {r.observacoes && (
          <>
            <Text style={s.secao}>Observações</Text>
            <Text>{r.observacoes}</Text>
          </>
        )}

        {cab && (
          <View wrap={false}>
            <Text style={[s.paragrafo, { marginTop: 20 }]}>{TEXTO_DECLARACAO}</Text>
            <View style={s.assinaturas}>
              <View style={s.assinatura}>
                <Text style={s.metaValor}>{cab.diretorNome}</Text>
                <Text style={s.metaRotulo}>Direção da escola</Text>
              </View>
              <View style={s.assinatura}>
                <Text style={s.metaValor}>{cab.responsavelNome}</Text>
                <Text style={s.metaRotulo}>Responsável UTIN · {cab.responsavelEmail}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={s.rodape} fixed>
          <Text>
            {cab?.codigo ?? "Sem relatório"} · {r.escola.nome}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
    </Page>
  );
}

export function gerarPdfRelatorio(retrato: RetratoVisita, cab: CabecalhoRelatorio): Promise<Buffer> {
  return renderToBuffer(
    <Document title={`${cab.codigo} — ${retrato.escola.nome}`} author="UTIN · SME Canoas" language="pt-BR">
      <PaginaRelatorio retrato={retrato} cab={cab} />
    </Document>,
  );
}

// Unidade sem relatório no ano (compilado do fim do ano): situação atual, sem assinaturas.
export function gerarPdfSituacao(retrato: RetratoVisita): Promise<Buffer> {
  return renderToBuffer(
    <Document title={`Situação — ${retrato.escola.nome}`} author="UTIN · SME Canoas" language="pt-BR">
      <PaginaRelatorio retrato={retrato} cab={null} />
    </Document>,
  );
}

// ---------------------------------------------------------------------------
// Capa do compilado do fim do ano: um índice com a situação de cada unidade
// ---------------------------------------------------------------------------

export type LinhaCompilado = {
  unidade: string;
  categoria: string;
  conferencia: string; // status da conferência da escola, ou "—"
  relatorio: string; // código, "Sem relatório" ou "Sem dispositivos"
  enviado: string; // data de envio, ou "—"
  chromebooks: number;
  tablets: number;
  naoLocalizados: number;
  comBo: number;
  fonte: string; // de onde vieram as páginas desta unidade no compilado
};

export function gerarPdfCapaCompilado(ano: number, geradoEm: string, linhas: LinhaCompilado[]): Promise<Buffer> {
  const soma = (campo: "chromebooks" | "tablets" | "naoLocalizados" | "comBo") =>
    linhas.reduce((t, l) => t + l[campo], 0);
  const comRelatorio = linhas.filter((l) => l.relatorio.startsWith("REL-")).length;

  return renderToBuffer(
    <Document title={`Conferência de dispositivos ${ano} — compilado`} author="UTIN · SME Canoas" language="pt-BR">
      <Page size="A4" orientation="landscape" style={s.pagina}>
        <Text style={s.orgao}>Secretaria Municipal da Educação de Canoas · UTIN</Text>
        <Text style={s.titulo}>Conferência de dispositivos {ano} · compilado de todas as unidades</Text>
        <View style={s.meta}>
          <View style={s.metaItem}>
            <Text style={s.metaRotulo}>Gerado em</Text>
            <Text style={s.metaValor}>{geradoEm}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaRotulo}>Unidades</Text>
            <Text style={s.metaValor}>{linhas.length}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaRotulo}>Com relatório</Text>
            <Text style={s.metaValor}>{comRelatorio}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaRotulo}>Chromebooks</Text>
            <Text style={s.metaValor}>{soma("chromebooks")}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaRotulo}>Tablets</Text>
            <Text style={s.metaValor}>{soma("tablets")}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaRotulo}>Não localizados</Text>
            <Text style={s.metaValor}>{soma("naoLocalizados")}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaRotulo}>Com BO</Text>
            <Text style={s.metaValor}>{soma("comBo")}</Text>
          </View>
        </View>
        <Text style={s.paragrafo}>
          Para cada unidade, vem a seguir a versão mais recente do relatório do ano: o PDF do Drive, com as
          assinaturas. Unidades sem relatório aparecem com a situação registrada no sistema, sem assinaturas.
        </Text>

        <Text style={s.secao}>Unidades</Text>
        <Tabela
          itens={linhas}
          colunas={[
            { titulo: "Unidade", largura: "27%", valor: (l) => l.unidade },
            { titulo: "Conferência", largura: "12%", valor: (l) => l.conferencia },
            { titulo: "Relatório", largura: "12%", valor: (l) => l.relatorio },
            { titulo: "Enviado", largura: "8%", valor: (l) => l.enviado },
            { titulo: "Chromebooks", largura: "8%", valor: (l) => String(l.chromebooks) },
            { titulo: "Tablets", largura: "6%", valor: (l) => String(l.tablets) },
            { titulo: "Não loc.", largura: "6%", valor: (l) => String(l.naoLocalizados), destaque: (l) => l.naoLocalizados > 0 },
            { titulo: "Com BO", largura: "6%", valor: (l) => String(l.comBo) },
            { titulo: "Páginas no compilado", largura: "15%", valor: (l) => l.fonte },
          ]}
        />

        <View style={s.rodape} fixed>
          <Text>Conferência de dispositivos {ano} · compilado</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>,
  );
}
