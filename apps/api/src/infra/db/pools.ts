import * as esquema from '@agendamento/db';
import { traduzirErroDoBanco } from '@agendamento/db';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Config } from '../../config.ts';
import type { Contexto } from '../../contexto.ts';

export type Esquema = typeof esquema;
export type Executor = NodePgDatabase<Esquema>;

/** O que um repositório recebe como primeiro parâmetro (T11). */
export type Transacao = Parameters<Parameters<Executor['transaction']>[0]>[0];

export type Pools = {
  poolGestor: Executor;
  poolPublico: Executor;
  encerrar: () => Promise<void>;
};

/**
 * Dois pools, dois papéis (9.6, T6). O plugin de contexto escolhe pela rota:
 * tudo sob `/publico/*` usa `poolPublico`, que não alcança `lancamentos`,
 * `observacoes_internas` nem a leitura da auditoria mesmo se alguém escrever a
 * query errada.
 */
export function criarPools(config: Config): Pools {
  const conexaoGestor = new Pool({ connectionString: config.BANCO_URL });
  const conexaoPublica = new Pool({ connectionString: config.BANCO_URL_PUBLICO });

  return {
    poolGestor: drizzle(conexaoGestor, { schema: esquema }),
    poolPublico: drizzle(conexaoPublica, { schema: esquema }),
    async encerrar() {
      await Promise.all([conexaoGestor.end(), conexaoPublica.end()]);
    },
  };
}

/**
 * A transação vive no caso de uso, não na rota — que não sabe o que é atômico —
 * nem no repositório, que enxergaria só um pedaço (6.4, T11).
 *
 * O terceiro argumento `true` do `set_config` torna a variável local à
 * transação: o PostgreSQL a descarta no commit ou no rollback, e o bug de 9.6
 * deixa de ser possível por construção. Compatível com PgBouncer em modo
 * `transaction`.
 *
 * A tradução de erro de banco fica aqui porque `infra/db` é a última camada que
 * conhece PostgreSQL (T12). Acima daqui, nada sabe o que é um SQLSTATE.
 */
export async function unidadeDeTrabalho<T>(
  contexto: Contexto,
  acao: (tx: Transacao) => Promise<T>,
): Promise<T> {
  try {
    return await contexto.pool.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.estabelecimento_id', ${contexto.estabelecimentoId}, true)`,
      );

      return acao(tx);
    });
  } catch (erro) {
    throw traduzirErroDoBanco(erro);
  }
}
