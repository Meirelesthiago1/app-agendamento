import { CAMINHO_DAS_MIGRACOES } from '@agendamento/db';
import { limpar, semear, TENANT_BARBEARIA } from '@agendamento/db/semente';
import type { EnviadorEmail, LimitadorTaxa, Mensagem } from '@agendamento/dominio';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
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
let cookieDoFuncionario = '';

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
  return caixaDeSaida[caixaDeSaida.length - 1]?.texto.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? '';
}

function cookieDaResposta(cabecalhos: Record<string, unknown>): string {
  const bruto = cabecalhos['set-cookie'];
  const primeiro = Array.isArray(bruto) ? bruto[0] : bruto;

  return String(primeiro ?? '').split(';')[0] ?? '';
}

const CABECALHO = { 'x-estabelecimento': TENANT_BARBEARIA };

async function obter(cookie: string) {
  return app.inject({
    method: 'GET',
    url: '/configuracoes',
    headers: { cookie, ...CABECALHO },
  });
}

async function salvarDados(cookie: string, mudanca: Record<string, unknown>) {
  const atual = (await obter(cookie)).json().estabelecimento as Record<string, unknown>;
  const { id: _ignorado, ...editaveis } = atual;

  return app.inject({
    method: 'PATCH',
    url: '/configuracoes/estabelecimento',
    headers: { cookie, ...CABECALHO },
    payload: { ...editaveis, ...mudanca },
  });
}

async function salvarPoliticas(cookie: string, mudanca: Record<string, unknown>) {
  const atuais = (await obter(cookie)).json().politicas as Record<string, unknown>;

  return app.inject({
    method: 'PATCH',
    url: '/configuracoes/politicas',
    headers: { cookie, ...CABECALHO },
    payload: { ...atuais, ...mudanca },
  });
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

  const email = 'rui@corte-fino.teste';

  await app.inject({ method: 'POST', url: '/auth/recuperacao', payload: { email } });
  await app.inject({
    method: 'POST',
    url: '/auth/nova-senha',
    payload: { token: tokenDoUltimoEmail(), senha: SENHA },
  });

  cookieDoDono = cookieDaResposta(
    (await app.inject({ method: 'POST', url: '/auth/entrada', payload: { email, senha: SENHA } }))
      .headers,
  );

  await app.inject({
    method: 'POST',
    url: '/equipe/convites',
    headers: { cookie: cookieDoDono, ...CABECALHO },
    payload: { nome: 'Zé Balcão', email: 'ze@corte-fino.teste', papel: 'FUNCIONARIO' },
  });

  cookieDoFuncionario = cookieDaResposta(
    (
      await app.inject({
        method: 'POST',
        url: '/auth/convite',
        payload: { token: tokenDoUltimoEmail(), senha: SENHA },
      })
    ).headers,
  );
}, TEMPO_DE_CONTAINER);

afterAll(async () => {
  await app?.close();
  await pools?.encerrar();
  await container?.stop();
}, TEMPO_DE_CONTAINER);

describe('leitura da configuração', () => {
  test('estabelecimento e as doze políticas vêm na mesma resposta', async () => {
    const resposta = await obter(cookieDoDono);

    expect(resposta.statusCode).toBe(200);

    const corpo = resposta.json();

    expect(corpo.estabelecimento.slug).toBe('corte-fino');
    // As doze chaves de 8.2, contadas: faltar uma é a tela editar o que não salva
    expect(Object.keys(corpo.politicas)).toHaveLength(12);
    expect(corpo.politicas.granularidadeSlotMin).toBe(15);
    expect(corpo.politicas.maxAtivosPorCliente).toBeNull();
  });

  test('sem sessão não se lê configuração de ninguém', async () => {
    expect((await app.inject({ method: 'GET', url: '/configuracoes' })).statusCode).toBe(403);
  });
});

describe('quem pode escrever', () => {
  test('o proprietário altera os dados públicos', async () => {
    const resposta = await salvarDados(cookieDoDono, {
      telefonePublico: '11987654321',
      enderecoPublico: 'Rua das Tesouras, 42',
      corTema: '#3b82f6',
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().estabelecimento.telefonePublico).toBe('11987654321');

    // Releitura, e não só a resposta do PATCH: prova que persistiu
    expect((await obter(cookieDoDono)).json().estabelecimento.enderecoPublico).toBe(
      'Rua das Tesouras, 42',
    );
  });

  /** A matriz de 2.3 não dá `configuracoes.escrever` a FUNCIONARIO. */
  test('funcionário lê, mas não escreve', async () => {
    expect((await obter(cookieDoFuncionario)).statusCode).toBe(200);
    expect((await salvarDados(cookieDoFuncionario, { nome: 'Outro Nome' })).statusCode).toBe(403);
    expect((await salvarPoliticas(cookieDoFuncionario, {})).statusCode).toBe(403);
  });

  test('a recusa não deixa rastro: o nome continua o mesmo', async () => {
    expect((await obter(cookieDoDono)).json().estabelecimento.nome).toBe('Barbearia Corte Fino');
  });
});

describe('o que a validação recusa', () => {
  test('slug reservado é recusado antes de chegar ao banco', async () => {
    expect((await salvarDados(cookieDoDono, { slug: 'admin' })).statusCode).toBe(422);
  });

  test('slug de outro estabelecimento responde conflito, não erro de constraint', async () => {
    // `bem-estar` é o segundo tenant da semente. A RLS deixa ler estabelecimento
    // de outro tenant de propósito: é assim que o slug público é resolvido
    const resposta = await salvarDados(cookieDoDono, { slug: 'bem-estar' });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json().erro.mensagem).toContain('em uso');
    expect((await obter(cookieDoDono)).json().estabelecimento.slug).toBe('corte-fino');
  });

  test('o próprio slug continua livre para si mesmo', async () => {
    expect((await salvarDados(cookieDoDono, { slug: 'corte-fino' })).statusCode).toBe(200);
  });

  test('fuso fora do Brasil é recusado', async () => {
    expect((await salvarDados(cookieDoDono, { fusoHorario: 'Europe/Lisbon' })).statusCode).toBe(
      422,
    );
  });

  test('granularidade zero é recusada: dividiria por zero no motor de slots', async () => {
    expect((await salvarPoliticas(cookieDoDono, { granularidadeSlotMin: 0 })).statusCode).toBe(422);
  });

  test('máximo de ativos aceita nulo, que é "sem limite", mas não zero', async () => {
    expect((await salvarPoliticas(cookieDoDono, { maxAtivosPorCliente: null })).statusCode).toBe(
      200,
    );
    expect((await salvarPoliticas(cookieDoDono, { maxAtivosPorCliente: 0 })).statusCode).toBe(422);
  });
});

describe('a política salva chega ao fluxo público', () => {
  test('mudar permiteMultiplosServicos muda o que o catálogo publica', async () => {
    expect(
      (await salvarPoliticas(cookieDoDono, { permiteMultiplosServicos: false })).statusCode,
    ).toBe(200);

    const catalogo = await app.inject({ method: 'GET', url: '/publico/corte-fino/catalogo' });

    expect(catalogo.json().estabelecimento.permiteMultiplosServicos).toBe(false);

    await salvarPoliticas(cookieDoDono, { permiteMultiplosServicos: true });
  });

  test('mudar a janela muda o que o catálogo anuncia', async () => {
    await salvarPoliticas(cookieDoDono, { janelaAgendamentoDias: 30 });

    const catalogo = await app.inject({ method: 'GET', url: '/publico/corte-fino/catalogo' });

    expect(catalogo.json().estabelecimento.janelaAgendamentoDias).toBe(30);
  });
});
