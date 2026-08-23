import { CAMINHO_DAS_MIGRACOES } from '@agendamento/db';
import { limpar, semear, TENANT_BARBEARIA } from '@agendamento/db/semente';
import type { EnviadorEmail, LimitadorTaxa, Mensagem } from '@agendamento/dominio';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { type Aplicacao, criarAplicacao } from '../src/aplicacao.ts';
import { lerConfig } from '../src/config.ts';
import { criarPools, type Pools } from '../src/infra/db/pools.ts';

const TEMPO_DE_CONTAINER = 240_000;
const SENHA_DO_PAPEL = 'teste';
const SENHA = 'uma-senha-longa-o-bastante';

let container: StartedPostgreSqlContainer;
let app: Aplicacao;
let pools: Pools;
let cookieDoDono = '';

const caixaDeSaida: Mensagem[] = [];

const enviadorFalso: EnviadorEmail = {
  async enviar(mensagem) {
    caixaDeSaida.push(mensagem);
  },
};

const semLimite: LimitadorTaxa = {
  async consumir() {
    return { permitido: true, restantes: Number.MAX_SAFE_INTEGER, liberaEm: new Date() };
  },
};

function ambiente(url: string) {
  return {
    NODE_ENV: 'test',
    LOG_NIVEL: 'error',
    BANCO_URL: url,
    BANCO_URL_PUBLICO: url,
    DIRETO_BANCO_URL: url,
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

function tokenDoUltimoEmail(): string {
  const ultimo = caixaDeSaida[caixaDeSaida.length - 1];

  return ultimo?.texto.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? '';
}

function cookieDaResposta(cabecalhos: Record<string, unknown>): string {
  const bruto = cabecalhos['set-cookie'];
  const primeiro = Array.isArray(bruto) ? bruto[0] : bruto;

  return String(primeiro ?? '').split(';')[0] ?? '';
}

/** O proprietário da semente, com senha definida e e-mail verificado. */
async function entrarComoDono(): Promise<string> {
  const email = 'rui@corte-fino.teste';

  await app.inject({ method: 'POST', url: '/auth/recuperacao', payload: { email } });
  await app.inject({
    method: 'POST',
    url: '/auth/nova-senha',
    payload: { token: tokenDoUltimoEmail(), senha: SENHA },
  });

  const entrada = await app.inject({
    method: 'POST',
    url: '/auth/entrada',
    payload: { email, senha: SENHA },
  });

  return cookieDaResposta(entrada.headers);
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
  await conexaoDono.end();

  const url = `postgres://agendamento_gestor:${SENHA_DO_PAPEL}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;
  const config = lerConfig(ambiente(url));

  pools = criarPools(config);
  app = await criarAplicacao({ config, pools, limitador: semLimite });
  app.portas.email = enviadorFalso;

  await app.ready();

  cookieDoDono = await entrarComoDono();
}, TEMPO_DE_CONTAINER);

afterAll(async () => {
  await app?.close();
  await pools?.encerrar();
  await container?.stop();
}, TEMPO_DE_CONTAINER);

beforeEach(() => {
  caixaDeSaida.length = 0;
});

/**
 * O critério de pronto: o convite fecha o ciclo até ATIVO. A recuperação de
 * senha do dono, usada no `beforeAll`, já é o outro critério exercido.
 */
describe('convite de equipe', () => {
  test('o dono convida, e o e-mail diz o papel', async () => {
    const convite = await app.inject({
      method: 'POST',
      url: '/equipe/convites',
      headers: { cookie: cookieDoDono },
      payload: { nome: 'Ana Recepção', email: 'ana@corte-fino.teste', papel: 'ADMIN' },
    });

    expect(convite.statusCode).toBe(200);
    expect(caixaDeSaida).toHaveLength(1);
    expect(caixaDeSaida[0]?.assunto).toContain('convidou você para');
    // Quem recebe precisa saber o que está aceitando (seção 4 do conteúdo)
    expect(caixaDeSaida[0]?.texto).toContain('Admin');
  });

  test('o vínculo nasce CONVIDADO: aceitar é o que dá acesso', async () => {
    await app.inject({
      method: 'POST',
      url: '/equipe/convites',
      headers: { cookie: cookieDoDono },
      payload: { nome: 'Bruno Caixa', email: 'bruno@corte-fino.teste', papel: 'FUNCIONARIO' },
    });

    const antes = await app.inject({
      method: 'POST',
      url: '/auth/entrada',
      payload: { email: 'bruno@corte-fino.teste', senha: SENHA },
    });

    // Sem senha e sem aceite, não existe entrada
    expect(antes.statusCode).toBe(403);

    const aceite = await app.inject({
      method: 'POST',
      url: '/auth/convite',
      payload: { token: tokenDoUltimoEmail(), senha: SENHA },
    });

    expect(aceite.statusCode).toBe(200);

    const cookie = cookieDaResposta(aceite.headers);
    const eu = await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie } });

    expect(eu.statusCode).toBe(200);
    expect(eu.json().estabelecimentos).toEqual([{ id: TENANT_BARBEARIA, papel: 'FUNCIONARIO' }]);
    expect(eu.json().estabelecimentoAtual).toBe(TENANT_BARBEARIA);
  });

  test('aceitar define a senha e verifica o e-mail: entrar direto passa a funcionar', async () => {
    const entrada = await app.inject({
      method: 'POST',
      url: '/auth/entrada',
      payload: { email: 'bruno@corte-fino.teste', senha: SENHA },
    });

    expect(entrada.statusCode).toBe(200);
  });

  test('o convite é de uso único', async () => {
    await app.inject({
      method: 'POST',
      url: '/equipe/convites',
      headers: { cookie: cookieDoDono },
      payload: { nome: 'Carla', email: 'carla@corte-fino.teste', papel: 'FUNCIONARIO' },
    });

    const token = tokenDoUltimoEmail();

    expect(
      (await app.inject({ method: 'POST', url: '/auth/convite', payload: { token, senha: SENHA } }))
        .statusCode,
    ).toBe(200);

    expect(
      (await app.inject({ method: 'POST', url: '/auth/convite', payload: { token, senha: SENHA } }))
        .statusCode,
    ).toBe(404);
  });

  test('funcionário não convida ninguém: a matriz de 2.3 decide', async () => {
    const doBruno = await app.inject({
      method: 'POST',
      url: '/auth/entrada',
      payload: { email: 'bruno@corte-fino.teste', senha: SENHA },
    });

    const tentativa = await app.inject({
      method: 'POST',
      url: '/equipe/convites',
      headers: { cookie: cookieDaResposta(doBruno.headers) },
      payload: { nome: 'Alguém', email: 'alguem@corte-fino.teste', papel: 'ADMIN' },
    });

    expect(tentativa.statusCode).toBe(403);
    expect(caixaDeSaida).toHaveLength(0);
  });

  test('sem sessão não se convida', async () => {
    const tentativa = await app.inject({
      method: 'POST',
      url: '/equipe/convites',
      payload: { nome: 'Alguém', email: 'outro@corte-fino.teste', papel: 'ADMIN' },
    });

    expect(tentativa.statusCode).toBe(403);
  });
});

describe('recuperação de senha', () => {
  test('pedido para e-mail inexistente responde igual, e não envia', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/auth/recuperacao',
      payload: { email: 'ninguem@teste.local' },
    });

    expect(resposta.statusCode).toBe(200);
    expect(caixaDeSaida).toHaveLength(0);
  });

  test('redefinir derruba todas as sessões abertas', async () => {
    const email = 'bruno@corte-fino.teste';

    const umDispositivo = cookieDaResposta(
      (await app.inject({ method: 'POST', url: '/auth/entrada', payload: { email, senha: SENHA } }))
        .headers,
    );
    const outroDispositivo = cookieDaResposta(
      (await app.inject({ method: 'POST', url: '/auth/entrada', payload: { email, senha: SENHA } }))
        .headers,
    );

    expect(
      (await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie: umDispositivo } }))
        .statusCode,
    ).toBe(200);

    await app.inject({ method: 'POST', url: '/auth/recuperacao', payload: { email } });
    await app.inject({
      method: 'POST',
      url: '/auth/nova-senha',
      payload: { token: tokenDoUltimoEmail(), senha: 'uma-senha-nova-e-longa' },
    });

    // Quem redefine desconfia que alguém tem a senha antiga: manter as sessões
    // vivas manteria o invasor dentro
    for (const cookie of [umDispositivo, outroDispositivo]) {
      expect(
        (await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie } })).statusCode,
      ).toBe(403);
    }

    const comANova = await app.inject({
      method: 'POST',
      url: '/auth/entrada',
      payload: { email, senha: 'uma-senha-nova-e-longa' },
    });

    expect(comANova.statusCode).toBe(200);
  });

  test('um pedido novo invalida o link anterior', async () => {
    const email = 'rui@corte-fino.teste';

    await app.inject({ method: 'POST', url: '/auth/recuperacao', payload: { email } });

    const antigo = tokenDoUltimoEmail();

    await app.inject({ method: 'POST', url: '/auth/recuperacao', payload: { email } });

    const recente = tokenDoUltimoEmail();

    expect(antigo).not.toBe(recente);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/nova-senha',
          payload: { token: antigo, senha: SENHA },
        })
      ).statusCode,
    ).toBe(404);
  });

  test('token de verificação não serve como redefinição de senha', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/cadastro',
      payload: { nome: 'Dora', email: 'dora@teste.local', senha: SENHA },
    });

    const deVerificacao = tokenDoUltimoEmail();

    const tentativa = await app.inject({
      method: 'POST',
      url: '/auth/nova-senha',
      payload: { token: deVerificacao, senha: 'outra-senha-longa' },
    });

    expect(tentativa.statusCode).toBe(404);
  });
});
