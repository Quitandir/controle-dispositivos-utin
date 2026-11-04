export const GRUPOS_ESCOLA = [
  { chave: "emef", rotulo: "EMEF" },
  { chave: "emei", rotulo: "EMEI" },
  { chave: "outras", rotulo: "Outras Instituições" },
] as const;

export type GrupoEscola = (typeof GRUPOS_ESCOLA)[number]["chave"];

// CEIA, Administrativo e unidades sem categoria ficam em "Outras Instituições".
export function grupoDaEscola(categoria: string | null): GrupoEscola {
  if (categoria === "EMEF") return "emef";
  if (categoria === "EMEI") return "emei";
  return "outras";
}
