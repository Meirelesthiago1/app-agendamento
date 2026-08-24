import type { UsuarioDaSessao } from '@agendamento/contratos';
import { eErroDaApi } from '@agendamento/contratos';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.ts';
import { CHAVES_GLOBAIS } from './chaves.ts';
import { encerrarSessaoLocal } from './consultas.ts';
import { definirEstabelecimentoAtual, estabelecimentoAtual } from './estabelecimento-atual.ts';

/**
 * Quem está logado. Devolve `null` em vez de erro quando não há sessão: a rota
 * de entrada e a de cadastro consultam isto, e "ninguém logado" ali é resposta
 * esperada, não falha.
 */
export async function buscarSessao(): Promise<UsuarioDaSessao | null> {
  try {
    return await api.eu();
  } catch (erro) {
    if (eErroDaApi(erro) && (erro.status === 403 || erro.status === 404)) {
      return null;
    }

    throw erro;
  }
}

export function useSessao() {
  return useQuery({
    queryKey: CHAVES_GLOBAIS.sessao,
    queryFn: buscarSessao,
    staleTime: 60_000,
  });
}

export function useEntrar() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (dados: { email: string; senha: string }) => api.entrar({ corpo: dados }),
    onSuccess: async () => {
      // A sessão só resolve os vínculos na requisição seguinte, quando o cookie
      // já viaja — por isso refaz a consulta em vez de aproveitar a resposta
      await cliente.invalidateQueries({ queryKey: CHAVES_GLOBAIS.sessao });
    },
  });
}

export function useSair() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: () => api.sair(),
    onSuccess: () => encerrarSessaoLocal(cliente),
  });
}

/**
 * Mantém a escolha do estabelecimento coerente com os vínculos que a sessão
 * devolveu: se o que estava guardado no navegador não é mais um deles — vínculo
 * removido, ou outra conta na mesma máquina —, cai para o primeiro disponível.
 */
export function ajustarEstabelecimento(sessao: UsuarioDaSessao | null): void {
  if (sessao === null) {
    return;
  }

  const disponiveis = sessao.estabelecimentos.map((e) => e.id);
  const guardado = estabelecimentoAtual();

  if (guardado !== null && disponiveis.includes(guardado)) {
    return;
  }

  definirEstabelecimentoAtual(disponiveis[0] ?? null);
}
