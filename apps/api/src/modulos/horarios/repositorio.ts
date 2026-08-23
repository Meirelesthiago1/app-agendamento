import { excecoesAgenda, horariosTrabalho } from '@agendamento/db';
import type { ExcecaoDeAgenda, LinhaDeGrade } from '@agendamento/dominio';
import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { DateTime } from 'luxon';
import type { Transacao } from '../../infra/db/pools.ts';

export async function listarGrade(
  tx: Transacao,
  estabelecimentoId: string,
  profissionalIds: readonly string[],
): Promise<LinhaDeGrade[]> {
  if (profissionalIds.length === 0) {
    return [];
  }

  return tx
    .select({
      profissionalId: horariosTrabalho.profissionalId,
      diaSemana: horariosTrabalho.diaSemana,
      horaInicio: horariosTrabalho.horaInicio,
      horaFim: horariosTrabalho.horaFim,
      vigenciaInicio: horariosTrabalho.vigenciaInicio,
      vigenciaFim: horariosTrabalho.vigenciaFim,
    })
    .from(horariosTrabalho)
    .where(
      and(
        eq(horariosTrabalho.estabelecimentoId, estabelecimentoId),
        inArray(horariosTrabalho.profissionalId, [...profissionalIds]),
      ),
    );
}

export async function listarExcecoes(
  tx: Transacao,
  estabelecimentoId: string,
  de: Date,
  ate: Date,
): Promise<ExcecaoDeAgenda[]> {
  const linhas = await tx
    .select({
      profissionalId: excecoesAgenda.profissionalId,
      tipo: excecoesAgenda.tipo,
      iniciaEm: excecoesAgenda.iniciaEm,
      terminaEm: excecoesAgenda.terminaEm,
    })
    .from(excecoesAgenda)
    .where(
      and(
        eq(excecoesAgenda.estabelecimentoId, estabelecimentoId),
        lt(excecoesAgenda.iniciaEm, ate),
        gte(excecoesAgenda.terminaEm, de),
      ),
    );

  return linhas.map((linha) => ({
    profissionalId: linha.profissionalId,
    tipo: linha.tipo,
    iniciaEm: DateTime.fromJSDate(linha.iniciaEm, { zone: 'utc' }),
    terminaEm: DateTime.fromJSDate(linha.terminaEm, { zone: 'utc' }),
  }));
}
