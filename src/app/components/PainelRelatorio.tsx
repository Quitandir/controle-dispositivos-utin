"use client";

import { useState, useTransition } from "react";
import { enviarRelatorioParaEscola, gerarRelatorio } from "@/app/escola/[id]/relatorio-actions";

export type ItemVisita = {
  id: number;
  codigo: string;
  geradoEm: string; // já formatado
  geradoPor: string;
  driveUrl: string | null;
  enviado: string | null; // "dd/mm/aaaa hh:mm por fulano@..." ou null
};

export default function PainelRelatorio({
  escolaId,
  pendentesChromebooks,
  pendentesTablets,
  diretorNomeInicial,
  emailEscola,
  visitas,
}: {
  escolaId: number;
  pendentesChromebooks: number;
  pendentesTablets: number;
  diretorNomeInicial: string;
  emailEscola: string | null;
  visitas: ItemVisita[]; // mais recente primeiro
}) {
  const [formAberto, setFormAberto] = useState(false);
  const [diretorNome, setDiretorNome] = useState(diretorNomeInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [acao, setAcao] = useState<string | null>(null); // o que está em andamento
  const [pendente, iniciar] = useTransition();

  const faltam = pendentesChromebooks + pendentesTablets;

  function gerar() {
    setErro(null);
    setAviso(null);
    setAcao("gerar");
    iniciar(async () => {
      const r = await gerarRelatorio(escolaId, diretorNome);
      if (r.ok) {
        setFormAberto(false);
        setAviso("Relatório gerado e salvo no Drive. Abra no Drive para colher as assinaturas.");
      } else setErro(r.erro);
      setAcao(null);
    });
  }

  function enviar(v: ItemVisita) {
    if (!confirm(`Enviar o relatório ${v.codigo} para ${emailEscola}?\n\nConfira antes se as duas assinaturas já foram feitas no Drive.`)) return;
    setErro(null);
    setAviso(null);
    setAcao(`enviar-${v.id}`);
    iniciar(async () => {
      const r = await enviarRelatorioParaEscola(v.id);
      if (r.ok) setAviso(`Relatório ${v.codigo} enviado para ${emailEscola}.`);
      else setErro(r.erro);
      setAcao(null);
    });
  }

  const motivoPendencia = [
    pendentesChromebooks > 0 && `${pendentesChromebooks} Chromebook${pendentesChromebooks === 1 ? "" : "s"}`,
    pendentesTablets > 0 && `${pendentesTablets} tablet${pendentesTablets === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" e ");

  return (
    <section className="mt-6 rounded-2xl border-2 border-line bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-teal-deep">Relatório da visita</h2>
          {faltam > 0 ? (
            <p className="text-sm text-ink-soft">
              Falta{faltam === 1 ? "" : "m"} {motivoPendencia} sem status para gerar o relatório.
            </p>
          ) : (
            <p className="text-sm text-ink-soft">Todos os dispositivos foram conferidos.</p>
          )}
        </div>
        {!formAberto && (
          <button
            type="button"
            disabled={faltam > 0 || pendente}
            onClick={() => setFormAberto(true)}
            className="min-h-12 rounded-xl bg-teal px-5 font-semibold text-white hover:bg-teal-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {visitas.length > 0 ? "Gerar nova versão" : "Gerar relatório"}
          </button>
        )}
      </div>

      {formAberto && (
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Nome do(a) diretor(a)
            <input
              value={diretorNome}
              onChange={(e) => setDiretorNome(e.target.value)}
              className="min-h-12 rounded-xl border-2 border-line bg-white px-4 text-base font-normal outline-none focus:border-teal sm:max-w-md"
            />
          </label>
          {visitas.length > 0 && (
            <p className="text-sm text-ink-soft">
              Já existe o relatório {visitas[0].codigo}. A nova versão usa os status atuais; a anterior continua no Drive.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={gerar}
              disabled={pendente || !diretorNome.trim()}
              className="min-h-12 rounded-xl bg-teal px-5 font-semibold text-white hover:bg-teal-deep disabled:opacity-40"
            >
              {acao === "gerar" ? "Gerando PDF…" : "Gerar PDF e salvar no Drive"}
            </button>
            <button
              type="button"
              onClick={() => setFormAberto(false)}
              disabled={pendente}
              className="min-h-12 rounded-xl border-2 border-line px-5 font-semibold text-ink-soft hover:bg-paper-deep"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erro && <p className="mt-3 text-sm font-semibold text-terracotta">{erro}</p>}
      {aviso && <p className="mt-3 text-sm font-semibold text-teal-deep">{aviso}</p>}

      {visitas.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          {visitas.map((v) => (
            <li key={v.id} className="flex flex-col gap-2 rounded-xl bg-paper p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-sm font-semibold">{v.codigo}</p>
                <p className="font-mono text-xs text-ink-soft">
                  gerado em {v.geradoEm} por {v.geradoPor}
                </p>
                <p className="font-mono text-xs text-ink-soft">
                  {v.enviado ? `enviado à escola em ${v.enviado}` : "ainda não enviado à escola"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {v.driveUrl && (
                  <a
                    href={v.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 items-center rounded-xl border-2 border-teal px-4 font-semibold text-teal-deep hover:bg-teal/10"
                  >
                    Abrir no Drive
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => enviar(v)}
                  disabled={pendente || !emailEscola || !v.driveUrl}
                  title={emailEscola ? undefined : "Escola sem e-mail cadastrado"}
                  className="min-h-11 rounded-xl bg-teal px-4 font-semibold text-white hover:bg-teal-deep disabled:opacity-40"
                >
                  {acao === `enviar-${v.id}` ? "Enviando…" : v.enviado ? "Reenviar à escola" : "Enviar à escola"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!emailEscola && visitas.length > 0 && (
        <p className="mt-2 text-xs text-ink-soft">Esta escola não tem e-mail cadastrado, então o envio está desativado.</p>
      )}
    </section>
  );
}
