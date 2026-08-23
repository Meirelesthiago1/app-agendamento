import { agendamentos } from '@agendamento/db';
import { type Ocupacao, STATUS_QUE_OCUPAM } from '@agendamento/dominio';
import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { DateTime } from 'luxon';
import type { Transacao } from '../../infra/db/pools.ts';

/**
 * Encaixe também ocupa. A constraint de exclusão o dispensa porque é uma
 * sobreposição que o gestor autorizou (5.4), mas o tempo do profissional
 * continua tomado — oferecer o horário de novo produziria um segundo encaixe
 * involuntário.
 */
export async function listarOcupacoes(
  tx: Transacao,
  estabelecimentoId: string,
  profissionalIds: readonly string[],
  de: Date,
  ate: Date,
): Promise<Ocupacao[]> {
  if (profissionalIds.length === 0) {
    return [];
  }

  const linhas = await tx
    .select({
      profissionalId: agendamentos.profissionalId,
      ocupacaoInicio: agendamentos.ocupacaoInicio,
      ocupacaoFim: agendamentos.ocupacaoFim,
    })
    .from(agendamentos)
    .where(
      and(
        eq(agendamentos.estabelecimentoId, estabelecimentoId),
        inArray(agendamentos.profissionalId, [...profissionalIds]),
        inArray(agendamentos.status, [...STATUS_QUE_OCUPAM]),
        lt(agendamentos.ocupacaoInicio, ate),
        gte(agendamentos.ocupacaoFim, de),
      ),
    );

  return linhas.map((linha) => ({
    profissionalId: linha.profissionalId,
    ocupacaoInicio: DateTime.fromJSDate(linha.ocupacaoInicio, { zone: 'utc' }),
    ocupacaoFim: DateTime.fromJSDate(linha.ocupacaoFim, { zone: 'utc' }),
  }));
}
