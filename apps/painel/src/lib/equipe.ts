import type {
  DadosDoProfissional,
  EquipeCompleta,
  ServicosDoProfissional,
} from '@agendamento/contratos';
import type { Papel } from '@agendamento/dominio';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.ts';
import { chavesDe } from './chaves.ts';
import { estabelecimentoAtual } from './estabelecimento-atual.ts';

function chave() {
  const atual = estabelecimentoAtual();

  return atual === null ? null : chavesDe(atual).equipe;
}

export function useEquipe() {
  const queryKey = chave();

  return useQuery({
    queryKey: queryKey ?? ['equipe', 'sem-estabelecimento'],
    queryFn: () => api.listarEquipe(),
    enabled: queryKey !== null,
    staleTime: 30_000,
  });
}

function useEscrita<E>(enviar: (entrada: E) => Promise<EquipeCompleta>) {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: enviar,
    onSuccess: (equipe) => {
      const queryKey = chave();

      if (queryKey !== null) {
        cliente.setQueryData(queryKey, equipe);
      }
    },
  });
}

export function useCriarProfissional() {
  return useEscrita((corpo: DadosDoProfissional) => api.criarProfissional({ corpo }));
}

export function useAtualizarProfissional() {
  return useEscrita(({ id, corpo }: { id: string; corpo: DadosDoProfissional }) =>
    api.atualizarProfissional({ params: { id }, corpo }),
  );
}

export function useDefinirProfissionalAtivo() {
  return useEscrita(({ id, ativo }: { id: string; ativo: boolean }) =>
    api.definirProfissionalAtivo({ params: { id }, corpo: { ativo } }),
  );
}

export function useDefinirServicosDoProfissional() {
  return useEscrita(({ id, corpo }: { id: string; corpo: ServicosDoProfissional }) =>
    api.definirServicosDoProfissional({ params: { id }, corpo }),
  );
}

/**
 * O convite já existia na etapa 5, e é o que cria um acesso. Invalida a equipe
 * porque o novo vínculo entra na lista de acessos, mesmo antes de ser aceito.
 */
export function useConvidar() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (corpo: { nome: string; email: string; papel: Papel }) => api.convidar({ corpo }),
    onSuccess: async () => {
      const queryKey = chave();

      if (queryKey !== null) {
        await cliente.invalidateQueries({ queryKey });
      }
    },
  });
}
