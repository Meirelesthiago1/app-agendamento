import { eErroDaApi } from '@agendamento/contratos';
import { QueryClient } from '@tanstack/react-query';
import { definirEstabelecimentoAtual } from './estabelecimento-atual.ts';

/** Códigos em que repetir a requisição não muda nada. */
const SEM_SEGUNDA_CHANCE = new Set([400, 401, 403, 404, 409, 422]);

export function criarQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (tentativas, erro) => {
          if (eErroDaApi(erro) && SEM_SEGUNDA_CHANCE.has(erro.status)) {
            return false;
          }

          return tentativas < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

/**
 * Trocar de estabelecimento **não** limpa o cache. Com o id na chave, cada
 * estabelecimento já é uma entrada distinta, e voltar para o anterior é
 * instantâneo. `clear()` fica reservado ao logout, onde manter dado de outra
 * pessoa na memória do navegador seria o erro.
 */
export function trocarEstabelecimento(id: string): void {
  definirEstabelecimentoAtual(id);
}

export function encerrarSessaoLocal(cliente: QueryClient): void {
  definirEstabelecimentoAtual(null);
  cliente.clear();
}
