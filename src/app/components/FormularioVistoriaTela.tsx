"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { editarVistoriaTela, registrarVistoriaTela } from "@/app/escola/[id]/actions";
import {
  MARCAS_TELA,
  OPCOES_VISTORIA,
  PERGUNTAS,
  type CampoOpcao,
  type DadosVistoria,
} from "@/lib/telas";

export type ModoFormulario =
  | { tipo: "novo"; escolaId: number; patrimonio?: string }
  | { tipo: "editar"; vistoriaId: number; patrimonio: string };

function hojeEmCanoas() {
  // en-CA formata como AAAA-MM-DD, o formato do <input type="date">
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const VAZIO: Omit<DadosVistoria, "dataVisita"> = {
  marca: "",
  sala: "",
  funcionando: "",
  emailInstalado: "",
  internet: "",
  atualizada: "",
  som: "",
  apps: [],
  medidasRealizadas: "",
  anotacoes: "",
};

const ROTULO = "font-mono text-xs uppercase tracking-widest text-ink-soft";
const CAMPO =
  "min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 text-base outline-none focus:border-teal";

export default function FormularioVistoriaTela({
  modo,
  valoresIniciais,
  aoConcluir,
  aoCancelar,
}: {
  modo: ModoFormulario;
  valoresIniciais?: Partial<DadosVistoria>;
  aoConcluir: () => void;
  aoCancelar: () => void;
}) {
  const [patrimonio, setPatrimonio] = useState(modo.patrimonio ?? "");
  const [dados, setDados] = useState<DadosVistoria>({
    ...VAZIO,
    dataVisita: hojeEmCanoas(),
    ...valoresIniciais,
  });
  const [novoApp, setNovoApp] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [outraEscola, setOutraEscola] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const patrimonioFixo = modo.tipo === "editar" || !!modo.patrimonio;

  function alterar<K extends keyof DadosVistoria>(campo: K, valor: DadosVistoria[K]) {
    setDados((d) => ({ ...d, [campo]: valor }));
  }

  function adicionarApp() {
    const nome = novoApp.trim();
    if (!nome) return;
    if (!dados.apps.some((a) => a.toLowerCase() === nome.toLowerCase())) {
      alterar("apps", [...dados.apps, nome]);
    }
    setNovoApp("");
  }

  function aoTeclarApp(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault(); // Enter aqui adiciona o app, não envia o formulário
      adicionarApp();
    }
  }

  function enviar(confirmarMudancaEscola = false) {
    setErro(null);
    // app digitado mas não adicionado ainda entra junto
    const pendenteApp = novoApp.trim();
    const dadosEnvio = pendenteApp ? { ...dados, apps: [...dados.apps, pendenteApp] } : dados;

    iniciar(async () => {
      try {
        const r =
          modo.tipo === "novo"
            ? await registrarVistoriaTela(modo.escolaId, patrimonio, dadosEnvio, confirmarMudancaEscola)
            : await editarVistoriaTela(modo.vistoriaId, dadosEnvio);

        if (r.ok) {
          aoConcluir();
        } else if ("outraEscola" in r) {
          setOutraEscola(r.outraEscola);
        } else {
          setErro(r.erro);
        }
      } catch {
        setErro("Não foi possível salvar. Verifique a conexão e tente de novo.");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      className="flex flex-col gap-5 rounded-2xl border-2 border-teal bg-white p-5"
    >
      <h3 className="font-display text-xl font-semibold text-teal-deep">
        {modo.tipo === "novo" ? "Registrar vistoria" : `Editar vistoria — ${modo.patrimonio}`}
      </h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={ROTULO}>Data da visita</span>
          <input
            type="date"
            required
            value={dados.dataVisita}
            onChange={(e) => alterar("dataVisita", e.target.value)}
            className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={ROTULO}>Número do patrimônio</span>
          <input
            type="text"
            required
            value={patrimonio}
            readOnly={patrimonioFixo}
            onChange={(e) => setPatrimonio(e.target.value)}
            className={`${CAMPO} font-mono ${patrimonioFixo ? "bg-paper-deep text-ink-soft" : ""}`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={ROTULO}>Marca</span>
          <select
            required
            value={dados.marca}
            onChange={(e) => alterar("marca", e.target.value)}
            className={CAMPO}
          >
            <option value="" disabled>
              — selecione —
            </option>
            {MARCAS_TELA.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={ROTULO}>Sala</span>
          <input
            type="text"
            required
            value={dados.sala}
            onChange={(e) => alterar("sala", e.target.value)}
            placeholder="Ex: Sala 04 / Laboratório"
            className={CAMPO}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(Object.keys(OPCOES_VISTORIA) as CampoOpcao[]).map((campo) => (
          <label key={campo} className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-ink">{PERGUNTAS[campo]}</span>
            <select
              required
              value={dados[campo]}
              onChange={(e) => alterar(campo, e.target.value)}
              className={CAMPO}
            >
              <option value="" disabled>
                — selecione —
              </option>
              {OPCOES_VISTORIA[campo].map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className={ROTULO}>Apps instalados</span>
        {dados.apps.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {dados.apps.map((app) => (
              <li
                key={app}
                className="flex items-center gap-1 rounded-full bg-paper-deep py-1 pl-3 pr-1 text-sm"
              >
                {app}
                <button
                  type="button"
                  onClick={() => alterar("apps", dados.apps.filter((a) => a !== app))}
                  aria-label={`Remover ${app}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft hover:bg-line"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={novoApp}
            onChange={(e) => setNovoApp(e.target.value)}
            onKeyDown={aoTeclarApp}
            placeholder="Nome do app encontrado na tela"
            className={CAMPO}
          />
          <button
            type="button"
            onClick={adicionarApp}
            className="min-h-12 shrink-0 rounded-xl border-2 border-teal px-4 font-semibold text-teal-deep hover:bg-teal/10"
          >
            Adicionar
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className={ROTULO}>Medidas realizadas</span>
        <textarea
          rows={2}
          value={dados.medidasRealizadas}
          onChange={(e) => alterar("medidasRealizadas", e.target.value)}
          placeholder="Ex: troca de cabo de rede, atualização do sistema…"
          className="w-full rounded-xl border-2 border-line bg-white p-3 text-base outline-none focus:border-teal"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={ROTULO}>Anotações</span>
        <textarea
          rows={2}
          value={dados.anotacoes}
          onChange={(e) => alterar("anotacoes", e.target.value)}
          placeholder="Pendências, recomendações para a próxima visita…"
          className="w-full rounded-xl border-2 border-line bg-white p-3 text-base outline-none focus:border-teal"
        />
      </label>

      {outraEscola && (
        <div className="rounded-xl border-2 border-amber bg-amber/15 p-4 text-sm">
          <p className="font-semibold text-ink">
            Esta tela está registrada em <strong>{outraEscola}</strong>.
          </p>
          <p className="mt-1 text-ink-soft">
            Se ela foi transferida para esta escola, confirme para mover o registro. O histórico de
            vistorias anteriores é mantido.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pendente}
              onClick={() => enviar(true)}
              className="min-h-11 rounded-xl bg-teal px-4 font-semibold text-white disabled:opacity-60"
            >
              Sim, transferir para esta escola
            </button>
            <button
              type="button"
              onClick={() => setOutraEscola(null)}
              className="min-h-11 rounded-xl border border-line bg-white px-4 font-semibold text-ink-soft"
            >
              Corrigir patrimônio
            </button>
          </div>
        </div>
      )}

      {erro && <p className="text-sm font-semibold text-terracotta">{erro}</p>}

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <button
          type="button"
          onClick={aoCancelar}
          className="min-h-12 rounded-xl border border-line px-5 font-semibold text-ink-soft hover:bg-paper-deep"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pendente || !!outraEscola}
          className="min-h-12 rounded-xl bg-teal px-6 font-semibold text-white disabled:opacity-60"
        >
          {pendente ? "Salvando…" : modo.tipo === "novo" ? "Salvar vistoria" : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
