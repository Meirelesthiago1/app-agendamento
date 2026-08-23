import { ErroDominio } from '@agendamento/dominio';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { traduzirErroDoBanco } from '../src/erros.js';
import { TENANT_BARBEARIA } from '../src/semente.js';
import { type Ambiente, subirBanco } from './ambiente.js';

const TEMPO_DE_CONTAINER = 180_000;

let ambiente: Ambiente;
let pool: Pool;
let clienteId: string;
let profissionalId: string;

beforeAll(async () => {
  ambiente = await subirBanco();
  pool = new Pool({ connectionString: ambiente.urlGestor });

  const conexao = await abrirTenant();

  try {
    const r = await conexao.query(
      'SELECT (SELECT id FROM clientes LIMIT 1) AS cliente, (SELECT id FROM profissionais LIMIT 1) AS profissional',
    );
    clienteId = r.rows[0].cliente;
    profissionalId = r.rows[0].profissional;
  } finally {
    await conexao.query('ROLLBACK');
    conexao.release();
  }
}, TEMPO_DE_CONTAINER);

afterAll(async () => {
  await pool?.end();
  await ambiente?.encerrar();
}, TEMPO_DE_CONTAINER);

async function abrirTenant(): Promise<PoolClient> {
  const conexao = await pool.connect();
  await conexao.query('BEGIN');
  await conexao.query("SELECT set_config('app.estabelecimento_id', $1, true)", [TENANT_BARBEARIA]);
  return conexao;
}

function inserir(
  conexao: PoolClient,
  inicio: string,
  fim: string,
  extras: { encaixe?: boolean; status?: string } = {},
) {
  return conexao.query(
    `INSERT INTO agendamentos
       (estabelecimento_id, cliente_id, profissional_id,
        inicia_em, termina_em, ocupacao_inicio, ocupacao_fim,
        status, duracao_total_min_snapshot, origem, encaixe)
     VALUES ($1, $2, $3, $4, $5, $4, $5, $6, 30, 'ADMIN', $7)`,
    [
      TENANT_BARBEARIA,
      clienteId,
      profissionalId,
      inicio,
      fim,
      extras.status ?? 'CONFIRMADO',
      extras.encaixe ?? false,
    ],
  );
}

/** O segundo teste de 10.1 do stack, e a razão de `btree_gist` existir. */
describe('corrida no mesmo slot', () => {
  test('duas inserções concorrentes na mesma faixa: uma commita, a outra recebe SLOT_OCUPADO', async () => {
    const primeira = await abrirTenant();
    const segunda = await abrirTenant();

    try {
      await inserir(primeira, '2026-09-01T13:00:00Z', '2026-09-01T13:30:00Z');

      // A segunda sobrepõe por 15 minutos e fica bloqueada até a primeira decidir
      const emEspera = inserir(segunda, '2026-09-01T13:15:00Z', '2026-09-01T13:45:00Z');

      await primeira.query('COMMIT');

      const erro = await emEspera.then(
        () => null,
        (motivo: unknown) => motivo,
      );

      expect(erro).not.toBeNull();
      expect(erro).toMatchObject({ code: '23P01' });

      const traduzido = traduzirErroDoBanco(erro);

      expect(traduzido).toBeInstanceOf(ErroDominio);
      expect((traduzido as ErroDominio).codigo).toBe('SLOT_OCUPADO');
      // A mensagem é exibível e não vaza SQL, tabela nem identificador interno (6.10)
      expect((traduzido as ErroDominio).message).not.toMatch(/agendamentos|gist|23P01/i);
    } finally {
      await segunda.query('ROLLBACK').catch(() => undefined);
      segunda.release();
      await primeira.query('ROLLBACK').catch(() => undefined);
      primeira.release();
      await limpar();
    }
  }, 60_000);

  test('encaixe é permitido sobrepor: é a sobreposição que o gestor autoriza', async () => {
    const conexao = await abrirTenant();

    try {
      await inserir(conexao, '2026-09-02T13:00:00Z', '2026-09-02T13:30:00Z');
      await inserir(conexao, '2026-09-02T13:15:00Z', '2026-09-02T13:45:00Z', { encaixe: true });

      const r = await conexao.query('SELECT count(*)::int AS n FROM agendamentos');

      expect(r.rows[0].n).toBe(2);
    } finally {
      await conexao.query('ROLLBACK');
      conexao.release();
    }
  });

  test('cancelado libera a faixa', async () => {
    const conexao = await abrirTenant();

    try {
      await inserir(conexao, '2026-09-03T13:00:00Z', '2026-09-03T13:30:00Z', {
        status: 'CANCELADO',
      });
      await inserir(conexao, '2026-09-03T13:00:00Z', '2026-09-03T13:30:00Z');

      const r = await conexao.query('SELECT count(*)::int AS n FROM agendamentos');

      expect(r.rows[0].n).toBe(2);
    } finally {
      await conexao.query('ROLLBACK');
      conexao.release();
    }
  });

  test('erro que não é do banco volta intacto', () => {
    const original = new RangeError('nada a ver');

    expect(traduzirErroDoBanco(original)).toBe(original);
  });
});

async function limpar(): Promise<void> {
  const conexao = await abrirTenant();

  try {
    await conexao.query('DELETE FROM agendamentos');
    await conexao.query('COMMIT');
  } finally {
    conexao.release();
  }
}
