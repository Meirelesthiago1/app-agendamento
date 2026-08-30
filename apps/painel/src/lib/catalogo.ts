import type { CatalogoDoPainel, DadosDaCategoria, DadosDoServico } from '@agendamento/contratos';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.ts';
import { chavesDe } from './chaves.ts';
import { estabelecimentoAtual } from './estabelecimento-atual.ts';

function chave() {
  const atual = estabelecimentoAtual();

  return atual === null ? null : chavesDe(atual).catalogo;
}

export function useCatalogo() {
  const queryKey = chave();

  return useQuery({
    queryKey: queryKey ?? ['catalogo', 'sem-estabelecimento'],
    queryFn: () => api.listarCatalogo(),
    enabled: queryKey !== null,
    staleTime: 30_000,
  });
}

/**
 * Toda escrita do catálogo devolve o catálogo inteiro, então a resposta vai
 * direto para o cache. Uma categoria removida solta os serviços dela: invalidar
 * e refazer mostraria por um instante o estado anterior, com o serviço ainda
 * agrupado no que já não existe.
 */
function useEscrita<E>(enviar: (entrada: E) => Promise<CatalogoDoPainel>) {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: enviar,
    onSuccess: (catalogo) => {
      const queryKey = chave();

      if (queryKey !== null) {
        cliente.setQueryData(queryKey, catalogo);
      }
    },
  });
}

export function useCriarCategoria() {
  return useEscrita((corpo: DadosDaCategoria) => api.criarCategoria({ corpo }));
}

export function useAtualizarCategoria() {
  return useEscrita(({ id, corpo }: { id: string; corpo: DadosDaCategoria }) =>
    api.atualizarCategoria({ params: { id }, corpo }),
  );
}

export function useRemoverCategoria() {
  return useEscrita((id: string) => api.removerCategoria({ params: { id } }));
}

export function useCriarServico() {
  return useEscrita((corpo: DadosDoServico) => api.criarServico({ corpo }));
}

export function useAtualizarServico() {
  return useEscrita(({ id, corpo }: { id: string; corpo: DadosDoServico }) =>
    api.atualizarServico({ params: { id }, corpo }),
  );
}

export function useDefinirServicoAtivo() {
  return useEscrita(({ id, ativo }: { id: string; ativo: boolean }) =>
    api.definirServicoAtivo({ params: { id }, corpo: { ativo } }),
  );
}
