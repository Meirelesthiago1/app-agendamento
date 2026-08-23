import { CAMINHO_DAS_MIGRACOES } from '@agendamento/db';
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

let container: StartedPostgreSqlContainer;
let app: Aplicacao;
let pools: Pools;

/** Captura o que sairia pelo SMTP, para o teste ler o link. */
const caixaDeSaida: Mensagem[] = [];

const enviadorFalso: EnviadorEmail = {
  async enviar(mensagem) {
    caixaDeSaida.push(mensagem);
  },
};

/**
 * O limite real de `/auth/cadastro` é cinco por minuto, e existe para barrar
 * exatamente o que este arquivo faz: dezenas de cadastros do mesmo IP. Quem
 * verifica o limitador é `caminho-completo.teste.ts`.
 */
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
  const achado = ultimo?.texto.match(/token=([A-Za-z0-9_-]+)/);

  return achado?.[1] ?? '';
}

function cookieDaResposta(cabecalhos: Record<string, unknown>): string {
  const bruto = cabecalhos['set-cookie'];
  const primeiro = Array.isArray(bruto) ? bruto[0] : bruto;

  return String(primeiro ?? '').split(';')[0] ?? '';
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine').start();

  const conexaoDono = new Pool({ connectionString: container.getConnectionUri() });

  await migrate(drizzle(conexaoDono), { migrationsFolder: CAMINHO_DAS_MIGRACOES });
  await conexaoDono.query(`ALTER ROLE agendamento_gestor WITH PASSWORD '${SENHA_DO_PAPEL}'`);
  await conexaoDono.query(`ALTER ROLE agendamento_publico WITH PASSWORD '${SENHA_DO_PAPEL}'`);
  await conexaoDono.end();

  const url = `postgres://agendamento_gestor:${SENHA_DO_PAPEL}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;
  const config = lerConfig(ambiente(url));

  pools = criarPools(config);
  app = await criarAplicacao({ config, pools, limitador: semLimite });
  app.portas.email = enviadorFalso;

  await app.ready();
}, TEMPO_DE_CONTAINER);

afterAll(async () => {
  await app?.close();
  await pools?.encerrar();
  await container?.stop();
}, TEMPO_DE_CONTAINER);

beforeEach(() => {
  caixaDeSaida.length = 0;
});

const SENHA = 'uma-senha-longa-o-bastante';

async function cadastrar(email: string, nome = 'Rui Barbosa') {
  return app.inject({
    method: 'POST',
    url: '/auth/cadastro',
    payload: { nome, email, senha: SENHA },
  });
}

async function entrar(email: string, senha = SENHA) {
  return app.inject({ method: 'POST', url: '/auth/entrada', payload: { email, senha } });
}

/** Cada teste cria o seu, para não depender da ordem nem da caixa do anterior. */
async function gestorVerificado(email: string, nome = 'Rui Barbosa') {
  await cadastrar(email, nome);

  await app.inject({
    method: 'POST',
    url: '/auth/verificar-email',
    payload: { token: tokenDoUltimoEmail() },
  });

  return entrar(email);
}

/** O critério de pronto: cadastro → verificação → sessão de 30 dias. */
describe('o ciclo do gestor', () => {
  test('cadastro envia a verificação e não deixa entrar antes dela', async () => {
    const cadastro = await cadastrar('antes@teste.local');

    expect(cadastro.statusCode).toBe(200);
    expect(caixaDeSaida).toHaveLength(1);
    expect(caixaDeSaida[0]?.assunto).toBe('Confirme seu e-mail');

    expect((await entrar('antes@teste.local')).statusCode).toBe(403);
  });

  test('verificar o e-mail destrava a entrada, e a sessão resolve a identidade', async () => {
    await cadastrar('ciclo@teste.local');

    const token = tokenDoUltimoEmail();

    expect(token.length).toBeGreaterThan(20);

    const verificacao = await app.inject({
      method: 'POST',
      url: '/auth/verificar-email',
      payload: { token },
    });

    expect(verificacao.statusCode).toBe(200);

    const entrada = await entrar('ciclo@teste.local');

    expect(entrada.statusCode).toBe(200);
    expect(entrada.json().email).toBe('ciclo@teste.local');

    const cookie = cookieDaResposta(entrada.headers);

    expect(cookie).toContain('sessao=');

    const eu = await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie } });

    expect(eu.statusCode).toBe(200);
    expect(eu.json().nome).toBe('Rui Barbosa');
    // Conta nova ainda não tem estabelecimento: o wizard da etapa 8 cria o dele
    expect(eu.json().estabelecimentos).toEqual([]);
  });

  test('o cookie de sessão é HttpOnly, SameSite=Lax e dura 30 dias', async () => {
    const entrada = await gestorVerificado('cookie@teste.local');
    const bruto = String(entrada.headers['set-cookie']);

    expect(bruto).toContain('HttpOnly');
    expect(bruto).toContain('SameSite=Lax');
    expect(bruto).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
  });

  test('sair revoga a sessão: o mesmo cookie deixa de valer', async () => {
    const entrada = await gestorVerificado('sair@teste.local');
    const cookie = cookieDaResposta(entrada.headers);

    expect(
      (await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie } })).statusCode,
    ).toBe(200);

    await app.inject({ method: 'POST', url: '/auth/saida', headers: { cookie } });

    expect(
      (await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie } })).statusCode,
    ).toBe(403);
  });
});

/** 1.1: nenhuma superfície distingue "não existe" de "está errado". */
describe('o que a autenticação nunca revela', () => {
  test('cadastro com e-mail já usado responde igual, e não manda e-mail', async () => {
    await cadastrar('repetido@teste.local');

    caixaDeSaida.length = 0;

    const repetido = await cadastrar('repetido@teste.local', 'Outra Pessoa');

    expect(repetido.statusCode).toBe(200);
    expect(repetido.json()).toEqual({ ok: true });
    expect(caixaDeSaida).toHaveLength(0);
  });

  test('senha errada e e-mail inexistente dão a mesma resposta', async () => {
    await gestorVerificado('existente@teste.local');

    const senhaErrada = await entrar('existente@teste.local', 'senha-errada-mas-longa');
    const naoExiste = await entrar('ninguem@teste.local', 'senha-errada-mas-longa');

    expect(senhaErrada.statusCode).toBe(naoExiste.statusCode);
    expect(senhaErrada.json().erro.mensagem).toBe(naoExiste.json().erro.mensagem);
    expect(senhaErrada.json().erro.mensagem).toBe('E-mail ou senha incorretos.');
  });

  test('reenviar verificação para e-mail inexistente responde igual, sem enviar', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/auth/reenviar-verificacao',
      payload: { email: 'ninguem@teste.local' },
    });

    expect(resposta.statusCode).toBe(200);
    expect(caixaDeSaida).toHaveLength(0);
  });
});

describe('token de verificação', () => {
  test('é de uso único', async () => {
    await cadastrar('unico@teste.local', 'Nina Prado');

    const token = tokenDoUltimoEmail();

    expect(
      (await app.inject({ method: 'POST', url: '/auth/verificar-email', payload: { token } }))
        .statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'POST', url: '/auth/verificar-email', payload: { token } }))
        .statusCode,
    ).toBe(404);
  });

  test('token inventado não verifica ninguém', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/auth/verificar-email',
      payload: { token: 'x'.repeat(43) },
    });

    expect(resposta.statusCode).toBe(404);
  });

  test('a senha precisa ter no mínimo oito caracteres, e o erro aponta o campo', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/auth/cadastro',
      payload: { nome: 'Alguém', email: 'curta@teste.local', senha: 'curta' },
    });

    expect(resposta.statusCode).toBe(422);
    expect(resposta.json().erro.campos).toHaveProperty('senha');
  });
});
