import { CAMINHO_DAS_MIGRACOES } from '@agendamento/db';
import { limpar, semear, TENANT_BARBEARIA } from '@agendamento/db/semente';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { type Aplicacao, criarAplicacao } from '../src/aplicacao.ts';
import { lerConfig } from '../src/config.ts';
import { criarPools, type Pools } from '../src/infra/db/pools.ts';
import { buscarPorSlug } from '../src/modulos/estabelecimentos/repositorio.ts';

const TEMPO_DE_CONTAINER = 180_000;
const SENHA = 'teste';

let container: StartedPostgreSqlContainer;
let app: Aplicacao;
let pools: Pools;
let servicoId: string;
let profissionalId: string;
let buscasDeTenant = 0;

function ambiente(gestor: string, publico: string) {
  return {
    NODE_ENV: 'test',
    LOG_NIVEL: 'error',
    BANCO_URL: gestor,
    BANCO_URL_PUBLICO: publico,
    DIRETO_BANCO_URL: gestor,
    SESSAO_SEGREDO: 'x'.repeat(32),
    APP_URL: 'http://localhost:5173',
    API_URL: 'http://localhost:3000',
    AUTH_URL: 'http://localhost:3000/auth',
    PUBLICO_DOMINIO_BASE: 'localhost:3001',
    EMAIL_PROVEDOR: 'SMTP',
    EMAIL_SMTP_HOST: 'localhost',
    EMAIL_SMTP_PORTA: '1025',
    EMAIL_REMETENTE: 'nao-responda@agendamento.local',
    OTP_CANAL: 'LOG',
    ARMAZENAMENTO_TIPO: 'DISCO',
    ARMAZENAMENTO_DIRETORIO: './.dados/teste',
  };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine').start();

  const conexaoDono = new Pool({ connectionString: container.getConnectionUri() });
  const dono = drizzle(conexaoDono);

  await migrate(dono, { migrationsFolder: CAMINHO_DAS_MIGRACOES });
  await conexaoDono.query(`ALTER ROLE agendamento_gestor WITH PASSWORD '${SENHA}'`);
  await conexaoDono.query(`ALTER ROLE agendamento_publico WITH PASSWORD '${SENHA}'`);
  await limpar(dono);
  await semear(dono);

  const alvo = await conexaoDono.query(
    'SELECT (SELECT id FROM servicos WHERE estabelecimento_id = $1 LIMIT 1) AS servico, (SELECT id FROM profissionais WHERE estabelecimento_id = $1 LIMIT 1) AS profissional',
    [TENANT_BARBEARIA],
  );

  servicoId = alvo.rows[0].servico;
  profissionalId = alvo.rows[0].profissional;

  await conexaoDono.end();

  const como = (papel: string) =>
    `postgres://${papel}:${SENHA}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;

  const config = lerConfig(ambiente(como('agendamento_gestor'), como('agendamento_publico')));

  pools = criarPools(config);
  app = await criarAplicacao({
    config,
    pools,
    buscarPorSlug: async (executor, slug) => {
      buscasDeTenant += 1;
      return buscarPorSlug(executor, slug);
    },
  });

  await app.ready();
}, TEMPO_DE_CONTAINER);

afterAll(async () => {
  await app?.close();
  await pools?.encerrar();
  await container?.stop();
}, TEMPO_DE_CONTAINER);

beforeEach(() => {
  buscasDeTenant = 0;
});

/**
 * O critério de pronto da etapa 3: uma rota real atravessa o caminho de 6.3 do
 * stack — contexto montado, `set_config` transaction-local, caso de uso,
 * repositório recebendo o executor, e `ErroDominio` traduzido em HTTP pelo
 * único plugin que conhece status.
 */
describe('o caminho de 6.3, ponta a ponta', () => {
  test('saúde responde e alcança o banco', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/saude' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, banco: true });
  });

  test('o catálogo sai pelo pool público, com o tenant resolvido pelo slug', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/publico/corte-fino/catalogo' });

    expect(resposta.statusCode).toBe(200);

    const corpo = resposta.json();

    expect(corpo.estabelecimento.nome).toBe('Barbearia Corte Fino');
    expect(corpo.servicos).toHaveLength(1);
    expect(corpo.profissionais[0].servicoIds).toEqual([servicoId]);
  });

  test('slots atravessa até o motor de disponibilidade e volta com horários', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/publico/corte-fino/slots?data=${proximaTerca()}&servicos=${servicoId}`,
    });

    expect(resposta.statusCode).toBe(200);

    const corpo = resposta.json();

    expect(corpo.data).toBe(proximaTerca());
    expect(corpo.slots.length).toBeGreaterThan(0);
    expect(corpo.slots[0].profissionalIds).toEqual([profissionalId]);
    // T15 — disponibilidade nunca é cacheada
    expect(resposta.headers['cache-control']).toBe('no-store');
  });

  test('o tenant é resolvido uma vez por requisição, não duas', async () => {
    await app.inject({ method: 'GET', url: '/publico/corte-fino/catalogo' });

    expect(buscasDeTenant).toBe(1);

    buscasDeTenant = 0;

    await app.inject({
      method: 'GET',
      url: `/publico/corte-fino/slots?data=${proximaTerca()}&servicos=${servicoId}`,
    });

    expect(buscasDeTenant).toBe(1);
  });

  test('dias com vaga responde para o mês', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/publico/corte-fino/dias-com-vaga?mes=${proximaTerca().slice(0, 7)}&servicos=${servicoId}`,
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().dias.length).toBeGreaterThan(0);
  });
});

describe('isolamento entre tenants pela rota', () => {
  test('serviço de outro tenant não é encontrado', async () => {
    const daClinica = await app.inject({ method: 'GET', url: '/publico/bem-estar/catalogo' });
    const servicoDaClinica = daClinica.json().servicos[0].id;

    const resposta = await app.inject({
      method: 'GET',
      url: `/publico/corte-fino/slots?data=${proximaTerca()}&servicos=${servicoDaClinica}`,
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json().erro.codigo).toBe('NAO_ENCONTRADO');
  });
});

describe('ErroDominio traduzido em HTTP', () => {
  test('slug inexistente vira 404 com o formato de 6.10', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/publico/nao-existe/catalogo' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: { codigo: 'NAO_ENCONTRADO', mensagem: expect.any(String) },
    });
  });

  test('entrada inválida vira 422 com erro por campo, sem escrever nada na rota', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/publico/corte-fino/slots?data=01-09-2026&servicos=${servicoId}`,
    });

    expect(resposta.statusCode).toBe(422);

    const { erro } = resposta.json();

    expect(erro.codigo).toBe('DADOS_INVALIDOS');
    expect(erro.campos.data).toEqual(['use o formato AAAA-MM-DD']);
  });

  test('serviço repetido diz o que é, em vez de dizer que não existe', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/publico/corte-fino/slots?data=${proximaTerca()}&servicos=${servicoId},${servicoId}`,
    });

    expect(resposta.statusCode).toBe(422);

    const { erro } = resposta.json();

    expect(erro.codigo).toBe('DADOS_INVALIDOS');
    expect(erro.mensagem).toMatch(/uma vez/);
    expect(erro.campos.servicos).toEqual(['serviço repetido']);
  });

  test('mais de cinco serviços é recusado pelo contrato', async () => {
    const seis = Array.from({ length: 6 }, () => servicoId).join(',');
    const resposta = await app.inject({
      method: 'GET',
      url: `/publico/corte-fino/slots?data=${proximaTerca()}&servicos=${seis}`,
    });

    expect(resposta.statusCode).toBe(422);
  });

  test('nenhuma mensagem de erro vaza SQL, tabela ou stack', async () => {
    const respostas = await Promise.all([
      app.inject({ method: 'GET', url: '/publico/nao-existe/catalogo' }),
      app.inject({ method: 'GET', url: '/publico/corte-fino/slots?data=x&servicos=y' }),
      app.inject({ method: 'GET', url: '/rota/que/nao/existe' }),
    ]);

    for (const resposta of respostas) {
      expect(resposta.json().erro.mensagem).not.toMatch(
        /select|insert|postgres|drizzle|at .*\.ts:|estabelecimentos|agendamentos/i,
      );
    }
  });
});

describe('limite de taxa', () => {
  test('excesso vira 429, não 409', async () => {
    const url = `/publico/corte-fino/slots?data=${proximaTerca()}&servicos=${servicoId}`;
    let ultimo = 200;

    // O limite de slots é 60 por minuto
    for (let i = 0; i < 70 && ultimo !== 429; i += 1) {
      ultimo = (await app.inject({ method: 'GET', url })).statusCode;
    }

    expect(ultimo).toBe(429);
  });
});

function proximaTerca(): string {
  const hoje = new Date();
  const alvo = new Date(hoje);

  alvo.setUTCDate(hoje.getUTCDate() + ((2 - hoje.getUTCDay() + 7) % 7 || 7));

  return alvo.toISOString().slice(0, 10);
}
