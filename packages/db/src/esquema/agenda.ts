import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { servicos } from './catalogo.js';
import {
  canceladoPor,
  origemAgendamento,
  statusAgendamento,
  tipoCancelamento,
  tipoExcecao,
} from './enums.js';
import { estabelecimentos } from './estabelecimentos.js';
import { usuarios } from './identidade.js';
import { clientes, profissionais } from './pessoas.js';
import { politicaDeTenant } from './rls.js';
import { atualizadoEm, criadoEm, idPrimario } from './tipos.js';

/**
 * Grade semanal recorrente. Várias linhas no mesmo dia representam intervalos
 * (08–12, 13–18). `hora_inicio` e `hora_fim` são hora LOCAL: a conversão para UTC
 * depende da data, e é o que 6.3 exige do motor.
 */
export const horariosTrabalho = pgTable(
  'horarios_trabalho',
  {
    id: idPrimario(),
    estabelecimentoId: uuid('estabelecimento_id')
      .notNull()
      .references(() => estabelecimentos.id),
    profissionalId: uuid('profissional_id')
      .notNull()
      .references(() => profissionais.id),
    diaSemana: smallint('dia_semana').notNull(),
    horaInicio: time('hora_inicio').notNull(),
    horaFim: time('hora_fim').notNull(),
    vigenciaInicio: date('vigencia_inicio').notNull(),
    vigenciaFim: date('vigencia_fim'),
    criadoEm: criadoEm(),
  },
  (tabela) => [
    index('horarios_trabalho_estabelecimento_idx').on(tabela.estabelecimentoId),
    index('horarios_trabalho_grade_idx').on(
      tabela.profissionalId,
      tabela.diaSemana,
      tabela.vigenciaInicio,
    ),
    politicaDeTenant('horarios_trabalho'),
  ],
);

export const excecoesAgenda = pgTable(
  'excecoes_agenda',
  {
    id: idPrimario(),
    estabelecimentoId: uuid('estabelecimento_id')
      .notNull()
      .references(() => estabelecimentos.id),
    profissionalId: uuid('profissional_id').references(() => profissionais.id),
    tipo: tipoExcecao('tipo').notNull(),
    iniciaEm: timestamp('inicia_em', { withTimezone: true }).notNull(),
    terminaEm: timestamp('termina_em', { withTimezone: true }).notNull(),
    diaInteiro: boolean('dia_inteiro').notNull().default(false),
    motivo: varchar('motivo', { length: 120 }),
    criadoEm: criadoEm(),
  },
  (tabela) => [
    index('excecoes_agenda_periodo_idx').on(
      tabela.estabelecimentoId,
      tabela.iniciaEm,
      tabela.terminaEm,
    ),
    politicaDeTenant('excecoes_agenda'),
  ],
);

/**
 * Os totais são denormalizados de propósito: a agenda e o Resumo precisam deles
 * sem join, e são imutáveis após a criação (8.5).
 *
 * A constraint `EXCLUDE USING gist` sobre `ocupacao_inicio`/`ocupacao_fim` é
 * acrescentada à migração à mão — o DSL do Drizzle não a expressa.
 */
export const agendamentos = pgTable(
  'agendamentos',
  {
    id: idPrimario(),
    estabelecimentoId: uuid('estabelecimento_id')
      .notNull()
      .references(() => estabelecimentos.id),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id),
    profissionalId: uuid('profissional_id')
      .notNull()
      .references(() => profissionais.id),
    iniciaEm: timestamp('inicia_em', { withTimezone: true }).notNull(),
    terminaEm: timestamp('termina_em', { withTimezone: true }).notNull(),
    ocupacaoInicio: timestamp('ocupacao_inicio', { withTimezone: true }).notNull(),
    ocupacaoFim: timestamp('ocupacao_fim', { withTimezone: true }).notNull(),
    status: statusAgendamento('status').notNull(),
    valorTotalSnapshot: integer('valor_total_snapshot'),
    duracaoTotalMinSnapshot: integer('duracao_total_min_snapshot').notNull(),
    origem: origemAgendamento('origem').notNull(),
    qualquerProfissional: boolean('qualquer_profissional').notNull().default(false),
    encaixe: boolean('encaixe').notNull().default(false),
    observacoesCliente: text('observacoes_cliente'),
    observacoesInternas: text('observacoes_internas'),
    tokenGestao: varchar('token_gestao', { length: 64 }).unique(),
    tokenGestaoExpiraEm: timestamp('token_gestao_expira_em', { withTimezone: true }),
    tipoCancelamento: tipoCancelamento('tipo_cancelamento'),
    criadoPorUsuarioId: uuid('criado_por_usuario_id').references(() => usuarios.id),
    confirmadoEm: timestamp('confirmado_em', { withTimezone: true }),
    concluidoEm: timestamp('concluido_em', { withTimezone: true }),
    canceladoEm: timestamp('cancelado_em', { withTimezone: true }),
    canceladoPor: canceladoPor('cancelado_por'),
    motivoCancelamento: varchar('motivo_cancelamento', { length: 200 }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (tabela) => [
    index('agendamentos_profissional_idx').on(
      tabela.estabelecimentoId,
      tabela.profissionalId,
      tabela.iniciaEm,
    ),
    index('agendamentos_ativos_idx')
      .on(tabela.estabelecimentoId, tabela.iniciaEm)
      .where(sql`status IN ('AGUARDANDO', 'CONFIRMADO')`),
    index('agendamentos_cliente_idx').on(
      tabela.estabelecimentoId,
      tabela.clienteId,
      sql`inicia_em DESC`,
    ),
    politicaDeTenant('agendamentos'),
  ],
);

/** Itens não têm horário próprio: ocupam o bloco em sequência (8.5). */
export const agendamentoItens = pgTable(
  'agendamento_itens',
  {
    id: idPrimario(),
    estabelecimentoId: uuid('estabelecimento_id')
      .notNull()
      .references(() => estabelecimentos.id),
    agendamentoId: uuid('agendamento_id')
      .notNull()
      .references(() => agendamentos.id),
    servicoId: uuid('servico_id')
      .notNull()
      .references(() => servicos.id),
    posicao: integer('posicao').notNull(),
    duracaoMinSnapshot: integer('duracao_min_snapshot').notNull(),
    valorCentavosSnapshot: integer('valor_centavos_snapshot'),
    criadoEm: criadoEm(),
  },
  (tabela) => [
    uniqueIndex('agendamento_itens_posicao_uk').on(tabela.agendamentoId, tabela.posicao),
    index('agendamento_itens_servico_idx').on(tabela.estabelecimentoId, tabela.servicoId),
    politicaDeTenant('agendamento_itens'),
  ],
);
