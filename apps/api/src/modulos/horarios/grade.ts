import { excecoesAgenda, horariosTrabalho, profissionais } from '@agendamento/db';
import { and, asc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import type { Transacao } from '../../infra/db/pools.ts';

export type Faixa = {
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
};

export type GradeDoProfissional = {
  profissionalId: string;
  nomeExibicao: string;
  ativo: boolean;
  faixas: Faixa[];
  vigenciaInicio: string | null;
};

/** O banco guarda `time` como `HH:MM:SS`; a tela e o contrato usam `HH:MM`. */
function comoHoraLocal(bruto: string): string {
  return bruto.slice(0, 5);
}

function comoHoraDoBanco(hora: string): string {
  return `${hora}:00`;
}

/**
 * A grade **vigente** em `hoje`: `vigencia_inicio <= hoje` e `vigencia_fim` nulo
 * ou a partir de hoje — as duas pontas inclusivas (6.5). Versões passadas ficam
 * na tabela e não têm tela; existem para a agenda de ontem continuar explicável.
 */
export async function listarGradeVigente(
  tx: Transacao,
  estabelecimentoId: string,
  hoje: string,
): Promise<GradeDoProfissional[]> {
  const pessoas = await tx
    .select({
      id: profissionais.id,
      nomeExibicao: profissionais.nomeExibicao,
      ativo: profissionais.ativo,
    })
    .from(profissionais)
    .where(
      and(eq(profissionais.estabelecimentoId, estabelecimentoId), isNull(profissionais.excluidoEm)),
    )
    .orderBy(asc(profissionais.posicao), asc(profissionais.nomeExibicao));

  const linhas = await tx
    .select({
      profissionalId: horariosTrabalho.profissionalId,
      diaSemana: horariosTrabalho.diaSemana,
      horaInicio: horariosTrabalho.horaInicio,
      horaFim: horariosTrabalho.horaFim,
      vigenciaInicio: horariosTrabalho.vigenciaInicio,
    })
    .from(horariosTrabalho)
    .where(
      and(
        eq(horariosTrabalho.estabelecimentoId, estabelecimentoId),
        lte(horariosTrabalho.vigenciaInicio, hoje),
        or(isNull(horariosTrabalho.vigenciaFim), gte(horariosTrabalho.vigenciaFim, hoje)),
      ),
    )
    .orderBy(asc(horariosTrabalho.diaSemana), asc(horariosTrabalho.horaInicio));

  const porProfissional = new Map<string, { faixas: Faixa[]; vigenciaInicio: string }>();

  for (const linha of linhas) {
    const atual = porProfissional.get(linha.profissionalId) ?? {
      faixas: [],
      vigenciaInicio: linha.vigenciaInicio,
    };

    atual.faixas.push({
      diaSemana: linha.diaSemana,
      horaInicio: comoHoraLocal(linha.horaInicio),
      horaFim: comoHoraLocal(linha.horaFim),
    });
    porProfissional.set(linha.profissionalId, atual);
  }

  return pessoas.map((pessoa) => {
    const grade = porProfissional.get(pessoa.id);

    return {
      profissionalId: pessoa.id,
      nomeExibicao: pessoa.nomeExibicao,
      ativo: pessoa.ativo,
      faixas: grade?.faixas ?? [],
      vigenciaInicio: grade?.vigenciaInicio ?? null,
    };
  });
}

/**
 * 6.5, na forma executável. Alterar grade **nunca** é `UPDATE` retroativo: a
 * agenda de ontem precisa continuar explicável pela grade que valia ontem.
 *
 * Os três passos, nesta ordem:
 *
 * 1. Apaga o que foi criado hoje. Corrigir um erro de digitação não é uma versão
 *    da grade, e gerar uma versão de vigência vazia sujaria a tabela sem
 *    acrescentar informação.
 * 2. Fecha o que ainda está aberto em `hoje - 1`, deixando o passado intacto.
 * 3. Insere as faixas novas valendo de hoje.
 *
 * O passo 2 é `no-op` numa segunda alteração do mesmo dia, porque a primeira já
 * fechou tudo — e é isso que impede a grade anterior de ser fechada duas vezes.
 */
export async function substituirGrade(
  tx: Transacao,
  estabelecimentoId: string,
  profissionalId: string,
  hoje: string,
  faixas: readonly Faixa[],
): Promise<void> {
  const doProfissional = and(
    eq(horariosTrabalho.estabelecimentoId, estabelecimentoId),
    eq(horariosTrabalho.profissionalId, profissionalId),
  );

  await tx
    .delete(horariosTrabalho)
    .where(and(doProfissional, eq(horariosTrabalho.vigenciaInicio, hoje)));

  await tx
    .update(horariosTrabalho)
    .set({ vigenciaFim: sql`${hoje}::date - 1` })
    .where(and(doProfissional, isNull(horariosTrabalho.vigenciaFim)));

  if (faixas.length > 0) {
    await tx.insert(horariosTrabalho).values(
      faixas.map((faixa) => ({
        estabelecimentoId,
        profissionalId,
        diaSemana: faixa.diaSemana,
        horaInicio: comoHoraDoBanco(faixa.horaInicio),
        horaFim: comoHoraDoBanco(faixa.horaFim),
        vigenciaInicio: hoje,
      })),
    );
  }
}

export type ExcecaoDeAgenda = {
  id: string;
  profissionalId: string | null;
  tipo: 'BLOQUEIO' | 'EXTRA';
  iniciaEm: string;
  terminaEm: string;
  diaInteiro: boolean;
  motivo: string | null;
};

export type DadosDaExcecao = Omit<ExcecaoDeAgenda, 'id'>;

export async function listarExcecoesNoPeriodo(
  tx: Transacao,
  estabelecimentoId: string,
  de: Date,
  ate: Date,
): Promise<ExcecaoDeAgenda[]> {
  const linhas = await tx
    .select()
    .from(excecoesAgenda)
    .where(
      and(
        eq(excecoesAgenda.estabelecimentoId, estabelecimentoId),
        lte(excecoesAgenda.iniciaEm, ate),
        gte(excecoesAgenda.terminaEm, de),
      ),
    )
    .orderBy(asc(excecoesAgenda.iniciaEm));

  return linhas.map((linha) => ({
    id: linha.id,
    profissionalId: linha.profissionalId,
    tipo: linha.tipo,
    iniciaEm: linha.iniciaEm.toISOString(),
    terminaEm: linha.terminaEm.toISOString(),
    diaInteiro: linha.diaInteiro,
    motivo: linha.motivo,
  }));
}

export async function criarExcecao(
  tx: Transacao,
  estabelecimentoId: string,
  dados: DadosDaExcecao,
): Promise<ExcecaoDeAgenda> {
  const [criada] = await tx
    .insert(excecoesAgenda)
    .values({
      estabelecimentoId,
      profissionalId: dados.profissionalId,
      tipo: dados.tipo,
      iniciaEm: new Date(dados.iniciaEm),
      terminaEm: new Date(dados.terminaEm),
      diaInteiro: dados.diaInteiro,
      motivo: dados.motivo,
    })
    .returning();

  if (criada === undefined) {
    throw new Error('insert de exceção não devolveu linha');
  }

  return {
    id: criada.id,
    profissionalId: criada.profissionalId,
    tipo: criada.tipo,
    iniciaEm: criada.iniciaEm.toISOString(),
    terminaEm: criada.terminaEm.toISOString(),
    diaInteiro: criada.diaInteiro,
    motivo: criada.motivo,
  };
}

export async function removerExcecao(
  tx: Transacao,
  estabelecimentoId: string,
  id: string,
): Promise<{ profissionalId: string | null } | null> {
  const [removida] = await tx
    .delete(excecoesAgenda)
    .where(and(eq(excecoesAgenda.id, id), eq(excecoesAgenda.estabelecimentoId, estabelecimentoId)))
    .returning({ profissionalId: excecoesAgenda.profissionalId });

  return removida ?? null;
}

export async function buscarExcecao(
  tx: Transacao,
  estabelecimentoId: string,
  id: string,
): Promise<{ profissionalId: string | null } | null> {
  const [linha] = await tx
    .select({ profissionalId: excecoesAgenda.profissionalId })
    .from(excecoesAgenda)
    .where(and(eq(excecoesAgenda.id, id), eq(excecoesAgenda.estabelecimentoId, estabelecimentoId)))
    .limit(1);

  return linha ?? null;
}
