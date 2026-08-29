import { CAMINHO_DAS_MIGRACOES } from '@agendamento/db';
import { limpar, semear, TENANT_BARBEARIA, TENANT_CLINICA } from '@agendamento/db/semente';
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
let conexaoDona: Pool;
let cookieDoDono = '';
let cookieDoFuncionario = '';
let vinculoDoFuncionario = '';

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

type Equipe = {
  profissionais: {
    id: string;
    nomeExibicao: string;
    ativo: boolean;
    vinculoId: string | null;
    servicos: {
      servicoId: string;
      duracaoOverrideMin: number | null;
      valorOverrideCentavos: number | null;
    }[];
  }[];
  acessos: {
    vinculoId: string;
    nome: string;
    email: string;
    papel: string;
    status: string;
    profissionalId: string | null;
  }[];
};

async function listar(cookie = cookieDoDono): Promise<Equipe> {
  return (
    await app.inject({ method: 'GET', url: '/equipe', headers: { cookie, ...CABECALHO } })
  ).json();
}

function chamar(
  method: 'POST' | 'PATCH' | 'PUT',
  url: string,
  payload?: Record<string, unknown>,
  cookie = cookieDoDono,
) {
  const opcoes = { method, url, headers: { cookie, ...CABECALHO } };

  return payload === undefined ? app.inject(opcoes) : app.inject({ ...opcoes, payload });
}

const PROFISSIONAL_BASE = {
  nomeExibicao: 'Marcos Tesoura',
  bio: null,
  avatarUrl: null,
  posicao: 1,
  vinculoId: null,
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

  vinculoDoFuncionario =
    (await listar()).acessos.find((acesso) => acesso.email === 'ze@corte-fino.teste')?.vinculoId ??
    '';
}, TEMPO_DE_CONTAINER);

afterAll(async () => {
  await app?.close();
  await pools?.encerrar();
  await conexaoDona?.end();
  await container?.stop();
}, TEMPO_DE_CONTAINER);

/** As três combinações de 2.4, cada uma na sua forma. */
describe('profissional não é usuário', () => {
  test('a semente já traz o proprietário como profissional com login', async () => {
    const { profissionais, acessos } = await listar();

    expect(profissionais).toHaveLength(1);

    const dono = acessos.find((acesso) => acesso.papel === 'PROPRIETARIO');

    expect(dono?.status).toBe('ATIVO');
  });

  test('profissional sem login: cadastrado pelo gestor, não acessa nada', async () => {
    const resposta = await chamar('POST', '/equipe/profissionais', PROFISSIONAL_BASE);

    expect(resposta.statusCode).toBe(200);

    const criado = (resposta.json() as Equipe).profissionais.find(
      (pessoa) => pessoa.nomeExibicao === 'Marcos Tesoura',
    );

    expect(criado?.vinculoId).toBeNull();
    // Sem vínculo, não existe acesso apontando para ele
    expect(
      (resposta.json() as Equipe).acessos.some((acesso) => acesso.profissionalId === criado?.id),
    ).toBe(false);
  });

  test('usuário sem ser profissional: o funcionário convidado ainda não atende', async () => {
    const { acessos } = await listar();
    const ze = acessos.find((acesso) => acesso.email === 'ze@corte-fino.teste');

    expect(ze?.status).toBe('ATIVO');
    expect(ze?.profissionalId).toBeNull();
  });

  test('profissional com login: ligar o acesso ao registro que atende', async () => {
    const alvo = (await listar()).profissionais.find(
      (pessoa) => pessoa.nomeExibicao === 'Marcos Tesoura',
    );

    const resposta = await chamar('PATCH', `/equipe/profissionais/${alvo?.id}`, {
      ...PROFISSIONAL_BASE,
      vinculoId: vinculoDoFuncionario,
    });

    expect(resposta.statusCode).toBe(200);

    const equipe = resposta.json() as Equipe;

    expect(equipe.profissionais.find((p) => p.id === alvo?.id)?.vinculoId).toBe(
      vinculoDoFuncionario,
    );
    expect(equipe.acessos.find((a) => a.vinculoId === vinculoDoFuncionario)?.profissionalId).toBe(
      alvo?.id,
    );
  });

  test('acesso de outro estabelecimento é recusado, e não ligado em silêncio', async () => {
    const { rows } = await conexaoDona.query<{ id: string }>(
      'SELECT id FROM vinculos WHERE estabelecimento_id = $1 LIMIT 1',
      [TENANT_CLINICA],
    );

    const resposta = await chamar('POST', '/equipe/profissionais', {
      ...PROFISSIONAL_BASE,
      nomeExibicao: 'Intruso',
      vinculoId: rows[0]?.id,
    });

    expect(resposta.statusCode).toBe(404);
    expect((await listar()).profissionais.some((p) => p.nomeExibicao === 'Intruso')).toBe(false);
  });
});

