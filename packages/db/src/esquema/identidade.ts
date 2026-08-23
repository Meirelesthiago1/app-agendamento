import { sql } from 'drizzle-orm';
import {
  index,
  inet,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  canalVerificacao,
  finalidadeVerificacao,
  papel,
  provedorExterno,
  statusVinculo,
} from './enums.js';
import { estabelecimentos } from './estabelecimentos.js';
import { politicaDeTenant, politicaDosProprios } from './rls.js';
import { atualizadoEm, citext, criadoEm, idPrimario } from './tipos.js';

/**
 * Identidade global, cross-tenant (8.3): a mesma pessoa é gestora de um
 * estabelecimento e cliente de outro. Sem `estabelecimento_id`, e portanto sem
 * política de tenant — o alcance é limitado por GRANT, e o papel público não tem
 * nenhum aqui.
 */
export const usuarios = pgTable(
  'usuarios',
  {
    id: idPrimario(),
    nome: varchar('nome', { length: 120 }).notNull(),
    email: citext('email').notNull().unique(),
    telefone: varchar('telefone', { length: 20 }),
    senhaHash: text('senha_hash'),
    emailVerificadoEm: timestamp('email_verificado_em', { withTimezone: true }),
    telefoneVerificadoEm: timestamp('telefone_verificado_em', { withTimezone: true }),
    ultimoLoginEm: timestamp('ultimo_login_em', { withTimezone: true }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (tabela) => [
    uniqueIndex('usuarios_telefone_verificado_uk')
      .on(tabela.telefone)
      .where(sql`telefone_verificado_em IS NOT NULL`),
  ],
);

export const identidadesExternas = pgTable(
  'identidades_externas',
  {
    id: idPrimario(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id),
    provedor: provedorExterno('provedor').notNull(),
    provedorId: varchar('provedor_id', { length: 120 }).notNull(),
    email: citext('email'),
    criadoEm: criadoEm(),
  },
  (tabela) => [
    uniqueIndex('identidades_externas_provedor_uk').on(tabela.provedor, tabela.provedorId),
  ],
);

export const codigosVerificacao = pgTable(
  'codigos_verificacao',
  {
    id: idPrimario(),
    destino: varchar('destino', { length: 160 }).notNull(),
    canal: canalVerificacao('canal').notNull(),
    finalidade: finalidadeVerificacao('finalidade').notNull(),
    /**
     * Conforme a finalidade: `usuario_id` na verificação e na recuperação;
     * `estabelecimento_id` no convite — porque aceitar acontece sem sessão e
     * sem tenant, e é este valor que permite abrir o contexto para alcançar o
     * vínculo sob RLS.
     */
    referenciaId: uuid('referencia_id'),
    codigoHash: text('codigo_hash').notNull(),
    tentativas: integer('tentativas').notNull().default(0),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    consumidoEm: timestamp('consumido_em', { withTimezone: true }),
    ip: inet('ip'),
    criadoEm: criadoEm(),
  },
  (tabela) => [
    index('codigos_verificacao_destino_idx').on(tabela.destino, tabela.expiraEm),
    // O OTP é buscado por destino; o link mágico, pelo próprio hash
    index('codigos_verificacao_hash_idx').on(tabela.codigoHash),
  ],
);

export const sessoes = pgTable(
  'sessoes',
  {
    id: idPrimario(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    userAgent: text('user_agent'),
    ip: inet('ip'),
    ultimoUsoEm: timestamp('ultimo_uso_em', { withTimezone: true }),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    revogadaEm: timestamp('revogada_em', { withTimezone: true }),
  },
  (tabela) => [index('sessoes_usuario_idx').on(tabela.usuarioId, tabela.expiraEm)],
);

export const vinculos = pgTable(
  'vinculos',
  {
    id: idPrimario(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id),
    estabelecimentoId: uuid('estabelecimento_id')
      .notNull()
      .references(() => estabelecimentos.id),
    papel: papel('papel').notNull(),
    status: statusVinculo('status').notNull(),
    convidadoEm: timestamp('convidado_em', { withTimezone: true }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (tabela) => [
    index('vinculos_estabelecimento_idx').on(tabela.estabelecimentoId),
    uniqueIndex('vinculos_usuario_estabelecimento_uk').on(
      tabela.usuarioId,
      tabela.estabelecimentoId,
    ),
    // "exatamente um PROPRIETARIO ativo por estabelecimento" (8.3), na forma executável
    uniqueIndex('vinculos_proprietario_unico_uk')
      .on(tabela.estabelecimentoId)
      .where(sql`papel = 'PROPRIETARIO' AND status = 'ATIVO'`),
    politicaDeTenant('vinculos'),
    politicaDosProprios(),
  ],
);
