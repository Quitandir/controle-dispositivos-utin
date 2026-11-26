import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/index";
import { chromebooks, escolas, tablets, telas } from "@/db/schema";
import { rotuloStatus } from "@/lib/relatorio";
import Header from "../components/Header";
import BuscaDispositivo from "../components/BuscaDispositivo";

export const dynamic = "force-dynamic";

type Resultado = {
  chave: string;
  tipo: "Chromebook" | "Tablet" | "Tela interativa";
  identificacao: string; // "Patrimônio 131067 · Nº de série ABC"
  unidade: string | null;
  situacao: string; // status de conferência ou marca
  href: string | null; // null: não aparece em nenhuma lista do sistema (ver aviso)
  aviso: string | null;
};

const iguais = (coluna: unknown, termo: string) => sql`upper(trim(${coluna})) = upper(${termo})`;

// Busca exata, num campo só, por patrimônio (Chromebook, tablet e tela), número de série do
// Chromebook e IMEI do tablet. Um resultado que abre numa lista: vai direto para ele.
// Mais de um (o IMEI pode se repetir), nenhum ou um que não aparece em lista: mostra aqui.
async function buscar(termo: string): Promise<Resultado[]> {
  const [cbs, tbs, tls] = await Promise.all([
    db
      .select({ c: chromebooks, unidade: escolas.nome })
      .from(chromebooks)
      .leftJoin(escolas, eq(escolas.id, chromebooks.escolaId))
      .where(sql`${iguais(chromebooks.assetId, termo)} or ${iguais(chromebooks.serialNumber, termo)}`),
    db
      .select({ t: tablets, unidade: escolas.nome })
      .from(tablets)
      .leftJoin(escolas, eq(escolas.id, tablets.escolaId))
      .where(sql`${iguais(tablets.patrimonio, termo)} or ${iguais(tablets.imei, termo)}`),
    db
      .select({ t: telas, unidade: escolas.nome })
      .from(telas)
      .leftJoin(escolas, eq(escolas.id, telas.escolaId))
      .where(iguais(telas.patrimonio, termo)),
  ]);

  return [
    ...cbs.map(({ c, unidade }): Resultado => {
      const desprovisionado = c.googleStatus === "DEPROVISIONED";
      const semEscola = c.escolaId === null;
      return {
        chave: `c${c.id}`,
        tipo: "Chromebook",
        identificacao: [c.assetId && `Patrimônio ${c.assetId}`, c.serialNumber && `Nº de série ${c.serialNumber}`]
          .filter(Boolean)
          .join(" · "),
        unidade,
        situacao: c.status ? rotuloStatus("chromebook", c.status) : "Não conferido",
        href: desprovisionado || semEscola ? null : `/escola/${c.escolaId}?aba=chromebooks&foco=${c.id}`,
        aviso: desprovisionado
          ? "Desprovisionado no Admin Console: fica fora da conferência."
          : semEscola
            ? `Está numa UO fora do sistema: ${c.orgUnitPath ?? "sem UO"}.`
            : null,
      };
    }),
    ...tbs.map(({ t, unidade }): Resultado => ({
      chave: `t${t.id}`,
      tipo: "Tablet",
      identificacao: [`Patrimônio ${t.patrimonio}`, t.imei && `IMEI ${t.imei}`].filter(Boolean).join(" · "),
      unidade,
      situacao: t.status ? rotuloStatus("tablet", t.status) : "Não conferido",
      href: t.escolaId === null ? null : `/escola/${t.escolaId}?aba=tablets&foco=${t.id}`,
      aviso: t.escolaId === null ? "Tablet sem escola no sistema." : null,
    })),
    ...tls.map(({ t, unidade }): Resultado => ({
      chave: `s${t.id}`,
      tipo: "Tela interativa",
      identificacao: `Patrimônio ${t.patrimonio}`,
      unidade,
      situacao: t.marca,
      href: t.escolaId === null ? null : `/escola/${t.escolaId}?aba=telas&foco=${t.id}`,
      aviso: t.escolaId === null ? "Tela sem escola no sistema." : null,
    })),
  ];
}

export default async function PaginaBusca({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const termo = ((await searchParams).q ?? "").trim();
  if (!termo) redirect("/");

  const resultados = await buscar(termo);
  if (resultados.length === 1 && resultados[0].href) redirect(resultados[0].href);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/" className="text-sm font-semibold text-teal-deep hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-3 font-display text-2xl font-semibold text-teal-deep sm:text-4xl">Buscar dispositivo</h1>
        <div className="mt-4">
          <BuscaDispositivo valor={termo} />
        </div>

        {resultados.length === 0 ? (
          <p className="mt-8 text-ink-soft">
            Nenhum dispositivo com o patrimônio, número de série ou IMEI <strong className="text-ink">{termo}</strong>.
            A busca é exata: confira o número completo.
          </p>
        ) : (
          <>
            <p className="mt-8 font-mono text-xs text-ink-soft">
              {resultados.length} {resultados.length === 1 ? "dispositivo encontrado" : "dispositivos encontrados"}
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {resultados.map((r) => {
                const conteudo = (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">{r.tipo}</span>
                      <span className="text-sm font-semibold text-ink">{r.situacao}</span>
                    </div>
                    <p className="mt-1 font-mono text-base font-medium">{r.identificacao}</p>
                    <p className="mt-1 font-display text-lg font-semibold text-teal-deep">
                      {r.unidade ?? "Sem escola no sistema"}
                    </p>
                    {r.aviso && <p className="mt-1 text-sm font-semibold text-terracotta">{r.aviso}</p>}
                  </>
                );
                return (
                  <li key={r.chave}>
                    {r.href ? (
                      <Link
                        href={r.href}
                        className="block rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        {conteudo}
                      </Link>
                    ) : (
                      <div className="rounded-2xl border border-line bg-paper-deep p-4">{conteudo}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
