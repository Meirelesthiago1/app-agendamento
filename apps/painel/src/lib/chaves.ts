/**
 * As chaves de cache do TanStack Query.
 *
 * `estabelecimentoId` entra na chave de **toda** listagem escopada, e isso
 * precisa ser garantido por construção, não por disciplina: sem ele, trocar de
 * estabelecimento mostra dados em cache do anterior — bug silencioso, e caro de
 * achar depois porque a tela parece certa.
 *
 * A garantia aqui é que `chavesDe` é o único caminho para uma chave escopada, e
 * ele já embute o id na raiz. Há teste percorrendo o que ele devolve.
 */

const RAIZ = 'estabelecimento';

/** As únicas chaves legitimamente fora de um estabelecimento. */
export const CHAVES_GLOBAIS = {
  sessao: ['sessao'] as const,
};

export function chavesDe(estabelecimentoId: string) {
  const raiz = [RAIZ, estabelecimentoId] as const;

  return {
    /** Prefixo do estabelecimento inteiro, para invalidar tudo dele de uma vez. */
    tudo: raiz,
    catalogo: [...raiz, 'catalogo'] as const,
    equipe: [...raiz, 'equipe'] as const,
    servicos: [...raiz, 'servicos'] as const,
    clientes: (filtro: string) => [...raiz, 'clientes', filtro] as const,
    agendaDoDia: (data: string) => [...raiz, 'agenda', data] as const,
    caixa: (periodo: string) => [...raiz, 'caixa', periodo] as const,
  };
}

export type ChavesDoEstabelecimento = ReturnType<typeof chavesDe>;

export function ehChaveEscopada(chave: readonly unknown[], estabelecimentoId: string): boolean {
  return chave[0] === RAIZ && chave[1] === estabelecimentoId;
}
