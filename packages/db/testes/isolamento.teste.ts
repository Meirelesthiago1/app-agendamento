import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { TENANT_BARBEARIA, TENANT_CLINICA } from '../src/semente.js';
import { type Ambiente, subirBanco } from './ambiente.js';

const TEMPO_DE_CONTAINER = 180_000;

let ambiente: Ambiente;
let pool: Pool;

beforeAll(async () => {
  ambiente = await subirBanco();
  pool = new Pool({ connectionString: ambiente.urlGestor });
}, TEMPO_DE_CONTAINER);

afterAll(async () => {
  await pool?.end();
  await ambiente?.encerrar();
}, TEMPO_DE_CONTAINER);

async function comTenant<T>(
  tenant: string | null,
  acao: (conexao: PoolClient) => Promise<T>,
): Promise<T> {
  const conexao = await pool.connect();

  try {
    await conexao.query('BEGIN');

    if (tenant !== null) {
      await conexao.query("SELECT set_config('app.estabelecimento_id', $1, true)", [tenant]);
    }

    return await acao(conexao);
  } finally {
    await conexao.query('ROLLBACK');
    conexao.release();
  }
}

/** O teste de 10.1 do stack. A falha é silenciosa, por isso ele existe desde já. */
describe('isolamento entre tenants', () => {
  test('lê o próprio tenant', async () => {
    const linhas = await comTenant(TENANT_BARBEARIA, async (conexao) => {
      const r = await conexao.query('SELECT nome FROM clientes');
      return r.rows;
    });

    // Sem esta asserção um resultado vazio no teste seguinte não provaria nada
    expect(linhas).toHaveLength(1);
  });

  test('leitura cruzada devolve vazio, não erro', async () => {
    const linhas = await comTenant(TENANT_BARBEARIA, async (conexao) => {
      const r = await conexao.query('SELECT nome FROM clientes WHERE estabelecimento_id = $1', [
        TENANT_CLINICA,
      ]);
      return r.rows;
    });

    expect(linhas).toEqual([]);
  });

  test('sem tenant definido não enxerga nada', async () => {
    const linhas = await comTenant(null, async (conexao) => {
      const r = await conexao.query('SELECT nome FROM clientes');
      return r.rows;
    });

    expect(linhas).toEqual([]);
  });

  test('a variável é local à transação e não sobrevive ao commit', async () => {
    const conexao = await pool.connect();

    try {
      await conexao.query('BEGIN');
      await conexao.query("SELECT set_config('app.estabelecimento_id', $1, true)", [
        TENANT_BARBEARIA,
      ]);
      await conexao.query('COMMIT');

      // O PostgreSQL restaura a variável para string vazia, não para indefinida.
      // É por isso que a política usa `nullif`: sem ele, `''::uuid` levantaria
      // 22P02 na próxima query desta conexão de pool.
      const r = await conexao.query(
        `SELECT current_setting('app.estabelecimento_id', true) AS crua,
                nullif(current_setting('app.estabelecimento_id', true), '') AS usada`,
      );

      expect(r.rows[0]?.crua).toBe('');
      expect(r.rows[0]?.usada).toBeNull();
    } finally {
      conexao.release();
    }
  });

  test('a conexão reaproveitada após um tenant não enxerga nada, e não quebra', async () => {
    const conexao = await pool.connect();

    try {
      await conexao.query('BEGIN');
      await conexao.query("SELECT set_config('app.estabelecimento_id', $1, true)", [
        TENANT_BARBEARIA,
      ]);
      await conexao.query('COMMIT');

      const r = await conexao.query('SELECT nome FROM clientes');

      expect(r.rows).toEqual([]);
    } finally {
      conexao.release();
    }
  });

  test('o papel público não alcança lancamentos', async () => {
    const conexaoPublica = new Pool({ connectionString: ambiente.urlPublico });

    try {
      await expect(conexaoPublica.query('SELECT * FROM lancamentos')).rejects.toMatchObject({
        code: '42501',
      });
    } finally {
      await conexaoPublica.end();
    }
  });
});
