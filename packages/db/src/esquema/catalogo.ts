import {
  boolean,
  char,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { exibicaoValor } from './enums.js';
import { estabelecimentos } from './estabelecimentos.js';
import { profissionais } from './pessoas.js';
import { politicaDeTenant } from './rls.js';
import { atualizadoEm, criadoEm, excluidoEm, idPrimario } from './tipos.js';

export const categoriasServico = pgTable(
  'categorias_servico',
  {
    id: idPrimario(),
    estabelecimentoId: uuid('estabelecimento_id')
      .notNull()
      .references(() => estabelecimentos.id),
    nome: varchar('nome', { length: 80 }).notNull(),
    posicao: integer('posicao'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (tabela) => [
    index('categorias_servico_estabelecimento_idx').on(tabela.estabelecimentoId),
    politicaDeTenant('categorias_servico'),
  ],
);

/**
 * Serviço é unidade atômica de atendimento, nunca combinação (8.4). Combinação é
 * responsabilidade de `agendamento_itens`.
 */
export const servicos = pgTable(
  'servicos',
  {
    id: idPrimario(),
    estabelecimentoId: uuid('estabelecimento_id')
      .notNull()
      .references(() => estabelecimentos.id),
    categoriaId: uuid('categoria_id').references(() => categoriasServico.id),
    slug: varchar('slug', { length: 60 }).notNull(),
    nome: varchar('nome', { length: 120 }).notNull(),
    descricao: text('descricao'),
    duracaoMin: integer('duracao_min').notNull(),
    folgaAntesMin: integer('folga_antes_min').notNull().default(0),
    folgaDepoisMin: integer('folga_depois_min').notNull().default(0),
    valorCentavos: integer('valor_centavos'),
    exibicaoValor: exibicaoValor('exibicao_valor').notNull().default('FIXO'),
    cor: char('cor', { length: 7 }),
    ativo: boolean('ativo').notNull().default(true),
    posicao: integer('posicao'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
    excluidoEm: excluidoEm(),
  },
  (tabela) => [
    index('servicos_estabelecimento_idx').on(tabela.estabelecimentoId),
    uniqueIndex('servicos_slug_uk').on(tabela.estabelecimentoId, tabela.slug),
    politicaDeTenant('servicos'),
  ],
);

/**
 * `estabelecimento_id` é redundante em relação às duas FKs, mas necessário para
 * que a política de RLS se aplique à tabela de junção sem join (8.4).
 */
export const profissionaisServicos = pgTable(
  'profissionais_servicos',
  {
    estabelecimentoId: uuid('estabelecimento_id')
      .notNull()
      .references(() => estabelecimentos.id),
    profissionalId: uuid('profissional_id')
      .notNull()
      .references(() => profissionais.id),
    servicoId: uuid('servico_id')
      .notNull()
      .references(() => servicos.id),
    duracaoOverrideMin: integer('duracao_override_min'),
    valorOverrideCentavos: integer('valor_override_centavos'),
  },
  (tabela) => [
    primaryKey({ columns: [tabela.profissionalId, tabela.servicoId] }),
    index('profissionais_servicos_estabelecimento_idx').on(tabela.estabelecimentoId),
    politicaDeTenant('profissionais_servicos'),
  ],
);
