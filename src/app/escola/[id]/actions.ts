"use server";

import * as Sentry from "@sentry/nextjs";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/index";
import {
  chromebooks,
  escolas,
  statusHistorico,
  tablets,
  tabletStatusHistorico,
  telas,
  telaVistorias,
  telaVistoriaHistorico,
  visitas,
} from "@/db/schema";
import { CATEGORIA_EXTRAVIADOS } from "@/lib/grupos-escolas";
import {
  statusConferenciaValido,
  temStatusConferencia,
  type StatusConferencia,
} from "@/lib/conferencia";
import { hojeBrasilia, LIMITE_OBSERVACOES } from "@/lib/relatorio";
import { statusValido, statusValidoTablet } from "@/lib/status";
import { sincronizarUO } from "@/lib/sync-chromebooks";
import { validarVistoria, type DadosVistoria } from "@/lib/telas";
import { exigirUsuario, type UsuarioSessao } from "@/lib/usuario";

export async function atualizarStatus(chromebookId: number, novoStatus: string) {
  const { email } = await exigirUsuario();
  if (!statusValido(novoStatus)) throw new Error("Status inválido");

  await db.transaction(async (tx) => {
    const [atual] = await tx
      .select({ status: chromebooks.status })
      .from(chromebooks)
      .where(eq(chromebooks.id, chromebookId));
    if (!atual) throw new Error("Chromebook não encontrado");
    if (atual.status === novoStatus) return;

    await tx
      .update(chromebooks)
      .set({ status: novoStatus, statusAtualizadoEm: new Date(), statusAtualizadoPor: email })
      .where(eq(chromebooks.id, chromebookId));

    await tx.insert(statusHistorico).values({
      chromebookId,
      statusAnterior: atual.status,
      statusNovo: novoStatus,
      alteradoPor: email,
    });
  });

  revalidatePath("/escola/[id]", "page");
  revalidatePath("/");
}

export async function atualizarStatusTablet(tabletId: number, novoStatus: string) {
  const { email } = await exigirUsuario();
  if (!statusValidoTablet(novoStatus)) throw new Error("Status inválido");

  await db.transaction(async (tx) => {
    const [atual] = await tx
      .select({ status: tablets.status })
      .from(tablets)
      .where(eq(tablets.id, tabletId));
    if (!atual) throw new Error("Tablet não encontrado");
    if (atual.status === novoStatus) return;

    await tx
      .update(tablets)
      .set({ status: novoStatus, statusAtualizadoEm: new Date(), statusAtualizadoPor: email })
      .where(eq(tablets.id, tabletId));

    await tx.insert(tabletStatusHistorico).values({
      tabletId,
      statusAnterior: atual.status,
      statusNovo: novoStatus,
      alteradoPor: email,
    });
  });

  revalidatePath("/escola/[id]", "page");
  revalidatePath("/");
}

// Desmarcar o checkbox "localizado": volta ao status que o dispositivo tinha antes de virar
// localizado, segundo o histórico (pode ser null = não conferido). Devolve o status resultante.
export async function reverterLocalizado(chromebookId: number): Promise<string | null> {
  const { email } = await exigirUsuario();

  const novo = await db.transaction(async (tx) => {
    const [atual] = await tx
      .select({ status: chromebooks.status })
      .from(chromebooks)
      .where(eq(chromebooks.id, chromebookId));
    if (!atual) throw new Error("Chromebook não encontrado");
    if (atual.status !== "localizado") return atual.status;

    const [ultima] = await tx
      .select({ statusAnterior: statusHistorico.statusAnterior })
      .from(statusHistorico)
      .where(and(eq(statusHistorico.chromebookId, chromebookId), eq(statusHistorico.statusNovo, "localizado")))
      .orderBy(desc(statusHistorico.alteradoEm), desc(statusHistorico.id))
      .limit(1);
    const anterior = ultima?.statusAnterior ?? null;

    await tx
      .update(chromebooks)
      .set({ status: anterior, statusAtualizadoEm: new Date(), statusAtualizadoPor: email })
      .where(eq(chromebooks.id, chromebookId));
    await tx.insert(statusHistorico).values({
      chromebookId,
      statusAnterior: "localizado",
      statusNovo: anterior,
      alteradoPor: email,
    });
    return anterior;
  });

  revalidatePath("/escola/[id]", "page");
  revalidatePath("/");
  return novo;
}