describe('serviços do profissional', () => {
  test('a lista substitui inteira, com override de duração e valor', async () => {
    const equipe = await listar();
    const alvo = equipe.profissionais.find((p) => p.nomeExibicao === 'Marcos Tesoura');

    const catalogo = await app.inject({
      method: 'GET',
      url: '/catalogo',
      headers: { cookie: cookieDoDono, ...CABECALHO },
    });

    const servicoId = catalogo.json().servicos[0]?.id;

    const resposta = await chamar('PUT', `/equipe/profissionais/${alvo?.id}/servicos`, {
      servicos: [{ servicoId, duracaoOverrideMin: 45, valorOverrideCentavos: 6000 }],
    });

    expect(resposta.statusCode).toBe(200);

    const salvo = (resposta.json() as Equipe).profissionais.find((p) => p.id === alvo?.id);

    expect(salvo?.servicos).toEqual([
      { servicoId, duracaoOverrideMin: 45, valorOverrideCentavos: 6000 },
    ]);
  });

  test('mandar lista vazia desliga todos os serviços da pessoa', async () => {
    const alvo = (await listar()).profissionais.find((p) => p.nomeExibicao === 'Marcos Tesoura');

    await chamar('PUT', `/equipe/profissionais/${alvo?.id}/servicos`, { servicos: [] });

    expect((await listar()).profissionais.find((p) => p.id === alvo?.id)?.servicos).toEqual([]);
  });

  test('override fora do intervalo é recusado', async () => {
    const alvo = (await listar()).profissionais.find((p) => p.nomeExibicao === 'Marcos Tesoura');

    const resposta = await chamar('PUT', `/equipe/profissionais/${alvo?.id}/servicos`, {
      servicos: [
        {
          servicoId: '00000000-0000-4000-8000-000000000000',
          duracaoOverrideMin: 0,
          valorOverrideCentavos: null,
        },
      ],
    });

    expect(resposta.statusCode).toBe(422);
  });

  test('profissional que não existe responde não encontrado', async () => {
    const resposta = await chamar(
      'PUT',
      '/equipe/profissionais/00000000-0000-4000-8000-000000000000/servicos',
      { servicos: [] },
    );

    expect(resposta.statusCode).toBe(404);
  });
});

describe('quem pode alterar a equipe', () => {
  /** A matriz de 2.3 não dá `profissionais.escrever` a FUNCIONARIO. */
  test('funcionário lê a equipe, mas não a altera', async () => {
    expect((await listar(cookieDoFuncionario)).profissionais.length).toBeGreaterThan(0);

    expect(
      (
        await chamar(
          'POST',
          '/equipe/profissionais',
          { ...PROFISSIONAL_BASE, nomeExibicao: 'Do Funcionário' },
          cookieDoFuncionario,
        )
      ).statusCode,
    ).toBe(403);
  });
});

describe('a regra de 6.3 para profissional', () => {
  // Escalonados: dois no mesmo horário batem na constraint de exclusão, que é
  // justamente o que ela existe para impedir
  async function plantarAgendamentoFuturo(profissionalId: string, dias: number): Promise<void> {
    const { rows } = await conexaoDona.query<{ id: string }>(
      'SELECT id FROM clientes WHERE estabelecimento_id = $1 LIMIT 1',
      [TENANT_BARBEARIA],
    );

    await conexaoDona.query(
      `INSERT INTO agendamentos (
         estabelecimento_id, cliente_id, profissional_id,
         inicia_em, termina_em, ocupacao_inicio, ocupacao_fim,
         status, duracao_total_min_snapshot, origem
       ) VALUES ($1, $2, $3,
         now() + ($4 || ' days')::interval,
         now() + ($4 || ' days')::interval + interval '30 minutes',
         now() + ($4 || ' days')::interval,
         now() + ($4 || ' days')::interval + interval '30 minutes',
         'AGUARDANDO', 30, 'ADMIN')`,
      [TENANT_BARBEARIA, rows[0]?.id, profissionalId, String(dias)],
    );
  }

  test('sem agenda futura, desativar funciona', async () => {
    const alvo = (await listar()).profissionais.find((p) => p.nomeExibicao === 'Marcos Tesoura');

    expect(
      (await chamar('PATCH', `/equipe/profissionais/${alvo?.id}/ativo`, { ativo: false }))
        .statusCode,
    ).toBe(200);

    await chamar('PATCH', `/equipe/profissionais/${alvo?.id}/ativo`, { ativo: true });
  });

  test('com agenda futura, é bloqueado e a recusa diz quantos', async () => {
    const alvo = (await listar()).profissionais.find((p) => p.nomeExibicao === 'Marcos Tesoura');

    await plantarAgendamentoFuturo(alvo?.id ?? '', 5);
    await plantarAgendamentoFuturo(alvo?.id ?? '', 6);

    const resposta = await chamar('PATCH', `/equipe/profissionais/${alvo?.id}/ativo`, {
      ativo: false,
    });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json().erro.mensagem).toContain('2 agendamentos futuros');
    expect((await listar()).profissionais.find((p) => p.id === alvo?.id)?.ativo).toBe(true);
  });

  test('agendamento no passado não bloqueia', async () => {
    const alvo = (await listar()).profissionais.find((p) => p.nomeExibicao === 'Marcos Tesoura');

    await conexaoDona.query(
      `UPDATE agendamentos SET inicia_em = now() - interval '2 days',
                               termina_em = now() - interval '2 days' + interval '30 minutes'
       WHERE estabelecimento_id = $1 AND profissional_id = $2`,
      [TENANT_BARBEARIA, alvo?.id],
    );

    expect(
      (await chamar('PATCH', `/equipe/profissionais/${alvo?.id}/ativo`, { ativo: false }))
        .statusCode,
    ).toBe(200);
  });

  test('desativar tira a pessoa do catálogo público', async () => {
    const publico = await app.inject({ method: 'GET', url: '/publico/corte-fino/catalogo' });
    const nomes = publico.json().profissionais.map((p: { nomeExibicao: string }) => p.nomeExibicao);

    expect(nomes).not.toContain('Marcos Tesoura');
  });
});
