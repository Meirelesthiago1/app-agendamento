import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Comparação sem diferenciar maiúsculas, exigida por 8.3 para e-mail. */
export const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

export const idPrimario = () => uuid('id').primaryKey().defaultRandom();

export const criadoEm = () => timestamp('criado_em', { withTimezone: true }).notNull().defaultNow();

export const atualizadoEm = () =>
  timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow();

export const excluidoEm = () => timestamp('excluido_em', { withTimezone: true });