export async function reverterLocalizadoTablet(tabletId: number): Promise<string | null> {
  const { email } = await exigirUsuario();

  const novo = await db.transaction(async (tx) => {
    const [atual] = await tx
      .select({ status: tablets.status })
      .from(tablets)
      .where(eq(tablets.id, tabletId));
    if (!atual) throw new Error("Tablet não encontrado");
    if (atual.status !== "localizado") return atual.status;

    const [ultima] = await tx
      .select({ statusAnterior: tabletStatusHistorico.statusAnterior })
      .from(tabletStatusHistorico)
      .where(and(eq(tabletStatusHistorico.tabletId, tabletId), eq(tabletStatusHistorico.statusNovo, "localizado")))
      .orderBy(desc(tabletStatusHistorico.alteradoEm), desc(tabletStatusHistorico.id))
      .limit(1);
    const anterior = ultima?.statusAnterior ?? null;

    await tx
      .update(tablets)
      .set({ status: anterior, statusAtualizadoEm: new Date(), statusAtualizadoPor: email })
      .where(eq(tablets.id, tabletId));
    await tx.insert(tabletStatusHistorico).values({
      tabletId,
      statusAnterior: "localizado",
      statusNovo: anterior,
      alteradoPor: email,
    });
    return anterior;
  });

  revalidatePath("/escola/[id]", "page");
  revalidatePath("/");
  return novo;
}

const fmtLog = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export async function adicionarObservacaoTablet(tabletId: number, texto: string) {
  const { email } = await exigirUsuario();

  const textoLimpo = texto.trim();
  if (!textoLimpo) throw new Error("Observação vazia");

  const [atual] = await db
    .select({ observacoes: tablets.observacoes })
    .from(tablets)
    .where(eq(tablets.id, tabletId));
  if (!atual) throw new Error("Tablet não encontrado");

  await db
    .update(tablets)
    .set({ observacoes: acrescentarEntrada(atual.observacoes, email, textoLimpo) })
    .where(eq(tablets.id, tabletId));

  revalidatePath("/escola/[id]", "page");
}

// Uma linha nova no log de observações do tablet, no formato "[data, hora — e-mail] texto".
// O script de reset reconhece esse formato para separar o que veio do app.
function acrescentarEntrada(log: string | null, email: string, texto: string) {
  const entrada = `[${fmtLog.format(new Date())} — ${email}] ${texto}`;
  return log ? `${log}\n${entrada}` : entrada;
}

// ---------------------------------------------------------------------------
// Transferência de tablets entre escolas
// ---------------------------------------------------------------------------
// Só muda a escola: o status e o histórico de status ficam como estão. A transferência fica
// registrada no log de observações do tablet.

export type TabletEncontrado = {
  id: number;
  patrimonio: string;
  status: string | null;
  escolaId: number | null;
  escolaNome: string | null;
};

export type ResultadoBuscaTablet = { ok: true; tablet: TabletEncontrado } | { ok: false; erro: string };
export type ResultadoTransferencia = { ok: true } | { ok: false; erro: string };

// "Receber tablet de outra escola": acha o tablet pelo patrimônio para a pessoa confirmar.
export async function buscarTabletParaReceber(
  escolaDestinoId: number,
  patrimonioBruto: string,
): Promise<ResultadoBuscaTablet> {
  try {
    await exigirUsuario();
  } catch (e) {
    return { ok: false, erro: mensagem(e) };
  }

  const patrimonio = patrimonioBruto.trim();
  if (!patrimonio) return { ok: false, erro: "Informe o número do patrimônio" };

  const [t] = await db
    .select({
      id: tablets.id,
      patrimonio: tablets.patrimonio,
      status: tablets.status,
      escolaId: tablets.escolaId,
      escolaNome: escolas.nome,
    })
    .from(tablets)
    .leftJoin(escolas, eq(escolas.id, tablets.escolaId))
    .where(eq(tablets.patrimonio, patrimonio));

  if (!t) return { ok: false, erro: `Nenhum tablet com o patrimônio ${patrimonio}.` };
  if (t.escolaId === escolaDestinoId) return { ok: false, erro: `O tablet ${patrimonio} já é desta escola.` };
  return { ok: true, tablet: t };
}

