import { ErroDominio, podeExecutar } from '@agendamento/dominio';
import type { Contexto } from '../../contexto.ts';
import { type Transacao, unidadeDeTrabalho } from '../../infra/db/pools.ts';
import * as repo from './equipe.ts';

export type DadosDoProfissional = repo.DadosDoProfissional;
export type LigacaoDeServico = repo.LigacaoDeServico;

function exigirEscrita(contexto: Contexto): void {
  if (
    contexto.papel === null ||
    !podeExecutar(
      { papel: contexto.papel, profissionalId: contexto.profissionalId },
      'profissionais.escrever',
    )
  ) {
    throw new ErroDominio('SEM_PERMISSAO', 'Seu perfil não permite alterar a equipe.');
  }
}

/**
 * Profissionais e acessos vêm juntos porque são as três combinações de 2.4 numa
 * tela só: quem atende sem login, quem atende com login, e quem tem login sem
 * atender. Separar em duas respostas esconderia justamente a relação entre elas.
 */
async function montar(contexto: Contexto, tx: Transacao) {
  const profissionais = await repo.listarProfissionais(tx, contexto.estabelecimentoId);
  const acessos = await repo.listarAcessos(tx, contexto.estabelecimentoId);

  return { profissionais, acessos };
}

function exigirAlteracao(alterados: number): void {
  if (alterados === 0) {
    throw new ErroDominio('NAO_ENCONTRADO', 'Esta pessoa não está mais na equipe.');
  }
}

/**
 * Ligar profissional a um acesso de outro estabelecimento daria a essa pessoa a
 * agenda deste. A RLS de `vinculos` já não deixaria ler o de fora, mas a
 * verificação explícita transforma o silêncio em recusa com motivo.
 */
async function exigirVinculoDoTenant(
  contexto: Contexto,
  tx: Transacao,
  vinculoId: string | null,
): Promise<void> {
  if (vinculoId === null) {
    return;
  }

  if (!(await repo.vinculoEhDoTenant(tx, contexto.estabelecimentoId, vinculoId))) {
    throw new ErroDominio('NAO_ENCONTRADO', 'Este acesso não existe neste estabelecimento.');
  }
}

export async function listar(contexto: Contexto) {
  return unidadeDeTrabalho(contexto, (tx) => montar(contexto, tx));
}

export async function criarProfissional(contexto: Contexto, dados: DadosDoProfissional) {
  exigirEscrita(contexto);

  return unidadeDeTrabalho(contexto, async (tx) => {
    await exigirVinculoDoTenant(contexto, tx, dados.vinculoId);
    await repo.criarProfissional(tx, contexto.estabelecimentoId, dados);

    return montar(contexto, tx);
  });
}

export async function atualizarProfissional(
  contexto: Contexto,
  id: string,
  dados: DadosDoProfissional,
) {
  exigirEscrita(contexto);

  return unidadeDeTrabalho(contexto, async (tx) => {
    await exigirVinculoDoTenant(contexto, tx, dados.vinculoId);
    exigirAlteracao(await repo.atualizarProfissional(tx, contexto.estabelecimentoId, id, dados));

    return montar(contexto, tx);
  });
}

/**
 * 6.3, o mesmo que vale para serviço: desativar com agenda futura é bloqueado, e
 * a recusa diz quantos agendamentos a causam. Transferência em lote e
 * cancelamento com aviso ficam na tela de resolução da etapa 9.
 */
export async function definirProfissionalAtivo(contexto: Contexto, id: string, ativo: boolean) {
  exigirEscrita(contexto);

  return unidadeDeTrabalho(contexto, async (tx) => {
    if (!ativo) {
      const futuros = await repo.contarAgendaFuturaDoProfissional(
        tx,
        contexto.estabelecimentoId,
        id,
        new Date(),
      );

      if (futuros > 0) {
        throw new ErroDominio(
          'CONFLITO',
          futuros === 1
            ? 'Há um agendamento futuro com esta pessoa. Resolva-o antes de desativar.'
            : `Há ${futuros} agendamentos futuros com esta pessoa. Resolva-os antes de desativar.`,
        );
      }
    }

    exigirAlteracao(await repo.definirAtivo(tx, contexto.estabelecimentoId, id, ativo));

    return montar(contexto, tx);
  });
}

export async function definirServicosDoProfissional(
  contexto: Contexto,
  id: string,
  servicos: readonly LigacaoDeServico[],
) {
  exigirEscrita(contexto);

  return unidadeDeTrabalho(contexto, async (tx) => {
    if (!(await repo.existeProfissional(tx, contexto.estabelecimentoId, id))) {
      throw new ErroDominio('NAO_ENCONTRADO', 'Esta pessoa não está mais na equipe.');
    }

    // A FK recusaria serviço de outro tenant, mas com erro de constraint. Aqui
    // a RLS já limitou o que a transação enxerga: o insert falha como 404 legível
    await repo.definirServicos(tx, contexto.estabelecimentoId, id, servicos);

    return montar(contexto, tx);
  });
}
