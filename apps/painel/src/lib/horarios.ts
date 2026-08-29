import type { DadosDaExcecao, GradeSemanal } from '@agendamento/contratos';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.ts';
import { chavesDe } from './chaves.ts';
import { estabelecimentoAtual } from './estabelecimento-atual.ts';

function chaves() {
  const atual = estabelecimentoAtual();

  return atual === null ? null : chavesDe(atual);
}

export function useHorarios() {
  const escopo = chaves();

  return useQuery({
    queryKey: escopo?.horarios ?? ['horarios', 'sem-estabelecimento'],
    queryFn: () => api.listarHorarios(),
    enabled: escopo !== null,
    staleTime: 30_000,
  });
}

export function useExcecoes(de: string, ate: string) {
  const escopo = chaves();

  return useQuery({
    queryKey: escopo?.excecoes(`${de}..${ate}`) ?? ['excecoes', 'sem-estabelecimento'],
    queryFn: () => api.listarExcecoes({ query: { de, ate } }),
    enabled: escopo !== null,
    staleTime: 30_000,
  });
}

export function useDefinirGrade() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: ({ profissionalId, corpo }: { profissionalId: string; corpo: GradeSemanal }) =>
      api.definirGrade({ params: { profissionalId }, corpo }),
    onSuccess: (grades) => {
      const escopo = chaves();

      if (escopo !== null) {
        cliente.setQueryData(escopo.horarios, grades);
      }
    },
  });
}

/**
 * Bloqueio e disponibilidade extra mudam o que a agenda mostra, e o período
 * consultado varia — então aqui é invalidação por prefixo, não escrita no
 * cache: não há uma chave só para atualizar.
 */
function useEscritaDeExcecao<E, S>(enviar: (entrada: E) => Promise<S>) {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: enviar,
    onSuccess: async () => {
      const escopo = chaves();

      if (escopo !== null) {
        await cliente.invalidateQueries({ queryKey: escopo.excecoesTudo });
      }
    },
  });
}

export function useCriarExcecao() {
  return useEscritaDeExcecao((corpo: DadosDaExcecao) => api.criarExcecao({ corpo }));
}

export function useRemoverExcecao() {
  return useEscritaDeExcecao((id: string) => api.removerExcecao({ params: { id } }));
}
