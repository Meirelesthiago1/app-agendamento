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
/** Ignora RLS: usado só para plantar um agendamento, que não tem rota ainda. */
let conexaoDona: Pool;
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

type Catalogo = {
  categorias: { id: string; nome: string; posicao: number | null }[];
  servicos: {
    id: string;
    slug: string;
    nome: string;
    ativo: boolean;
    categoriaId: string | null;
  }[];
};

async function listar(cookie = cookieDoDono): Promise<Catalogo> {
  return (
    await app.inject({ method: 'GET', url: '/catalogo', headers: { cookie, ...CABECALHO } })
  ).json();
}

function chamar(
  method: 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
  cookie = cookieDoDono,
) {
  const opcoes = { method, url, headers: { cookie, ...CABECALHO } };

  // Dois ramos em vez de espalhar `payload` condicional: com o espalhamento a
  // sobrecarga de `inject` deixa de resolver, e o `tipos` reprova
  return payload === undefined ? app.inject(opcoes) : app.inject({ ...opcoes, payload });
}

const SERVICO_BASE = {
  nome: 'Barba',
  slug: 'barba',
  descricao: null,
  categoriaId: null,
  duracaoMin: 20,
  folgaAntesMin: 0,
  folgaDepoisMin: 5,
  valorCentavos: 3000,
  exibicaoValor: 'FIXO',
  cor: '#f59e0b',
  posicao: 1,
};

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine').start();

  conexaoDona = new Pool({ connectionString: container.getConnectionUri() });

  const dono = drizzle(conexaoDona);

  await migrate(dono, { migrationsFolder: CAMINHO_DAS_MIGRACOES });
  await conexaoDona.query(`ALTER ROLE agendamento_gestor WITH PASSWORD '${SENHA_DO_PAPEL}'`);
  await conexaoDona.query(`ALTER ROLE agendamento_publico WITH PASSWORD '${SENHA_DO_PAPEL}'`);
  await limpar(dono);
  await semear(dono);

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
  await conexaoDona?.end();
  await container?.stop();
}, TEMPO_DE_CONTAINER);

describe('categorias', () => {
  test('criar devolve o catálogo inteiro, não só a categoria', async () => {
    const resposta = await chamar('POST', '/catalogo/categorias', { nome: 'Cabelo', posicao: 1 });

    expect(resposta.statusCode).toBe(200);

    const corpo = resposta.json() as Catalogo;

    expect(corpo.categorias.map((c) => c.nome)).toEqual(['Cabelo']);
    expect(corpo.servicos.length).toBeGreaterThan(0);
  });

  test('a ordem segue posição e depois nome', async () => {
    await chamar('POST', '/catalogo/categorias', { nome: 'Zzz Última', posicao: 9 });
    await chamar('POST', '/catalogo/categorias', { nome: 'Barba', posicao: 1 });

    const { categorias } = await listar();

    expect(categorias.map((c) => c.nome)).toEqual(['Barba', 'Cabelo', 'Zzz Última']);
  });

  test('remover a categoria solta os serviços, em vez de apagá-los', async () => {
    const { categorias } = await listar();
    const cabelo = categorias.find((c) => c.nome === 'Cabelo');
    const antes = await listar();
    const alvo = antes.servicos[0];

    await chamar('PATCH', `/catalogo/servicos/${alvo?.id}`, {
      ...SERVICO_BASE,
      nome: alvo?.nome,
      slug: alvo?.slug,
      duracaoMin: 30,
      categoriaId: cabelo?.id,
    });

    expect((await listar()).servicos.find((s) => s.id === alvo?.id)?.categoriaId).toBe(cabelo?.id);

    const depois = (
      await chamar('DELETE', `/catalogo/categorias/${cabelo?.id}`)
    ).json() as Catalogo;

    expect(depois.categorias.some((c) => c.id === cabelo?.id)).toBe(false);
    expect(depois.servicos.find((s) => s.id === alvo?.id)?.categoriaId).toBeNull();
    expect(depois.servicos).toHaveLength(antes.servicos.length);
  });

  test('categoria que não existe responde não encontrado', async () => {
    const inexistente = '00000000-0000-4000-8000-000000000000';

    expect((await chamar('DELETE', `/catalogo/categorias/${inexistente}`)).statusCode).toBe(404);
  });
});

describe('serviços', () => {
  test('criar aceita os quatro modos de exibição de valor', async () => {
    const modos = ['FIXO', 'A_PARTIR_DE', 'OCULTO', 'GRATUITO'] as const;

    for (const [indice, modo] of modos.entries()) {
      const resposta = await chamar('POST', '/catalogo/servicos', {
        ...SERVICO_BASE,
        nome: `Serviço ${modo}`,
        slug: `servico-${modo.toLowerCase().replaceAll('_', '-')}`,
        exibicaoValor: modo,
        valorCentavos: modo === 'GRATUITO' || modo === 'OCULTO' ? null : 1000 * (indice + 1),
      });

      expect(resposta.statusCode, modo).toBe(200);
    }

    const { servicos } = await listar();

    expect(servicos.filter((s) => s.nome.startsWith('Serviço '))).toHaveLength(4);
  });

  test('slug repetido no mesmo estabelecimento responde conflito', async () => {
    const resposta = await chamar('POST', '/catalogo/servicos', SERVICO_BASE);

    expect(resposta.statusCode).toBe(200);

    const repetido = await chamar('POST', '/catalogo/servicos', {
      ...SERVICO_BASE,
      nome: 'Outro nome, mesmo endereço',
    });

    expect(repetido.statusCode).toBe(409);
    expect(repetido.json().erro.mensagem).toContain('endereço');
  });

  test('duração fora do intervalo é recusada', async () => {
    expect(
      (await chamar('POST', '/catalogo/servicos', { ...SERVICO_BASE, slug: 'x', duracaoMin: 0 }))
        .statusCode,
    ).toBe(422);
  });

  /** A matriz de 2.3 não dá `servicos.escrever` a FUNCIONARIO. */
  test('funcionário lê o catálogo, mas não o altera', async () => {
    expect((await listar(cookieDoFuncionario)).servicos.length).toBeGreaterThan(0);
    expect(
      (
        await chamar(
          'POST',
          '/catalogo/servicos',
          { ...SERVICO_BASE, slug: 'do-funcionario' },
          cookieDoFuncionario,
        )
      ).statusCode,
    ).toBe(403);
  });
});