// escolaOrigemEsperada: a escola que a pessoa viu na tela ao confirmar. Se o tablet tiver mudado
// de escola nesse meio-tempo (outra pessoa transferiu), a transferência é recusada.
export async function transferirTablet(
  tabletId: number,
  escolaDestinoId: number,
  escolaOrigemEsperada: number | null,
): Promise<ResultadoTransferencia> {
  let usuario: UsuarioSessao;
  try {
    usuario = await exigirUsuario();
  } catch (e) {
    return { ok: false, erro: mensagem(e) };
  }

  const resultado = await db.transaction(async (tx): Promise<ResultadoTransferencia> => {
    const [atual] = await tx
      .select({ escolaId: tablets.escolaId, observacoes: tablets.observacoes, escolaNome: escolas.nome })
      .from(tablets)
      .leftJoin(escolas, eq(escolas.id, tablets.escolaId))
      .where(eq(tablets.id, tabletId))
      .for("update", { of: tablets });
    if (!atual) return { ok: false, erro: "Tablet não encontrado" };
    if (atual.escolaId !== escolaOrigemEsperada) {
      return { ok: false, erro: "Este tablet mudou de escola enquanto isso. Recarregue a página e confira." };
    }
    if (atual.escolaId === escolaDestinoId) return { ok: false, erro: "O tablet já está nesta escola." };

    const [destino] = await tx
      .select({ nome: escolas.nome, categoria: escolas.categoria })
      .from(escolas)
      .where(eq(escolas.id, escolaDestinoId));
    if (!destino || destino.categoria === CATEGORIA_EXTRAVIADOS) {
      return { ok: false, erro: "Escola de destino inválida" };
    }

    const registro = `Transferido de ${atual.escolaNome ?? "sem escola"} para ${destino.nome}`;
    await tx
      .update(tablets)
      .set({ escolaId: escolaDestinoId, observacoes: acrescentarEntrada(atual.observacoes, usuario.email, registro) })
      .where(eq(tablets.id, tabletId));
    return { ok: true };
  });

  if (resultado.ok) {
    revalidatePath("/escola/[id]", "page");
    revalidatePath("/");
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Telas interativas
// ---------------------------------------------------------------------------
// As actions de telas devolvem um resultado em vez de lançar erro: em produção
// o Next esconde a mensagem de exceções, e aqui a mensagem importa para o usuário.

export type ResultadoTela =
  | { ok: true }
  | { ok: false; erro: string }
  | { ok: false; outraEscola: string }; // tela já registrada em outra escola: pedir confirmação

function mensagem(e: unknown) {
  return e instanceof Error ? e.message : "Erro inesperado";
}

export async function registrarVistoriaTela(
  escolaId: number,
  patrimonioBruto: string,
  dadosBrutos: DadosVistoria,
  confirmarMudancaEscola: boolean,
): Promise<ResultadoTela> {
  let usuario: UsuarioSessao;
  try {
    usuario = await exigirUsuario();
  } catch (e) {
    return { ok: false, erro: mensagem(e) };
  }
  const { email } = usuario;

  const patrimonio = patrimonioBruto.trim();
  if (!patrimonio) return { ok: false, erro: "Informe o número do patrimônio" };

  let dados: DadosVistoria;
  try {
    dados = validarVistoria(dadosBrutos);
  } catch (e) {
    return { ok: false, erro: mensagem(e) };
  }

  const resultado = await db.transaction(async (tx): Promise<ResultadoTela> => {
    const [existente] = await tx.select().from(telas).where(eq(telas.patrimonio, patrimonio));

    let telaId: number;
    if (!existente) {
      const [nova] = await tx
        .insert(telas)
        .values({ patrimonio, escolaId, marca: dados.marca, criadoPor: email })
        .returning({ id: telas.id });
      telaId = nova.id;
    } else {
      if (existente.escolaId !== null && existente.escolaId !== escolaId && !confirmarMudancaEscola) {
        const [outra] = await tx
          .select({ nome: escolas.nome })
          .from(escolas)
          .where(eq(escolas.id, existente.escolaId));
        return { ok: false, outraEscola: outra?.nome ?? "outra escola" };
      }
      await tx
        .update(telas)
        .set({ escolaId, marca: dados.marca })
        .where(eq(telas.id, existente.id));
      telaId = existente.id;
    }

    await tx.insert(telaVistorias).values({
      telaId,
      escolaId,
      dataVisita: dados.dataVisita,
      sala: dados.sala,
      funcionando: dados.funcionando,
      emailInstalado: dados.emailInstalado,
      internet: dados.internet,
      atualizada: dados.atualizada,
      som: dados.som,
      apps: dados.apps,
      medidasRealizadas: dados.medidasRealizadas || null,
      anotacoes: dados.anotacoes || null,
      registradoPor: email,
    });

    return { ok: true };
  });

  if (resultado.ok) {
    revalidatePath("/escola/[id]", "page");
    revalidatePath("/");
  }
  return resultado;
}

const CAMPOS_VISTORIA = [
  "dataVisita",
  "sala",
  "funcionando",
  "emailInstalado",
  "internet",
  "atualizada",
  "som",
  "apps",
  "medidasRealizadas",
  "anotacoes",
] as const;

export async function editarVistoriaTela(
  vistoriaId: number,
  dadosBrutos: DadosVistoria,
): Promise<ResultadoTela> {
  let usuario: UsuarioSessao;
  try {
    usuario = await exigirUsuario();
  } catch (e) {
    return { ok: false, erro: mensagem(e) };
  }
  const { email } = usuario;

  let dados: DadosVistoria;
  try {
    dados = validarVistoria(dadosBrutos);
  } catch (e) {
    return { ok: false, erro: mensagem(e) };
  }

  const resultado = await db.transaction(async (tx): Promise<ResultadoTela> => {
    const [atual] = await tx
      .select({ vistoria: telaVistorias, marca: telas.marca })
      .from(telaVistorias)
      .innerJoin(telas, eq(telas.id, telaVistorias.telaId))
      .where(eq(telaVistorias.id, vistoriaId));
    if (!atual) return { ok: false, erro: "Vistoria não encontrada" };

    const novos = {
      ...dados,
      medidasRealizadas: dados.medidasRealizadas || null,
      anotacoes: dados.anotacoes || null,
    };

    const alteracoes: Record<string, { de: unknown; para: unknown }> = {};
    for (const campo of CAMPOS_VISTORIA) {
      const de = atual.vistoria[campo];
      const para = novos[campo];
      if (JSON.stringify(de) !== JSON.stringify(para)) alteracoes[campo] = { de, para };
    }
    if (atual.marca !== dados.marca) alteracoes.marca = { de: atual.marca, para: dados.marca };

    if (Object.keys(alteracoes).length === 0) return { ok: true };

    const agora = new Date();
    await tx
      .update(telaVistorias)
      .set({
        dataVisita: novos.dataVisita,
        sala: novos.sala,
        funcionando: novos.funcionando,
        emailInstalado: novos.emailInstalado,
        internet: novos.internet,
        atualizada: novos.atualizada,
        som: novos.som,
        apps: novos.apps,
        medidasRealizadas: novos.medidasRealizadas,
        anotacoes: novos.anotacoes,
        atualizadoPor: email,
        atualizadoEm: agora,
      })
      .where(eq(telaVistorias.id, vistoriaId));

    if (alteracoes.marca) {
      await tx.update(telas).set({ marca: dados.marca }).where(eq(telas.id, atual.vistoria.telaId));
    }

    await tx.insert(telaVistoriaHistorico).values({
      vistoriaId,
      alteracoes,
      alteradoPor: email,
      alteradoEm: agora,
    });

    return { ok: true };
  });

  if (resultado.ok) revalidatePath("/escola/[id]", "page");
  return resultado;
}

// ---------------------------------------------------------------------------
// Observações da visita (uma caixa de texto por escola)
// ---------------------------------------------------------------------------

const fmtDataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export type VersaoObservacoes = { texto: string; em: string; emFmt: string; por: string };

export type ResultadoObservacoes =
  | { ok: true; salvo: VersaoObservacoes }
  | { ok: false; erro: string }
  | { ok: false; conflito: VersaoObservacoes }; // outra pessoa salvou antes: não sobrescrever

// `versaoLida` é a data (ISO) do último salvamento que a tela conhecia. Se outra pessoa salvou
// depois disso, recusa e devolve o texto dela, para quem está editando juntar os dois.
export async function salvarObservacoesEscola(
  escolaId: number,
  textoBruto: string,
  versaoLida: string | null,
): Promise<ResultadoObservacoes> {
  let usuario: UsuarioSessao;
  try {
    usuario = await exigirUsuario();
  } catch (e) {
    return { ok: false, erro: mensagem(e) };
  }

  const texto = textoBruto.trim();
  if (texto.length > LIMITE_OBSERVACOES) {
    return { ok: false, erro: `O texto passa do limite de ${LIMITE_OBSERVACOES} caracteres` };
  }

  // data gerada aqui (milissegundos), e não pelo banco (microssegundos), para a comparação
  // com a versaoLida, que vem de um Date do JavaScript, bater exatamente
  const agora = new Date();
  const [gravado] = await db
    .update(escolas)
    .set({ observacoes: texto || null, observacoesAtualizadasEm: agora, observacoesAtualizadasPor: usuario.email })
    .where(
      and(
        eq(escolas.id, escolaId),
        sql`${escolas.observacoesAtualizadasEm} is not distinct from ${versaoLida}::timestamptz`,
      ),
    )
    .returning({ id: escolas.id });

  if (!gravado) {
    const [atual] = await db
      .select({
        texto: escolas.observacoes,
        em: escolas.observacoesAtualizadasEm,
        por: escolas.observacoesAtualizadasPor,
      })
      .from(escolas)
      .where(eq(escolas.id, escolaId));
    if (!atual?.em) return { ok: false, erro: "Não foi possível salvar. Recarregue a página e tente de novo." };
    return {
      ok: false,
      conflito: {
        texto: atual.texto ?? "",
        em: atual.em.toISOString(),
        emFmt: fmtDataHora.format(atual.em),
        por: atual.por ?? "",
      },
    };
  }

  revalidatePath("/escola/[id]", "page");
  return {
    ok: true,
    salvo: { texto, em: agora.toISOString(), emFmt: fmtDataHora.format(agora), por: usuario.email },
  };
}

// ---------------------------------------------------------------------------
// Atualizar do Console (sincroniza só a UO da escola)
// ---------------------------------------------------------------------------

export type ResultadoConsole =
  | { ok: true; naUO: number; entraram: number; sairam: number; excluidosDoConsole: number; emFmt: string }
  | { ok: false; erro: string };

export async function atualizarDoConsole(escolaId: number): Promise<ResultadoConsole> {
  try {
    await exigirUsuario();
  } catch (e) {
    return { ok: false, erro: mensagem(e) };
  }

  try {
    const r = await sincronizarUO(escolaId);
    revalidatePath("/escola/[id]", "page");
    revalidatePath("/");
    return { ok: true, ...r, emFmt: fmtDataHora.format(new Date()) };
  } catch (e) {
    Sentry.captureException(e, { extra: { escolaId } });
    return { ok: false, erro: "Não foi possível ler o Admin Console agora. Tente de novo em instantes." };
  }
}

// ---------------------------------------------------------------------------
// Status da conferência da escola (manual)
// ---------------------------------------------------------------------------

export type ResultadoConferencia =
  | { ok: true; valor: StatusConferencia; emFmt: string; por: string }
  | { ok: false; erro: string };

export async function alterarStatusConferencia(escolaId: number, valor: string): Promise<ResultadoConferencia> {
  let usuario: UsuarioSessao;
  try {
    usuario = await exigirUsuario();
  } catch (e) {
    return { ok: false, erro: mensagem(e) };
  }
  if (!statusConferenciaValido(valor)) return { ok: false, erro: "Status inválido" };

  const [escola] = await db
    .select({ categoria: escolas.categoria })
    .from(escolas)
    .where(eq(escolas.id, escolaId));
  if (!escola || !temStatusConferencia(escola.categoria)) {
    return { ok: false, erro: "Esta unidade não tem status de conferência" };
  }

  // Finalizado = a escola já respondeu sobre os não localizados, o que pressupõe o relatório enviado
  if (valor === "finalizado") {
    const ano = Number(hojeBrasilia().slice(0, 4));
    const [enviado] = await db
      .select({ id: visitas.id })
      .from(visitas)
      .where(and(eq(visitas.escolaId, escolaId), eq(visitas.ano, ano), isNotNull(visitas.enviadoEm)))
      .limit(1);
    if (!enviado) {
      return { ok: false, erro: "Só é possível finalizar depois de enviar o relatório deste ano à escola." };
    }
  }

  const agora = new Date();
  await db
    .update(escolas)
    .set({ statusConferencia: valor, statusConferenciaEm: agora, statusConferenciaPor: usuario.email })
    .where(eq(escolas.id, escolaId));

  revalidatePath("/escola/[id]", "page");
  revalidatePath("/");
  return { ok: true, valor, emFmt: fmtDataHora.format(agora), por: usuario.email };
}
