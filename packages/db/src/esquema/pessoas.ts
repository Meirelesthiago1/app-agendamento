import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { estabelecimentos } from './estabelecimentos.js';
import { usuarios, vinculos } from './identidade.js';
import { politicaDeTenant } from './rls.js';
import { atualizadoEm, citext, criadoEm, excluidoEm, idPrimario } from './tipos.js';

/**
 * Profissional é quem recebe agendamento, e não necessariamente quem tem login
 * (2.4): `vinculo_id` nulo é o profissional sem acesso ao sistema. Herda sempre
 * o fuso do estabelecimento.
 */
export const profissionais = pgTable(
  'profissionais',
  {
    id: idPrimario(),
    estabelecimentoId: uuid('estabelecimento_id')
      .notNull()
      .references(() => estabelecimentos.id),
    vinculoId: uuid('vinculo_id').references(() => vinculos.id),
    nomeExibicao: varchar('nome_exibicao', { length: 120 }).notNull(),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    ativo: boolean('ativo').notNull().default(true),
    posicao: integer('posicao'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
    excluidoEm: excluidoEm(),
  },
  (tabela) => [
    index('profissionais_estabelecimento_idx').on(tabela.estabelecimentoId),
    uniqueIndex('profissionais_vinculo_uk').on(tabela.vinculoId).where(sql`vinculo_id IS NOT NULL`),
    politicaDeTenant('profissionais'),
  ],
);

export const clientes = pgTable(
  'clientes',
  {
    id: idPrimario(),
    estabelecimentoId: uuid('estabelecimento_id')
      .notNull()
      .references(() => estabelecimentos.id),
    usuarioId: uuid('usuario_id').references(() => usuarios.id),
    nome: varchar('nome', { length: 120 }).notNull(),
    telefone: varchar('telefone', { length: 20 }).notNull(),
    email: citext('email'),
    dataNascimento: date('data_nascimento'),
    observacoesInternas: text('observacoes_internas'),
    bloqueado: boolean('bloqueado').notNull().default(false),
    motivoBloqueio: varchar('motivo_bloqueio', { length: 200 }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
    excluidoEm: excluidoEm(),
  },
  (tabela) => [
    index('clientes_estabelecimento_idx').on(tabela.estabelecimentoId),
    // O telefone é a chave de identidade do cliente dentro do tenant (8.3.1)
    uniqueIndex('clientes_telefone_uk').on(tabela.estabelecimentoId, tabela.telefone),
    uniqueIndex('clientes_email_uk')
      .on(tabela.estabelecimentoId, tabela.email)
      .where(sql`email IS NOT NULL`),
    politicaDeTenant('clientes'),
  ],
);
