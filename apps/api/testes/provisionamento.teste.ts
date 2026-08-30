import { CAMINHO_DAS_MIGRACOES } from '@agendamento/db';
import type { EnviadorEmail, LimitadorTaxa, Mensagem } from '@agendamento/dominio';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { type Aplicacao, criarAplicacao } from '../src/aplicacao.ts';
import { type Config, lerConfig } from '../src/config.ts';
import { criarPools, type Pools } from '../src/infra/db/pools.ts';
import { provisionarTenant } from '../src/modulos/estabelecimentos/provisionar.ts';

const TEMPO_DE_CONTAINER = 240_000;
const SENHA_DO_PAPEL = 'teste';
const SENHA = 'uma-senha-longa-o-bastante';

let container: StartedPostgreSqlContainer;
let app: Aplicacao;
let pools: Pools;
let config: Config;
/** A conexão do dono: provisionar acontece antes de existir tenant. */
let conexaoDona: Pool;

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

async function provisionar(slug: string, email: string, nome = 'Barbearia Nova') {
  return provisionarTenant(
    { executor: drizzle(conexaoDona), config, email: enviadorFalso },
    {
      nome,
      slug,
      fusoHorario: 'America/Sao_Paulo',
      segmento: 'barbearia',
      plano: 'padrao',
      proprietario: { nome: 'Dona da Casa', email },
    },
  );
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine').start();

  conexaoDona = new Pool({ connectionString: container.getConnectionUri() });

  await migrate(drizzle(conexaoDona), { migrationsFolder: CAMINHO_DAS_MIGRACOES });
  await conexaoDona.query(`ALTER ROLE agendamento_gestor WITH PASSWORD '${SENHA_DO_PAPEL}'`);
  await conexaoDona.query(`ALTER ROLE agendamento_publico WITH PASSWORD '${SENHA_DO_PAPEL}'`);

  const url = `postgres://agendamento_gestor:${SENHA_DO_PAPEL}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;

  config = lerConfig(ambiente(url));
  pools = criarPools(config);
  app = await criarAplicacao({ config, pools, limitador: semLimite });
  app.portas.email = enviadorFalso;

  await app.ready();
}, TEMPO_DE_CONTAINER);

afterAll(async () => {
  await app?.close();
  await pools?.encerrar();
  await conexaoDona?.end();
  await container?.stop();
}, TEMPO_DE_CONTAINER);

beforeEach(() => {
  caixaDeSaida.length = 0;
});

/** 2.2: não existe cadastro aberto de gestor. O tenant nasce provisionado. */
describe('o cadastro aberto não existe', () => {
  test('a rota de cadastro foi removida, não desabilitada', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/auth/cadastro',
      payload: { nome: 'Intruso', email: 'intruso@teste.local', senha: SENHA },
    });

    expect(resposta.statusCode).toBe(404);
  });

  test('verificação de e-mail e reenvio também saíram', async () => {
    for (const url of ['/auth/verificar-email', '/auth/reenviar-verificacao']) {
      const resposta = await app.inject({
        method: 'POST',
        url,
        payload: { token: 'x'.repeat(30) },
      });

      expect(resposta.statusCode, url).toBe(404);
    }
  });
});

describe('provisionar um tenant', () => {
  test('cria estabelecimento, configuração, vínculo e profissional de uma vez', async () => {
    const tenant = await provisionar('barbearia-nova', 'dona@nova.teste');

    const { rows } = await conexaoDona.query<{
      configuracoes: string;
      vinculos: string;
      papel: string;
      status: string;
      profissionais: string;
      profissional_ligado: string;
    }>(
      `SELECT
         (SELECT count(*) FROM configuracoes WHERE estabelecimento_id = $1)::text AS configuracoes,
         (SELECT count(*) FROM vinculos WHERE estabelecimento_id = $1)::text AS vinculos,
         (SELECT papel::text FROM vinculos WHERE estabelecimento_id = $1) AS papel,
         (SELECT status::text FROM vinculos WHERE estabelecimento_id = $1) AS status,
         (SELECT count(*) FROM profissionais WHERE estabelecimento_id = $1)::text AS profissionais,
         (SELECT count(*) FROM profissionais WHERE estabelecimento_id = $1
            AND vinculo_id IS NOT NULL)::text AS profissional_ligado`,
      [tenant.estabelecimentoId],
    );

    const linha = rows[0];

    expect(linha?.configuracoes).toBe('1');
    expect(linha?.vinculos).toBe('1');
    expect(linha?.papel).toBe('PROPRIETARIO');
    // Nasce CONVIDADO: quem ativa é o aceite, nunca o provisionamento
    expect(linha?.status).toBe('CONVIDADO');
    // Decisão 4: o proprietário já nasce atendendo
    expect(linha?.profissionais).toBe('1');
    expect(linha?.profissional_ligado).toBe('1');
  });

  test('as configurações nascem com os padrões de 8.2', async () => {
    const tenant = await provisionar('padroes', 'padroes@nova.teste');

    const { rows } = await conexaoDona.query<{
      granularidade_slot_min: number;
      janela_agendamento_dias: number;
      confirmacao_automatica: boolean;
      max_ativos_por_cliente: number | null;
    }>('SELECT * FROM configuracoes WHERE estabelecimento_id = $1', [tenant.estabelecimentoId]);

    expect(rows[0]?.granularidade_slot_min).toBe(15);
    expect(rows[0]?.janela_agendamento_dias).toBe(14);
    expect(rows[0]?.confirmacao_automatica).toBe(true);
    expect(rows[0]?.max_ativos_por_cliente).toBeNull();
  });

  test('o convite sai por e-mail, e o link volta no retorno', async () => {
    const tenant = await provisionar('com-convite', 'convite@nova.teste');

    expect(caixaDeSaida).toHaveLength(1);
    expect(caixaDeSaida[0]?.assunto).toContain('convidou você para');
    expect(caixaDeSaida[0]?.texto).toContain('Proprietário');
    expect(tenant.linkDoConvite).toContain('/convite?token=');
  });

  test('slug repetido é recusado, e nada é criado pela metade', async () => {
    await provisionar('unico', 'primeiro@nova.teste');

    const antes = await conexaoDona.query('SELECT count(*)::int AS n FROM estabelecimentos');

    await expect(provisionar('unico', 'segundo@nova.teste')).rejects.toThrow(/já está em uso/);

    const depois = await conexaoDona.query('SELECT count(*)::int AS n FROM estabelecimentos');

    expect(depois.rows[0]).toEqual(antes.rows[0]);
  });

  /** A mesma pessoa pode ser dona de um tenant e funcionária de outro (8.3). */
  test('o mesmo e-mail em dois tenants reaproveita o usuário, com vínculos separados', async () => {
    const primeiro = await provisionar('casa-um', 'multi@nova.teste');
    const segundo = await provisionar('casa-dois', 'multi@nova.teste');

    const { rows } = await conexaoDona.query<{ usuarios: string; vinculos: string }>(
      `SELECT
         (SELECT count(*) FROM usuarios WHERE email = 'multi@nova.teste')::text AS usuarios,
         (SELECT count(*) FROM vinculos WHERE estabelecimento_id IN ($1, $2))::text AS vinculos`,
      [primeiro.estabelecimentoId, segundo.estabelecimentoId],
    );

    expect(rows[0]?.usuarios).toBe('1');
    expect(rows[0]?.vinculos).toBe('2');
  });
});

/** O ciclo inteiro pela única porta que existe. */
describe('o proprietário entra pelo convite', () => {
  test('sem aceitar, não entra', async () => {
    await provisionar('antes-do-aceite', 'antes@nova.teste');

    const tentativa = await app.inject({
      method: 'POST',
      url: '/auth/entrada',
      payload: { email: 'antes@nova.teste', senha: SENHA },
    });

    expect(tentativa.statusCode).toBe(403);
  });

  test('aceitar define a senha, ativa o vínculo e já abre sessão de 30 dias', async () => {
    const tenant = await provisionar('ciclo', 'ciclo@nova.teste', 'Casa do Ciclo');

    const aceite = await app.inject({
      method: 'POST',
      url: '/auth/convite',
      payload: { token: tokenDoUltimoEmail(), senha: SENHA },
    });

    expect(aceite.statusCode).toBe(200);

    const bruto = String(aceite.headers['set-cookie']);

    expect(bruto).toContain('HttpOnly');
    expect(bruto).toContain('SameSite=Lax');
    expect(bruto).toContain(`Max-Age=${30 * 24 * 60 * 60}`);

    const cookie = cookieDaResposta(aceite.headers);
    const eu = await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie } });

    expect(eu.json().estabelecimentos).toEqual([
      { id: tenant.estabelecimentoId, nome: 'Casa do Ciclo', papel: 'PROPRIETARIO' },
    ]);
  });

  test('e a partir daí ele já administra o próprio tenant', async () => {
    const entrada = await app.inject({
      method: 'POST',
      url: '/auth/entrada',
      payload: { email: 'ciclo@nova.teste', senha: SENHA },
    });

    const cookie = cookieDaResposta(entrada.headers);
    const eu = await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie } });
    const estabelecimentoId = eu.json().estabelecimentos[0].id;

    const configuracao = await app.inject({
      method: 'GET',
      url: '/configuracoes',
      headers: { cookie, 'x-estabelecimento': estabelecimentoId },
    });

    expect(configuracao.statusCode).toBe(200);
    expect(configuracao.json().estabelecimento.slug).toBe('ciclo');

    // E já enxerga a si mesmo como profissional, sem ter configurado nada
    const equipe = await app.inject({
      method: 'GET',
      url: '/equipe',
      headers: { cookie, 'x-estabelecimento': estabelecimentoId },
    });

    expect(equipe.json().profissionais).toHaveLength(1);
    expect(equipe.json().profissionais[0].nomeExibicao).toBe('Dona da Casa');
  });

  test('o convite é de uso único', async () => {
    await provisionar('uso-unico', 'unico@nova.teste');

    const token = tokenDoUltimoEmail();
    const payload = { token, senha: SENHA };

    expect((await app.inject({ method: 'POST', url: '/auth/convite', payload })).statusCode).toBe(
      200,
    );
    expect((await app.inject({ method: 'POST', url: '/auth/convite', payload })).statusCode).toBe(
      404,
    );
  });

  /** A finalidade entra na busca: o hash é o mesmo, o propósito não. */
  test('token de convite não serve como redefinição de senha', async () => {
    await provisionar('nao-troca', 'natroca@nova.teste');

    const doConvite = tokenDoUltimoEmail();

    const tentativa = await app.inject({
      method: 'POST',
      url: '/auth/nova-senha',
      payload: { token: doConvite, senha: 'outra-senha-bem-longa' },
    });

    expect(tentativa.statusCode).toBe(404);
  });

  test('token de convite inventado não abre nada', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/auth/convite',
      payload: { token: 'a'.repeat(43), senha: SENHA },
    });

    expect(resposta.statusCode).toBe(404);
  });

  test('sair revoga a sessão: o mesmo cookie deixa de valer', async () => {
    const entrada = await app.inject({
      method: 'POST',
      url: '/auth/entrada',
      payload: { email: 'ciclo@nova.teste', senha: SENHA },
    });

    const cookie = cookieDaResposta(entrada.headers);

    expect(
      (await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie } })).statusCode,
    ).toBe(200);

    await app.inject({ method: 'POST', url: '/auth/saida', headers: { cookie } });

    expect(
      (await app.inject({ method: 'GET', url: '/auth/eu', headers: { cookie } })).statusCode,
    ).toBe(403);
  });

  /** 1.1: nenhuma superfície distingue "não existe" de "está errado". */
  test('senha errada e e-mail inexistente dão a mesma resposta', async () => {
    const senhaErrada = await app.inject({
      method: 'POST',
      url: '/auth/entrada',
      payload: { email: 'ciclo@nova.teste', senha: 'senha-errada-mas-longa' },
    });

    const naoExiste = await app.inject({
      method: 'POST',
      url: '/auth/entrada',
      payload: { email: 'ninguem@nova.teste', senha: 'senha-errada-mas-longa' },
    });

    expect(senhaErrada.statusCode).toBe(naoExiste.statusCode);
    expect(senhaErrada.json()).toEqual(naoExiste.json());
  });

  test('a senha precisa ter no mínimo oito caracteres, e o erro aponta o campo', async () => {
    await provisionar('senha-curta', 'curta@nova.teste');

    const resposta = await app.inject({
      method: 'POST',
      url: '/auth/convite',
      payload: { token: tokenDoUltimoEmail(), senha: 'curta' },
    });

    expect(resposta.statusCode).toBe(422);
    expect(Object.keys(resposta.json().erro.campos)).toContain('senha');
  });
});
