import {
  agendamentos,
  configuracoes,
  estabelecimentos,
  excecoesAgenda,
  horariosTrabalho,
  profissionais,
  profissionaisServicos,
  servicos,
} from '@agendamento/db';
import {
  type ExcecaoDeAgenda,
  type LinhaDeGrade,
  type Ocupacao,
  type Profissional,
  STATUS_QUE_OCUPAM,
} from '@agendamento/dominio';
import { and, eq, gte, inArray, isNull, lt, or } from 'drizzle-orm';
import { DateTime } from 'luxon';
import type { Executor, Transacao } from '../../infra/db/pools.ts';

/** Todo método recebe o executor como primeiro parâmetro (T11). */
type Alcance = Transacao | Executor;

export type TenantResolvido = {
  id: string;
  slug: string;
  nome: string;
  fusoHorario: string;
  logoUrl: string | null;
  corTema: string | null;
  telefonePublico: string | null;
  enderecoPublico: string | null;
};

/**
 * A única consulta que roda sem contexto de tenant definido: é ela que descobre
 * qual é o tenant. A política de `estabelecimentos` deixa a leitura aberta
 * justamente por isso.
 */
export async function buscarTenantPorSlug(
  executor: Alcance,
  slug: string,
): Promise<TenantResolvido | null> {
  const [linha] = await executor
    .select({
      id: estabelecimentos.id,
      slug: estabelecimentos.slug,
      nome: estabelecimentos.nome,
      fusoHorario: estabelecimentos.fusoHorario,
      logoUrl: estabelecimentos.logoUrl,
      corTema: estabelecimentos.corTema,
      telefonePublico: estabelecimentos.telefonePublico,
      enderecoPublico: estabelecimentos.enderecoPublico,
    })
    .from(estabelecimentos)
    .where(and(eq(estabelecimentos.slug, slug), isNull(estabelecimentos.excluidoEm)))
    .limit(1);

  return linha ?? null;
}

export async function buscarConfiguracao(executor: Alcance, estabelecimentoId: string) {
  const [linha] = await executor
    .select()
    .from(configuracoes)
    .where(eq(configuracoes.estabelecimentoId, estabelecimentoId))
    .limit(1);

  return linha ?? null;
}

/**
 * O filtro explícito de `estabelecimento_id` acompanha a policy de RLS em toda
 * query (T7). Além da defesa em profundidade, o planner usa a cláusula para
 * escolher índice.
 */
export async function listarServicos(
  executor: Alcance,
  estabelecimentoId: string,
  ids?: readonly string[],
) {
  const filtros = [
    eq(servicos.estabelecimentoId, estabelecimentoId),
    eq(servicos.ativo, true),
    isNull(servicos.excluidoEm),
  ];

  if (ids !== undefined) {
    filtros.push(inArray(servicos.id, [...ids]));
  }

  return executor
    .select({
      id: servicos.id,
      slug: servicos.slug,
      nome: servicos.nome,
      descricao: servicos.descricao,
      duracaoMin: servicos.duracaoMin,
      folgaAntesMin: servicos.folgaAntesMin,
      folgaDepoisMin: servicos.folgaDepoisMin,
      valorCentavos: servicos.valorCentavos,
      exibicaoValor: servicos.exibicaoValor,
      cor: servicos.cor,
      categoriaId: servicos.categoriaId,
    })
    .from(servicos)
    .where(and(...filtros));
}

export async function listarProfissionaisComServicos(
  executor: Alcance,
  estabelecimentoId: string,
): Promise<
  (Profissional & { nomeExibicao: string; bio: string | null; avatarUrl: string | null })[]
> {
  const pessoas = await executor
    .select({
      id: profissionais.id,
      nomeExibicao: profissionais.nomeExibicao,
      bio: profissionais.bio,
      avatarUrl: profissionais.avatarUrl,
    })
    .from(profissionais)
    .where(
      and(
        eq(profissionais.estabelecimentoId, estabelecimentoId),
        eq(profissionais.ativo, true),
        isNull(profissionais.excluidoEm),
      ),
    );

  const vinculos = await executor
    .select({
      profissionalId: profissionaisServicos.profissionalId,
      servicoId: profissionaisServicos.servicoId,
      duracaoOverrideMin: profissionaisServicos.duracaoOverrideMin,
    })
    .from(profissionaisServicos)
    .where(eq(profissionaisServicos.estabelecimentoId, estabelecimentoId));

  return pessoas.map((pessoa) => ({
    ...pessoa,
    servicos: vinculos
      .filter((vinculo) => vinculo.profissionalId === pessoa.id)
      .map((vinculo) => ({
        servicoId: vinculo.servicoId,
        duracaoOverrideMin: vinculo.duracaoOverrideMin,
      })),
  }));
}

export async function listarGrade(
  executor: Alcance,
  estabelecimentoId: string,
): Promise<LinhaDeGrade[]> {
  return executor
    .select({
      profissionalId: horariosTrabalho.profissionalId,
      diaSemana: horariosTrabalho.diaSemana,
      horaInicio: horariosTrabalho.horaInicio,
      horaFim: horariosTrabalho.horaFim,
      vigenciaInicio: horariosTrabalho.vigenciaInicio,
      vigenciaFim: horariosTrabalho.vigenciaFim,
    })
    .from(horariosTrabalho)
    .where(eq(horariosTrabalho.estabelecimentoId, estabelecimentoId));
}

export async function listarExcecoes(
  executor: Alcance,
  estabelecimentoId: string,
  de: Date,
  ate: Date,
): Promise<ExcecaoDeAgenda[]> {
  const linhas = await executor
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

/**
 * Encaixe também ocupa. A constraint de exclusão o dispensa porque é uma
 * sobreposição que o gestor autorizou (5.4), mas o tempo do profissional
 * continua tomado — oferecer o horário de novo produziria um segundo encaixe
 * involuntário.
 */
export async function listarOcupacoes(
  executor: Alcance,
  estabelecimentoId: string,
  de: Date,
  ate: Date,
): Promise<Ocupacao[]> {
  const linhas = await executor
    .select({
      profissionalId: agendamentos.profissionalId,
      ocupacaoInicio: agendamentos.ocupacaoInicio,
      ocupacaoFim: agendamentos.ocupacaoFim,
    })
    .from(agendamentos)
    .where(
      and(
        eq(agendamentos.estabelecimentoId, estabelecimentoId),
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

export { or };