describe('ativo e inativo', () => {
  test('inativo sai do catálogo público, mas continua na gestão', async () => {
    const alvo = (await listar()).servicos.find((s) => s.slug === 'barba');

    expect(
      (await chamar('PATCH', `/catalogo/servicos/${alvo?.id}/ativo`, { ativo: false })).statusCode,
    ).toBe(200);

    const publico = await app.inject({ method: 'GET', url: '/publico/corte-fino/catalogo' });

    expect(publico.json().servicos.some((s: { id: string }) => s.id === alvo?.id)).toBe(false);
    expect((await listar()).servicos.find((s) => s.id === alvo?.id)?.ativo).toBe(false);
  });

  test('reativar devolve o serviço à vitrine', async () => {
    const alvo = (await listar()).servicos.find((s) => s.slug === 'barba');

    await chamar('PATCH', `/catalogo/servicos/${alvo?.id}/ativo`, { ativo: true });

    const publico = await app.inject({ method: 'GET', url: '/publico/corte-fino/catalogo' });

    expect(publico.json().servicos.some((s: { id: string }) => s.id === alvo?.id)).toBe(true);
  });
});

/**
 * 6.3: "desativar profissional ou serviço com agenda futura é bloqueado até
 * resolver". Não há rota de agendamento até a etapa 9, então o agendamento é
 * plantado direto pelo dono do banco.
 */
describe('a regra de 6.3', () => {
  async function plantarAgendamentoFuturo(servicoId: string): Promise<void> {
    const { rows } = await conexaoDona.query<{ profissional_id: string; cliente_id: string }>(
      `SELECT (SELECT id FROM profissionais WHERE estabelecimento_id = $1 LIMIT 1) AS profissional_id,
              (SELECT id FROM clientes WHERE estabelecimento_id = $1 LIMIT 1) AS cliente_id`,
      [TENANT_BARBEARIA],
    );

    const alvo = rows[0];

    const inserido = await conexaoDona.query<{ id: string }>(
      `INSERT INTO agendamentos (
         estabelecimento_id, cliente_id, profissional_id,
         inicia_em, termina_em, ocupacao_inicio, ocupacao_fim,
         status, duracao_total_min_snapshot, origem
       ) VALUES ($1, $2, $3,
         now() + interval '3 days', now() + interval '3 days 30 minutes',
         now() + interval '3 days', now() + interval '3 days 30 minutes',
         'CONFIRMADO', 30, 'ADMIN')
       RETURNING id`,
      [TENANT_BARBEARIA, alvo?.cliente_id, alvo?.profissional_id],
    );

    await conexaoDona.query(
      `INSERT INTO agendamento_itens (estabelecimento_id, agendamento_id, servico_id, posicao, duracao_min_snapshot)
       VALUES ($1, $2, $3, 0, 30)`,
      [TENANT_BARBEARIA, inserido.rows[0]?.id, servicoId],
    );
  }

  test('desativar serviço com agenda futura é bloqueado, e a recusa diz quantos', async () => {
    const alvo = (await listar()).servicos.find((s) => s.slug === 'barba');

    await plantarAgendamentoFuturo(alvo?.id ?? '');

    const resposta = await chamar('PATCH', `/catalogo/servicos/${alvo?.id}/ativo`, {
      ativo: false,
    });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json().erro.mensagem).toContain('um agendamento futuro');

    // O bloqueio não pode ter desativado assim mesmo
    expect((await listar()).servicos.find((s) => s.id === alvo?.id)?.ativo).toBe(true);
  });

  test('editar o serviço bloqueado continua permitido: bloqueia desativar, não mexer', async () => {
    const alvo = (await listar()).servicos.find((s) => s.slug === 'barba');

    const resposta = await chamar('PATCH', `/catalogo/servicos/${alvo?.id}`, {
      ...SERVICO_BASE,
      valorCentavos: 4000,
    });

    expect(resposta.statusCode).toBe(200);
  });

  test('agendamento cancelado não bloqueia mais', async () => {
    const alvo = (await listar()).servicos.find((s) => s.slug === 'barba');

    await conexaoDona.query(
      `UPDATE agendamentos SET status = 'CANCELADO' WHERE estabelecimento_id = $1`,
      [TENANT_BARBEARIA],
    );

    expect(
      (await chamar('PATCH', `/catalogo/servicos/${alvo?.id}/ativo`, { ativo: false })).statusCode,
    ).toBe(200);
  });
});
