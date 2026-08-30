import type {
  ConfiguracaoCompleta,
  DadosDoEstabelecimento,
  Politicas,
} from '@agendamento/contratos';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.ts';
import { chavesDe } from './chaves.ts';
import { estabelecimentoAtual } from './estabelecimento-atual.ts';

/**
 * A chave depende do estabelecimento corrente, e `chavesDe` é o único caminho
 * até ela. Sem escolha ainda feita, a consulta fica desabilitada em vez de
 * inventar um id — perguntar pela configuração de ninguém não tem resposta.
 */
function chave() {
  const atual = estabelecimentoAtual();

  return atual === null ? null : chavesDe(atual).configuracao;
}

export function useConfiguracao() {
  const queryKey = chave();

  return useQuery({
    queryKey: queryKey ?? ['configuracao', 'sem-estabelecimento'],
    queryFn: () => api.obterConfiguracao(),
    enabled: queryKey !== null,
    staleTime: 30_000,
  });
}

/**
 * As duas mutações escrevem a resposta direto no cache em vez de invalidar: o
 * servidor devolve a configuração inteira já salva, então buscar de novo seria
 * uma ida a mais para chegar ao mesmo lugar — e deixaria a tela piscando o
 * valor antigo no meio do caminho.
 */
function useEscrita<E>(enviar: (entrada: E) => Promise<ConfiguracaoCompleta>) {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: enviar,
    onSuccess: (salva) => {
      const queryKey = chave();

      if (queryKey !== null) {
        cliente.setQueryData(queryKey, salva);
      }
    },
  });
}

export function useSalvarEstabelecimento() {
  return useEscrita((corpo: DadosDoEstabelecimento) => api.atualizarEstabelecimento({ corpo }));
}

export function useSalvarPoliticas() {
  return useEscrita((corpo: Politicas) => api.atualizarPoliticas({ corpo }));
}
