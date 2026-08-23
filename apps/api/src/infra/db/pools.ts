import * as esquema from '@agendamento/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../../config.js';

/**
 * Dois pools, dois papéis (9.6, T6). O plugin de contexto escolhe pela rota: tudo
 * sob `/publico/*` usa `poolPublico`, que não alcança `lancamentos`,
 * `observacoes_internas` nem a leitura da auditoria mesmo se alguém escrever a
 * query errada.
 */
const conexaoGestor = new Pool({ connectionString: config.BANCO_URL });

const conexaoPublica = new Pool({ connectionString: config.BANCO_URL_PUBLICO });

export const poolGestor = drizzle(conexaoGestor, { schema: esquema });

export const poolPublico = drizzle(conexaoPublica, { schema: esquema });

export type Executor = typeof poolGestor;

export async function encerrarPools(): Promise<void> {
  await Promise.all([conexaoGestor.end(), conexaoPublica.end()]);
}
