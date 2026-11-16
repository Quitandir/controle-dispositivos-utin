export const GRUPOS_ESCOLA = [
  { chave: "emef", rotulo: "EMEF" },
  { chave: "emei", rotulo: "EMEI" },
  { chave: "outras", rotulo: "Outras Instituições" },
] as const;

export type GrupoEscola = (typeof GRUPOS_ESCOLA)[number]["chave"];

// Card ligado à UO de Chromebooks extraviados do Admin Console: só exibe a lista (sem status nem
// relatório), para o time procurar nas anotações os extraviados da escola que está visitando.
export const CATEGORIA_EXTRAVIADOS = "Extraviados";

// CEIA, Administrativo, Extraviados e unidades sem categoria ficam em "Outras Instituições".
export function grupoDaEscola(categoria: string | null): GrupoEscola {
  if (categoria === "EMEF") return "emef";
  if (categoria === "EMEI") return "emei";
  return "outras";
}
