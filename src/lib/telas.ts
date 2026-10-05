// Opções do formulário de vistoria das telas interativas.
// Valores gravados no banco são slugs; rótulos são só para exibição.

export const MARCAS_TELA = ["Smart Tech", "Dahua", "Quinyx", "Outra"] as const;

// Categorias de escola que podem ter telas interativas.
export const CATEGORIAS_COM_TELAS = ["EMEF", "EMEI", "CEIA"];

export const OPCOES_VISTORIA = {
  funcionando: [
    { valor: "sim", rotulo: "Sim" },
    { valor: "nao", rotulo: "Não" },
    { valor: "somente_android", rotulo: "Somente o Android" },
    { valor: "somente_ops", rotulo: "Somente o OPS" },
  ],
  emailInstalado: [
    { valor: "sim", rotulo: "Sim" },
    { valor: "nao", rotulo: "Não" },
    { valor: "nao_se_aplica", rotulo: "Não se aplica" },
  ],
  internet: [
    { valor: "cabo", rotulo: "Sim, via cabo" },
    { valor: "wifi", rotulo: "Sim, via Wi-Fi" },
    { valor: "nao", rotulo: "Não" },
  ],
  atualizada: [
    { valor: "sim", rotulo: "Sim" },
    { valor: "nao", rotulo: "Não" },
    { valor: "em_andamento", rotulo: "Em andamento" },
  ],
  som: [
    { valor: "sim", rotulo: "Sim" },
    { valor: "nao", rotulo: "Não" },
    { valor: "com_chiado", rotulo: "Com chiado" },
  ],
} as const;

export type CampoOpcao = keyof typeof OPCOES_VISTORIA;

export const PERGUNTAS: Record<CampoOpcao, string> = {
  funcionando: "A tela está funcionando?",
  emailInstalado: "O e-mail institucional está instalado?",
  internet: "A tela tem acesso à internet?",
  atualizada: "A tela está atualizada?",
  som: "O som está funcionando?",
};

export function rotuloOpcao(campo: CampoOpcao, valor: string | null): string {
  if (!valor) return "—";
  return OPCOES_VISTORIA[campo].find((o) => o.valor === valor)?.rotulo ?? valor;
}

// Tom visual de cada resposta: ok (verde), parcial (âmbar), problema (terracota).
export function tomOpcao(valor: string | null): "ok" | "parcial" | "problema" | "neutro" {
  if (!valor || valor === "nao_se_aplica") return "neutro";
  if (valor === "sim" || valor === "cabo" || valor === "wifi") return "ok";
  if (valor === "nao") return "problema";
  return "parcial";
}

export type DadosVistoria = {
  dataVisita: string; // AAAA-MM-DD
  marca: string;
  sala: string;
  funcionando: string;
  emailInstalado: string;
  internet: string;
  atualizada: string;
  som: string;
  apps: string[];
  medidasRealizadas: string;
  anotacoes: string;
};

// Normaliza e valida os dados vindos do cliente. Lança erro com mensagem legível.
export function validarVistoria(d: DadosVistoria): DadosVistoria {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dataVisita)) throw new Error("Data da visita inválida");
  if (!(MARCAS_TELA as readonly string[]).includes(d.marca)) throw new Error("Marca inválida");

  for (const campo of Object.keys(OPCOES_VISTORIA) as CampoOpcao[]) {
    if (!OPCOES_VISTORIA[campo].some((o) => o.valor === d[campo])) {
      throw new Error(`Resposta inválida em "${PERGUNTAS[campo]}"`);
    }
  }

  const sala = d.sala.trim();
  if (!sala) throw new Error("Informe a sala");

  // apps: remove vazios e repetidos (sem diferenciar maiúsculas)
  const vistos = new Set<string>();
  const apps = d.apps
    .map((a) => a.trim())
    .filter((a) => {
      const chave = a.toLowerCase();
      if (!a || vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });

  return {
    ...d,
    sala,
    apps,
    medidasRealizadas: d.medidasRealizadas.trim(),
    anotacoes: d.anotacoes.trim(),
  };
}

// Data AAAA-MM-DD -> DD/MM/AAAA, sem passar por Date (evita deslocamento de fuso).
export function formatarData(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const ROTULO_CAMPO: Record<string, string> = {
  dataVisita: "Data da visita",
  marca: "Marca",
  sala: "Sala",
  funcionando: "Funcionando",
  emailInstalado: "E-mail institucional",
  internet: "Internet",
  atualizada: "Atualizada",
  som: "Som",
  apps: "Apps",
  medidasRealizadas: "Medidas realizadas",
  anotacoes: "Anotações",
};

function formatarValor(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "vazio";
  if (Array.isArray(valor)) return valor.length ? valor.join(", ") : "nenhum";
  if (campo === "dataVisita") return formatarData(String(valor));
  if (campo in OPCOES_VISTORIA) return rotuloOpcao(campo as CampoOpcao, String(valor));
  return String(valor);
}

// Transforma o jsonb { campo: { de, para } } do histórico em linhas legíveis.
export function descreverAlteracoes(alteracoes: Record<string, { de: unknown; para: unknown }>) {
  return Object.entries(alteracoes).map(([campo, { de, para }]) => ({
    campo: ROTULO_CAMPO[campo] ?? campo,
    de: formatarValor(campo, de),
    para: formatarValor(campo, para),
  }));
}
