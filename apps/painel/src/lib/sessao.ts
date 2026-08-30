import type { UsuarioDaSessao } from '@agendamento/contratos';
import { eErroDaApi } from '@agendamento/contratos';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { api } from './api.ts';
import { CHAVES_GLOBAIS } from './chaves.ts';
import { encerrarSessaoLocal, trocarEstabelecimento } from './consultas.ts';
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

/**
 * Aceitar convite é o **único** caminho de entrada de quem ainda não tem senha
 * (2.2). Define a senha e já abre sessão, então invalida a sessão em cache pelo
 * mesmo motivo do login: os vínculos só resolvem na requisição seguinte.
 */
export function useAceitarConvite() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (dados: { token: string; senha: string }) => api.aceitarConvite({ corpo: dados }),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: CHAVES_GLOBAIS.sessao });
    },
  });
}

export function usePedirRecuperacao() {
  return useMutation({
    mutationFn: (email: string) => api.pedirRecuperacao({ corpo: { email } }),
  });
}

/** Redefinir revoga **todas** as sessões, inclusive a de quem está redefinindo. */
export function useRedefinirSenha() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (dados: { token: string; senha: string }) => api.redefinirSenha({ corpo: dados }),
    onSuccess: () => encerrarSessaoLocal(cliente),
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
 * Trocar de estabelecimento são três passos que precisam acontecer juntos:
 * gravar a escolha, invalidar as consultas e revalidar o roteador. Duas cópias
 * disso — o seletor do desktop e o menu do celular — divergiriam na primeira
 * vez que um passo mudasse, e a que ficasse para trás mostraria dado do
 * estabelecimento anterior sem errar nada visível.
 */
export function useTrocarEstabelecimento() {
  const cliente = useQueryClient();
  const roteador = useRouter();

  return useCallback(
    async (id: string) => {
      trocarEstabelecimento(id);
      await cliente.invalidateQueries();
      await roteador.invalidate();
    },
    [cliente, roteador],
  );
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
