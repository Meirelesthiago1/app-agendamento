import { ErroDominio, podeExecutarSobre } from '@agendamento/dominio';
import { DateTime } from 'luxon';
import type { Contexto } from '../../contexto.ts';
import { type Transacao, unidadeDeTrabalho } from '../../infra/db/pools.ts';
import * as repoEstabelecimentos from '../estabelecimentos/repositorio.ts';
import * as repo from './grade.ts';

export type Faixa = repo.Faixa;
export type DadosDaExcecao = repo.DadosDaExcecao;

/**
 * A data civil do estabelecimento, não a do servidor. "A partir de hoje" (6.5)
 * é hoje no fuso de quem trabalha: às 22h em São Paulo já é o dia seguinte em
 * UTC, e a grade passaria a valer um dia depois do que o gestor viu na tela.
 */
async function hojeNoTenant(contexto: Contexto, tx: Transacao): Promise<string> {
  const estabelecimento = await repoEstabelecimentos.buscarParaGestao(
    tx,
    contexto.estabelecimentoId,
  );

  if (estabelecimento === null) {
    throw new ErroDominio('NAO_ENCONTRADO', 'Estabelecimento não encontrado.');
  }

  return DateTime.now().setZone(estabelecimento.fusoHorario).toISODate() ?? '';
}

/**
 * `horarios.escrever` e `bloqueios.escrever` são `PROPRIOS` para FUNCIONARIO
 * (2.3): ele mexe na própria grade, não na dos outros. É a verificação com alvo,
 * e por isso passa por `podeExecutarSobre` em vez de `podeExecutar`.
 */
function exigirEscritaSobre(
  contexto: Contexto,
  permissao: 'horarios.escrever' | 'bloqueios.escrever',
  profissionalAlvoId: string | null,
): void {
  const alcanca =
    contexto.papel !== null &&
    podeExecutarSobre(
      { papel: contexto.papel, profissionalId: contexto.profissionalId },
      permissao,
      profissionalAlvoId,
    );

  if (!alcanca) {
    throw new ErroDominio(
      'FORA_DO_ESCOPO',
      permissao === 'horarios.escrever'
        ? 'Você só pode alterar o seu próprio horário.'
        : 'Você só pode bloquear a sua própria agenda.',
    );
  }
}

export async function listarGrades(contexto: Contexto) {
  return unidadeDeTrabalho(contexto, async (tx) => ({
    grades: await repo.listarGradeVigente(
      tx,
      contexto.estabelecimentoId,
      await hojeNoTenant(contexto, tx),
    ),
  }));
}

export async function definirGrade(
  contexto: Contexto,
  profissionalId: string,
  faixas: readonly Faixa[],
) {
  exigirEscritaSobre(contexto, 'horarios.escrever', profissionalId);

  return unidadeDeTrabalho(contexto, async (tx) => {
    const hoje = await hojeNoTenant(contexto, tx);
    const grades = await repo.listarGradeVigente(tx, contexto.estabelecimentoId, hoje);

    if (!grades.some((grade) => grade.profissionalId === profissionalId)) {
      throw new ErroDominio('NAO_ENCONTRADO', 'Esta pessoa não está mais na equipe.');
    }

    await repo.substituirGrade(tx, contexto.estabelecimentoId, profissionalId, hoje, faixas);

    return { grades: await repo.listarGradeVigente(tx, contexto.estabelecimentoId, hoje) };
  });
}

export async function listarExcecoes(contexto: Contexto, de: string, ate: string) {
  return unidadeDeTrabalho(contexto, async (tx) => {
    const estabelecimento = await repoEstabelecimentos.buscarParaGestao(
      tx,
      contexto.estabelecimentoId,
    );

    if (estabelecimento === null) {
      throw new ErroDominio('NAO_ENCONTRADO', 'Estabelecimento não encontrado.');
    }

    // O período chega como data civil e vira instante no fuso do tenant: o dia
    // do gestor não começa à meia-noite UTC
    const fuso = estabelecimento.fusoHorario;
    const inicio = DateTime.fromISO(de, { zone: fuso }).startOf('day');
    const fim = DateTime.fromISO(ate, { zone: fuso }).endOf('day');

    return {
      excecoes: await repo.listarExcecoesNoPeriodo(
        tx,
        contexto.estabelecimentoId,
        inicio.toJSDate(),
        fim.toJSDate(),
      ),
    };
  });
}

export async function criarExcecao(contexto: Contexto, dados: DadosDaExcecao) {
  exigirEscritaSobre(contexto, 'bloqueios.escrever', dados.profissionalId);

  return unidadeDeTrabalho(contexto, (tx) =>
    repo.criarExcecao(tx, contexto.estabelecimentoId, dados),
  );
}

export async function removerExcecao(contexto: Contexto, id: string) {
  return unidadeDeTrabalho(contexto, async (tx) => {
    const existente = await repo.buscarExcecao(tx, contexto.estabelecimentoId, id);

    if (existente === null) {
      throw new ErroDominio('NAO_ENCONTRADO', 'Este bloqueio não existe mais.');
    }

    // A permissão depende de quem é o alvo, então é conferida depois de saber
    // qual bloqueio é — nunca antes
    exigirEscritaSobre(contexto, 'bloqueios.escrever', existente.profissionalId);

    await repo.removerExcecao(tx, contexto.estabelecimentoId, id);

    return { ok: true };
  });
}
