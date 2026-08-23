import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  date,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { agendamentos } from './agenda.js';
import { servicos } from './catalogo.js';
import { atorTipo, canalNotificacao, statusNotificacao, tipoLancamento } from './enums.js';
import { estabelecimentos } from './estabelecimentos.js';
import { usuarios } from './identidade.js';
import { clientes, profissionais } from './pessoas.js';
import { politicaDeTenant } from './rls.js';
import { criadoEm, idPrimario } from './tipos.js';

/**
 * Livro-caixa append-only: fonte única do financeiro (7.4). Sem `atualizado_em` e
 * sem `excluido_em` — a única mutação permitida é preencher
 * `estornado_por_lancamento_id` uma vez, e o GRANT de coluna na migração é o que
 * torna isso impossível de burlar por query errada.
 *
 * As chaves únicas parciais consideram apenas linhas originais e não estornadas,
 * para que reconcluir um atendimento após estorno funcione (8.6).
 */
export const lancamentos = pgTable(
  'lancamentos',
  {
    id: idPrimario(),
    estabelecimentoId: uuid('estabelecimento_id')
      .notNull()
      .references(() => estabelecimentos.id),
    dataLancamento: date('data_lancamento').notNull(),
    profissionalId: uuid('profissional_id').references(() => profissionais.id),
    tipo: tipoLancamento('tipo').notNull(),
    agendamentoId: uuid('agendamento_id').references(() => agendamentos.id),
    servicoId: uuid('servico_id').references(() => servicos.id),
    clienteId: uuid('cliente_id').references(() => clientes.id),
    nomeCliente: varchar('nome_cliente', { length: 120 }),
    quantidade: integer('quantidade').notNull().default(1),
    valorCentavos: integer('valor_centavos').notNull(),
    observacao: text('observacao'),
    estornaLancamentoId: uuid('estorna_lancamento_id').references(
      (): AnyPgColumn => lancamentos.id,
    ),
    estornadoPorLancamentoId: uuid('estornado_por_lancamento_id').references(
      (): AnyPgColumn => lancamentos.id,
    ),
    criadoPorUsuarioId: uuid('criado_por_usuario_id')
      .notNull()
      .references(() => usuarios.id),
    criadoEm: criadoEm(),
  },
  (tabela) => [
    index('lancamentos_data_idx').on(tabela.estabelecimentoId, tabela.dataLancamento),
    uniqueIndex('lancamentos_agendamento_uk')
      .on(tabela.agendamentoId)
      .where(
        sql`agendamento_id IS NOT NULL AND estorna_lancamento_id IS NULL AND estornado_por_lancamento_id IS NULL`,
      ),
    uniqueIndex('lancamentos_total_dia_uk')
      .on(tabela.estabelecimentoId, tabela.dataLancamento, tabela.profissionalId)
      .where(
        sql`tipo = 'TOTAL_DIA' AND estorna_lancamento_id IS NULL AND estornado_por_lancamento_id IS NULL`,
      ),
    // Impede estornar a mesma linha duas vezes (8.6)
    uniqueIndex('lancamentos_estorno_uk')
      .on(tabela.estornaLancamentoId)
      .where(sql`estorna_lancamento_id IS NOT NULL`),
    check(
      'lancamentos_agendamento_chk',
      sql`(${tabela.tipo} = 'AGENDAMENTO') = (${tabela.agendamentoId} IS NOT NULL)`,
    ),
    check('lancamentos_servico_chk', sql`${tabela.servicoId} IS NULL OR ${tabela.tipo} = 'AVULSO'`),
    politicaDeTenant('lancamentos'),
  ],
);

/** Outbox transacional: a linha nasce e morre com a transação (6.5 do stack). */
export const notificacoes = pgTable(
  'notificacoes',
  {
    id: idPrimario(),
    estabelecimentoId: uuid('estabelecimento_id')
      .notNull()
      .references(() => estabelecimentos.id),
    agendamentoId: uuid('agendamento_id').references(() => agendamentos.id),
    canal: canalNotificacao('canal').notNull(),
    template: varchar('template', { length: 60 }).notNull(),
    destinatario: varchar('destinatario', { length: 160 }).notNull(),
    agendadaPara: timestamp('agendada_para', { withTimezone: true }).notNull(),
    enviadaEm: timestamp('enviada_em', { withTimezone: true }),
    status: statusNotificacao('status').notNull(),
    erro: text('erro'),
    criadoEm: criadoEm(),
  },
  (tabela) => [
    index('notificacoes_estabelecimento_idx').on(tabela.estabelecimentoId),
    index('notificacoes_fila_idx').on(tabela.status, tabela.agendadaPara),
    politicaDeTenant('notificacoes'),
  ],
);

export const auditoria = pgTable(
  'auditoria',
  {
    id: idPrimario(),
    estabelecimentoId: uuid('estabelecimento_id')
      .notNull()
      .references(() => estabelecimentos.id),
    atorUsuarioId: uuid('ator_usuario_id').references(() => usuarios.id),
    atorTipo: atorTipo('ator_tipo'),
    clienteId: uuid('cliente_id').references(() => clientes.id),
    entidade: varchar('entidade', { length: 60 }).notNull(),
    entidadeId: uuid('entidade_id').notNull(),
    acao: varchar('acao', { length: 40 }).notNull(),
    diff: jsonb('diff'),
    ip: inet('ip'),
    criadoEm: criadoEm(),
  },
  (tabela) => [
    index('auditoria_entidade_idx').on(
      tabela.estabelecimentoId,
      tabela.entidade,
      tabela.entidadeId,
    ),
    // Retenção de 24 meses: o expurgo diário varre por esta coluna (8.6)
    index('auditoria_criado_em_idx').on(tabela.criadoEm),
    politicaDeTenant('auditoria'),
  ],
);
