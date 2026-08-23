import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { semear } from '../src/semente.js';

const SENHA_DOS_PAPEIS = 'teste';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export type Ambiente = {
  urlGestor: string;
  urlPublico: string;
  encerrar: () => Promise<void>;
};

/**
 * Postgres real, não mock: nem `EXCLUDE USING gist`, nem RLS, nem `btree_gist`
 * existem em SQLite ou em dublê (T24). Sem banco real a peça mais crítica do
 * sistema seria a única sem cobertura.
 */
export async function subirBanco(): Promise<Ambiente> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:18-alpine',
  ).start();

  const conexaoDono = new Pool({ connectionString: container.getConnectionUri() });
  const dono = drizzle(conexaoDono);

  await migrate(dono, { migrationsFolder: resolve(RAIZ, 'migracoes') });

  // As migrações criam os papéis com LOGIN e sem senha; a senha é de ambiente.
  await conexaoDono.query(`ALTER ROLE agendamento_gestor WITH PASSWORD '${SENHA_DOS_PAPEIS}'`);
  await conexaoDono.query(`ALTER ROLE agendamento_publico WITH PASSWORD '${SENHA_DOS_PAPEIS}'`);

  await semear(dono);
  await conexaoDono.end();

  const comoPapel = (papel: string) =>
    `postgres://${papel}:${SENHA_DOS_PAPEIS}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;

  return {
    urlGestor: comoPapel('agendamento_gestor'),
    urlPublico: comoPapel('agendamento_publico'),
    async encerrar() {
      await container.stop();
    },
  };
}
