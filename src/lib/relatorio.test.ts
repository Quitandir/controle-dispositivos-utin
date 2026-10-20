import { describe, it, expect } from 'vitest'
import { codigoRelatorio } from './relatorio'

/*
export function codigoRelatorio(ano: number, numero: number, versao: number): string {
  const base = `REL-${ano}-${String(numero).padStart(4, "0")}`;
  return versao > 1 ? `${base} v${versao}` : base;
}
*/

describe('codigoRelatorio', () => {
  it("confere se retorna uma string com a estrutura REL-ano-número", () => {
    expect(codigoRelatorio(2026, 1, 1)).toBe("REL-2026-0001")
  });

  it("confere se a partir da versão 2, o nome recebe v...", () => {
    expect(codigoRelatorio(2026, 111, 2)).toBe("REL-2026-0111 v2")
  });

  it("confere se uma versão com 2 dígitos aparece como vXX na string", () => {
    expect(codigoRelatorio(2026, 111, 20)).toBe("REL-2026-0111 v20")
  });

  it("confere se um número com 3 dígitos é completado com apenas um zero antes dos 3 dígitos.", () => {
    expect(codigoRelatorio(2026, 111, 1)).toBe("REL-2026-0111")
  });

  it("confere se um número com 5 dígitos não é cortado, aparecendo todos os cinco na string.", () => {
    expect(codigoRelatorio(2026, 11111, 1)).toBe("REL-2026-11111")
  });

  it("confere se o teste falha ao não completar o número para ter 4 dígitos", () => {
    expect(codigoRelatorio(2026, 1, 1)).toBe("REL-2026-1")
  });
})
