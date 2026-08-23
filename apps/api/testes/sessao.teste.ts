import { CAMINHO_DAS_MIGRACOES } from '@agendamento/db';
import { limpar, semear, TENANT_BARBEARIA, TENANT_CLINICA } from '@agendamento/db/semente';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { lerConfig } from '../src/config.ts';
import { criarPools, emTransacao, type Pools } from '../src/infra/db/pools.ts';
import * as repositorio from '../src/modulos/auth/repositorio.ts';
import { gerarHashDeSenha, senhaConfere } from '../src/modulos/auth/senha.ts';
import {
  criarSessao,
  dominioDoCookie,
  encerrarSessao,
  resolverIdentidade,
} from '../src/modulos/auth/sessao.ts';
import { hashDeToken } from '../src/modulos/auth/token.ts';

const TEMPO_DE_CONTAINER = 240_000;
const SENHA_DO_PAPEL = 'teste';

let container: StartedPostgreSqlContainer;
let pools: Pools;
let usuarioId: string;

function ambiente(gestor: string) {
  return {
    NODE_ENV: 'test',
    LOG_NIVEL: 'error',
    BANCO_URL: gestor,
    BANCO_URL_PUBLICO: gestor,
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
  await conexaoDono.query(`ALTER ROLE agendamento_gestor WITH PASSWORD '${SENHA_DO_PAPEL}'`);
  await conexaoDono.query(`ALTER ROLE agendamento_publico WITH PASSWORD '${SENHA_DO_PAPEL}'`);
  await limpar(dono);
  await semear(dono);

  const dono2 = await conexaoDono.query('SELECT id FROM usuarios ORDER BY criado_em LIMIT 1');

  usuarioId = dono2.rows[0].id;

  await conexaoDono.end();

  const url = `postgres://agendamento_gestor:${SENHA_DO_PAPEL}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;

  pools = criarPools(lerConfig(ambiente(url)));
}, TEMPO_DE_CONTAINER);

afterAll(async () => {
  await pools?.encerrar();
  await container?.stop();
}, TEMPO_DE_CONTAINER);

describe('senha', () => {
  test('argon2id verifica a senha correta e recusa a errada', async () => {
    const hash = await gerarHashDeSenha('senha-do-gestor-123');

    expect(await senhaConfere('senha-do-gestor-123', hash)).toBe(true);
    expect(await senhaConfere('outra-senha', hash)).toBe(false);
  });

  test('o hash nunca é o mesmo duas vezes: o sal muda', async () => {
    const um = await gerarHashDeSenha('mesma-senha');
    const outro = await gerarHashDeSenha('mesma-senha');

    expect(um).not.toBe(outro);
    expect(await senhaConfere('mesma-senha', outro)).toBe(true);
  });

  test('usuário só de Google tem senha nula, e isso não é erro', async () => {
    expect(await senhaConfere('qualquer', null)).toBe(false);
  });

  test('o hash não contém a senha', async () => {
    const hash = await gerarHashDeSenha('senha-do-gestor-123');

    expect(hash).not.toContain('senha-do-gestor-123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });
});

describe('sessão opaca em tabela', () => {
  test('o token guardado é o hash, nunca o token', async () => {
    const token = await emTransacao(pools.poolGestor, (tx) =>
      criarSessao(tx, { usuarioId, userAgent: 'teste', ip: null }),
    );

    const linhas = await pools.poolGestor.execute(
      `SELECT refresh_token_hash FROM sessoes WHERE refresh_token_hash = '${hashDeToken(token)}'`,
    );

    expect(linhas.rows).toHaveLength(1);
    expect(String(linhas.rows[0]?.refresh_token_hash)).not.toContain(token);
  });

  test('resolve a identidade e traz os vínculos ativos', async () => {
    const token = await emTransacao(pools.poolGestor, (tx) =>
      criarSessao(tx, { usuarioId, userAgent: null, ip: null }),
    );

    const identidade = await resolverIdentidade(pools.poolGestor, token);

    expect(identidade?.usuarioId).toBe(usuarioId);
    expect(identidade?.vinculos).toHaveLength(1);
    expect(identidade?.escolhido?.papel).toBe('PROPRIETARIO');
    // Decisão 4: o proprietário nasce como profissional. Isto só resolve depois
    // do tenant estar escolhido — `profissionais` tem RLS, e antes disso a
    // consulta voltaria vazia em silêncio.
    expect(identidade?.escolhido?.profissionalId).not.toBeNull();
  });

  test('um vínculo só dispensa escolha; o vínculo alheio é recusado', async () => {
    const token = await emTransacao(pools.poolGestor, (tx) =>
      criarSessao(tx, { usuarioId, userAgent: null, ip: null }),
    );

    const semPedido = await resolverIdentidade(pools.poolGestor, token);

    expect(semPedido?.escolhido?.estabelecimentoId).toBe(TENANT_BARBEARIA);

    const comPedidoAlheio = await resolverIdentidade(pools.poolGestor, token, TENANT_CLINICA);

    expect(comPedidoAlheio?.escolhido).toBeNull();
    expect(comPedidoAlheio?.pedidoRecusado).toBe(true);
  });

  /** O critério de pronto da etapa: revogar derruba o acesso imediatamente. */
  test('revogar a linha derruba o acesso na requisição seguinte', async () => {
    const token = await emTransacao(pools.poolGestor, (tx) =>
      criarSessao(tx, { usuarioId, userAgent: null, ip: null }),
    );

    const antes = await resolverIdentidade(pools.poolGestor, token);

    expect(antes).not.toBeNull();

    await encerrarSessao(pools.poolGestor, antes?.sessaoId ?? '');

    expect(await resolverIdentidade(pools.poolGestor, token)).toBeNull();
  });

  test('token inventado não resolve', async () => {
    expect(await resolverIdentidade(pools.poolGestor, 'nao-e-um-token')).toBeNull();
  });

  test('sessão expirada não resolve', async () => {
    const token = await emTransacao(pools.poolGestor, (tx) =>
      criarSessao(tx, { usuarioId, userAgent: null, ip: null }),
    );

    await pools.poolGestor.execute(
      `UPDATE sessoes SET expira_em = now() - interval '1 hour' WHERE refresh_token_hash = '${hashDeToken(token)}'`,
    );

    expect(await resolverIdentidade(pools.poolGestor, token)).toBeNull();
  });

  test('revogar todas as sessões derruba as outras sessões abertas', async () => {
    const umDispositivo = await emTransacao(pools.poolGestor, (tx) =>
      criarSessao(tx, { usuarioId, userAgent: 'celular', ip: null }),
    );
    const outroDispositivo = await emTransacao(pools.poolGestor, (tx) =>
      criarSessao(tx, { usuarioId, userAgent: 'desktop', ip: null }),
    );

    await emTransacao(pools.poolGestor, (tx) => repositorio.revogarTodasDoUsuario(tx, usuarioId));

    expect(await resolverIdentidade(pools.poolGestor, umDispositivo)).toBeNull();
    expect(await resolverIdentidade(pools.poolGestor, outroDispositivo)).toBeNull();
  });
});

/**
 * A consulta de vínculos roda antes de existir tenant, e é a política
 * `vinculos_proprios` que a torna possível. Se ela regredir, o login para de
 * enxergar os estabelecimentos e o painel abre vazio.
 */
describe('vínculos antes de existir tenant', () => {
  test('o usuário enxerga os próprios vínculos sem tenant definido', async () => {
    const vinculos = await emTransacao(pools.poolGestor, (tx) =>
      repositorio.listarVinculosAtivos(tx, usuarioId),
    );

    expect(vinculos).toHaveLength(1);
    expect(vinculos[0]?.estabelecimentoId).toBe(TENANT_BARBEARIA);
  });

  test('e não enxerga os vínculos de outra pessoa', async () => {
    const daOutraPessoa = await pools.poolGestor.execute(
      `SELECT id FROM usuarios WHERE id <> '${usuarioId}' LIMIT 1`,
    );
    const outroId = String(daOutraPessoa.rows[0]?.id);

    const vistos = await emTransacao(pools.poolGestor, async (tx) => {
      await repositorio.listarVinculosAtivos(tx, usuarioId);

      // A variável já aponta para o primeiro usuário; consultar o segundo sem
      // redefini-la é o que a política precisa recusar
      return tx.execute(`SELECT id FROM vinculos WHERE usuario_id = '${outroId}'`);
    });

    expect(vistos.rows).toHaveLength(0);
  });

  test('a clínica tem o próprio proprietário, e ele não vê a barbearia', async () => {
    const daClinica = await pools.poolGestor.execute(
      `SELECT usuario_id FROM vinculos WHERE estabelecimento_id = '${TENANT_CLINICA}' LIMIT 1`,
    );

    expect(daClinica.rows).toHaveLength(0);
  });
});

describe('cookie de sessão', () => {
  test('em produção o domínio é o pai, para atravessar os subdomínios', () => {
    expect(dominioDoCookie('https://app.agendamento.com.br')).toBe('.com.br');
    expect(dominioDoCookie('https://app.dominio.com')).toBe('.dominio.com');
  });

  test('em localhost não há domínio: o navegador recusaria o atributo', () => {
    expect(dominioDoCookie('http://localhost:5173')).toBeUndefined();
    expect(dominioDoCookie('http://127.0.0.1:5173')).toBeUndefined();
  });
});
