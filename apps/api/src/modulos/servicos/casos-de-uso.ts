import { ErroDominio, podeExecutar } from '@agendamento/dominio';
import type { Contexto } from '../../contexto.ts';
import { type Transacao, unidadeDeTrabalho } from '../../infra/db/pools.ts';
import * as repo from './catalogo.ts';

export type DadosDaCategoria = repo.DadosDaCategoria;
export type DadosDoServico = repo.DadosDoServico;

function exigirEscrita(contexto: Contexto): void {
  if (
    contexto.papel === null ||
    !podeExecutar(
      { papel: contexto.papel, profissionalId: contexto.profissionalId },
      'servicos.escrever',
    )
  ) {
    throw new ErroDominio('SEM_PERMISSAO', 'Seu perfil não permite alterar o catálogo.');
  }
}

/**
 * Toda escrita devolve o catálogo inteiro. Uma categoria removida solta os
 * serviços dela, e criar um serviço muda a contagem da categoria — devolver só
 * o que foi tocado deixaria a outra metade da tela desatualizada.
 */
async function montar(contexto: Contexto, tx: Transacao) {
  const categorias = await repo.listarCategorias(tx, contexto.estabelecimentoId);
  const servicos = await repo.listarParaGestao(tx, contexto.estabelecimentoId);

  return { categorias, servicos };
}

function exigirAlteracao(alteradas: number): void {
  if (alteradas === 0) {
    throw new ErroDominio('NAO_ENCONTRADO', 'Este item não existe mais.');
  }
}

export async function listar(contexto: Contexto) {
  return unidadeDeTrabalho(contexto, (tx) => montar(contexto, tx));
}

export async function criarCategoria(contexto: Contexto, dados: DadosDaCategoria) {
  exigirEscrita(contexto);

  return unidadeDeTrabalho(contexto, async (tx) => {
    await repo.criarCategoria(tx, contexto.estabelecimentoId, dados);

    return montar(contexto, tx);
  });
}

export async function atualizarCategoria(contexto: Contexto, id: string, dados: DadosDaCategoria) {
  exigirEscrita(contexto);

  return unidadeDeTrabalho(contexto, async (tx) => {
    exigirAlteracao(await repo.atualizarCategoria(tx, contexto.estabelecimentoId, id, dados));

    return montar(contexto, tx);
  });
}

export async function removerCategoria(contexto: Contexto, id: string) {
  exigirEscrita(contexto);

  return unidadeDeTrabalho(contexto, async (tx) => {
    exigirAlteracao(await repo.removerCategoria(tx, contexto.estabelecimentoId, id));

    return montar(contexto, tx);
  });
}

async function exigirSlugLivre(
  tx: Transacao,
  estabelecimentoId: string,
  slug: string,
  exceto: string | null,
): Promise<void> {
  if (!(await repo.slugDeServicoLivre(tx, estabelecimentoId, slug, exceto))) {
    throw new ErroDominio('CONFLITO', 'Já existe um serviço com este endereço.');
  }
}

export async function criarServico(contexto: Contexto, dados: DadosDoServico) {
  exigirEscrita(contexto);

  return unidadeDeTrabalho(contexto, async (tx) => {
    await exigirSlugLivre(tx, contexto.estabelecimentoId, dados.slug, null);
    await repo.criarServico(tx, contexto.estabelecimentoId, dados);

    return montar(contexto, tx);
  });
}

export async function atualizarServico(contexto: Contexto, id: string, dados: DadosDoServico) {
  exigirEscrita(contexto);

  return unidadeDeTrabalho(contexto, async (tx) => {
    await exigirSlugLivre(tx, contexto.estabelecimentoId, dados.slug, id);
    exigirAlteracao(await repo.atualizarServico(tx, contexto.estabelecimentoId, id, dados));

    return montar(contexto, tx);
  });
}

/**
 * 6.3: desativar serviço com agenda futura é **bloqueado até resolver**. As duas
 * saídas que a regra oferece — transferência em lote e cancelamento com aviso —
 * vivem na tela de resolução da etapa 9; aqui o que existe é a recusa, e ela diz
 * quantos agendamentos a causam.
 *
 * Reativar nunca é bloqueado: só devolve o serviço à vitrine.
 */
export async function definirServicoAtivo(contexto: Contexto, id: string, ativo: boolean) {
  exigirEscrita(contexto);

  return unidadeDeTrabalho(contexto, async (tx) => {
    if (!ativo) {
      const futuros = await repo.contarAgendaFuturaDoServico(
        tx,
        contexto.estabelecimentoId,
        id,
        new Date(),
      );

      if (futuros > 0) {
        throw new ErroDominio(
          'CONFLITO',
          futuros === 1
            ? 'Há um agendamento futuro com este serviço. Resolva-o antes de desativar.'
            : `Há ${futuros} agendamentos futuros com este serviço. Resolva-os antes de desativar.`,
        );
      }
    }

    exigirAlteracao(await repo.definirAtivo(tx, contexto.estabelecimentoId, id, ativo));

    return montar(contexto, tx);
  });
}
