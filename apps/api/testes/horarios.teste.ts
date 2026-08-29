import { CAMINHO_DAS_MIGRACOES } from '@agendamento/db';
import { limpar, semear, TENANT_BARBEARIA } from '@agendamento/db/semente';
import type { EnviadorEmail, LimitadorTaxa, Mensagem } from '@agendamento/dominio';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { DateTime } from 'luxon';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { type Aplicacao, criarAplicacao } from '../src/aplicacao.ts';
import { lerConfig } from '../src/config.ts';
import { criarPools, type Pools } from '../src/infra/db/pools.ts';

const TEMPO_DE_CONTAINER = 240_000;
const SENHA_DO_PAPEL = 'teste';
const SENHA = 'uma-senha-longa-o-bastante';
const FUSO = 'America/Sao_Paulo';

let container: StartedPostgreSqlContainer;
let app: Aplicacao;
let pools: Pools;
let conexaoDona: Pool;
let cookieDoDono = '';
let cookieDoFuncionario = '';
let profissionalDoDono = '';

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

type Grade = {
  profissionalId: string;
  nomeExibicao: string;
  faixas: { diaSemana: number; horaInicio: string; horaFim: string }[];
  vigenciaInicio: string | null;
};

async function listarGrades(cookie = cookieDoDono): Promise<Grade[]> {
  const resposta = await app.inject({
    method: 'GET',
    url: '/horarios',
    headers: { cookie, ...CABECALHO },
  });

  return resposta.json().grades;
}

function chamar(
  method: 'POST' | 'PUT' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
  cookie = cookieDoDono,
) {
  const opcoes = { method, url, headers: { cookie, ...CABECALHO } };

  return payload === undefined ? app.inject(opcoes) : app.inject({ ...opcoes, payload });
}

/** Hoje no fuso do tenant, que é o que 6.5 chama de "a data em que foi feita". */
function hoje(): string {
  return DateTime.now().setZone(FUSO).toISODate() ?? '';
}

function ontem(): string {
  return DateTime.now().setZone(FUSO).minus({ days: 1 }).toISODate() ?? '';
}

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

  profissionalDoDono = (await listarGrades())[0]?.profissionalId ?? '';
}, TEMPO_DE_CONTAINER);

afterAll(async () => {
  await app?.close();
  await pools?.encerrar();
  await conexaoDona?.end();
  await container?.stop();
}, TEMPO_DE_CONTAINER);

describe('a grade semanal', () => {
  test('a semente traz segunda a sexta com dois intervalos por dia', async () => {
    const [grade] = await listarGrades();

    expect(grade?.faixas).toHaveLength(10);
    expect(grade?.faixas.filter((f) => f.diaSemana === 1)).toEqual([
      { diaSemana: 1, horaInicio: '08:00', horaFim: '12:00' },
      { diaSemana: 1, horaInicio: '13:00', horaFim: '18:00' },
    ]);
  });

  test('salvar a grade nova a faz valer de hoje', async () => {
    const resposta = await chamar('PUT', `/horarios/${profissionalDoDono}`, {
      faixas: [
        { diaSemana: 1, horaInicio: '09:00', horaFim: '13:00' },
        { diaSemana: 2, horaInicio: '09:00', horaFim: '13:00' },
        { diaSemana: 6, horaInicio: '09:00', horaFim: '12:00' },
      ],
    });

    expect(resposta.statusCode).toBe(200);

    const grade = (resposta.json().grades as Grade[])[0];

    expect(grade?.faixas).toHaveLength(3);
    expect(grade?.vigenciaInicio).toBe(hoje());
  });

  /** 6.5: nunca `UPDATE` retroativo — a agenda de ontem precisa continuar explicável. */
  test('a versão anterior é fechada em ontem, não apagada', async () => {
    const { rows } = await conexaoDona.query<{
      vigencia_inicio: string;
      vigencia_fim: string | null;
      total: string;
    }>(
      `SELECT vigencia_inicio::text, vigencia_fim::text, count(*)::text AS total
       FROM horarios_trabalho WHERE profissional_id = $1
       GROUP BY vigencia_inicio, vigencia_fim ORDER BY vigencia_inicio`,
      [profissionalDoDono],
    );

    const antiga = rows.find((linha) => linha.vigencia_fim !== null);
    const vigente = rows.find((linha) => linha.vigencia_fim === null);

    expect(antiga?.vigencia_fim).toBe(ontem());
    expect(antiga?.total).toBe('10');
    expect(vigente?.vigencia_inicio).toBe(hoje());
    expect(vigente?.total).toBe('3');
  });

  /**
   * 6.5: "alterações no mesmo dia sobrescrevem as linhas criadas hoje". Corrigir
   * um erro de digitação não é uma versão da grade.
   */
  test('salvar de novo no mesmo dia não cria uma terceira versão', async () => {
    await chamar('PUT', `/horarios/${profissionalDoDono}`, {
      faixas: [{ diaSemana: 1, horaInicio: '10:00', horaFim: '14:00' }],
    });

    const { rows } = await conexaoDona.query<{ vigencia_inicio: string }>(
      `SELECT DISTINCT vigencia_inicio::text FROM horarios_trabalho WHERE profissional_id = $1`,
      [profissionalDoDono],
    );

    expect(rows).toHaveLength(2);

    const grade = (await listarGrades())[0];

    expect(grade?.faixas).toEqual([{ diaSemana: 1, horaInicio: '10:00', horaFim: '14:00' }]);
  });

  test('a versão anterior continua fechada em ontem depois da segunda edição', async () => {
    const { rows } = await conexaoDona.query<{ vigencia_fim: string | null }>(
      `SELECT DISTINCT vigencia_fim::text FROM horarios_trabalho WHERE profissional_id = $1
       ORDER BY vigencia_fim NULLS LAST`,
      [profissionalDoDono],
    );

    expect(rows.map((linha) => linha.vigencia_fim)).toEqual([ontem(), null]);
  });

  test('grade vazia é dia sem trabalho, não erro', async () => {
    const resposta = await chamar('PUT', `/horarios/${profissionalDoDono}`, { faixas: [] });

    expect(resposta.statusCode).toBe(200);
    expect((await listarGrades())[0]?.faixas).toEqual([]);
    expect((await listarGrades())[0]?.vigenciaInicio).toBeNull();
  });
});

describe('o que a validação da grade recusa', () => {
  test('fim antes do início', async () => {
    const resposta = await chamar('PUT', `/horarios/${profissionalDoDono}`, {
      faixas: [{ diaSemana: 1, horaInicio: '14:00', horaFim: '10:00' }],
    });

    expect(resposta.statusCode).toBe(422);
    expect(Object.keys(resposta.json().erro.campos)).toContain('faixas.0.horaFim');
  });

  /** Sobreposição faria o mesmo horário aparecer duas vezes para o cliente. */
  test('dois intervalos do mesmo dia que se sobrepõem', async () => {
    const resposta = await chamar('PUT', `/horarios/${profissionalDoDono}`, {
      faixas: [
        { diaSemana: 3, horaInicio: '08:00', horaFim: '12:00' },
        { diaSemana: 3, horaInicio: '11:00', horaFim: '15:00' },
      ],
    });

    expect(resposta.statusCode).toBe(422);
    expect(Object.keys(resposta.json().erro.campos)).toContain('faixas.1.horaInicio');
  });

  test('mas encostar um no outro é permitido', async () => {
    const resposta = await chamar('PUT', `/horarios/${profissionalDoDono}`, {
      faixas: [
        { diaSemana: 3, horaInicio: '08:00', horaFim: '12:00' },
        { diaSemana: 3, horaInicio: '12:00', horaFim: '18:00' },
      ],
    });

    expect(resposta.statusCode).toBe(200);
  });

  test('mesmo horário em dias diferentes não é sobreposição', async () => {
    const resposta = await chamar('PUT', `/horarios/${profissionalDoDono}`, {
      faixas: [
        { diaSemana: 1, horaInicio: '08:00', horaFim: '12:00' },
        { diaSemana: 2, horaInicio: '08:00', horaFim: '12:00' },
      ],
    });

    expect(resposta.statusCode).toBe(200);
  });

  test('hora fora do relógio', async () => {
    const resposta = await chamar('PUT', `/horarios/${profissionalDoDono}`, {
      faixas: [{ diaSemana: 1, horaInicio: '25:00', horaFim: '26:00' }],
    });

    expect(resposta.statusCode).toBe(422);
  });
});

/** 2.3: `horarios.escrever` é `PROPRIOS` para FUNCIONARIO. */
describe('escopo do funcionário', () => {
  test('funcionário sem registro de profissional não altera grade nenhuma', async () => {
    const resposta = await chamar(
      'PUT',
      `/horarios/${profissionalDoDono}`,
      { faixas: [] },
      cookieDoFuncionario,
    );

    expect(resposta.statusCode).toBe(403);
  });

  test('mas ele lê a grade da equipe', async () => {
    expect((await listarGrades(cookieDoFuncionario)).length).toBeGreaterThan(0);
  });
});

describe('exceções de agenda', () => {
  let bloqueioId = '';

  test('bloqueio de dia inteiro do estabelecimento', async () => {
    const dia = DateTime.now().setZone(FUSO).plus({ days: 10 }).startOf('day');

    const resposta = await chamar('POST', '/excecoes', {
      profissionalId: null,
      tipo: 'BLOQUEIO',
      iniciaEm: dia.toUTC().toISO(),
      terminaEm: dia.endOf('day').toUTC().toISO(),
      diaInteiro: true,
      motivo: 'Feriado municipal',
    });

    expect(resposta.statusCode).toBe(200);
    bloqueioId = resposta.json().id;
  });

  test('disponibilidade extra fora da grade é o outro tipo', async () => {
    const dia = DateTime.now().setZone(FUSO).plus({ days: 11 }).set({ hour: 9 });

    const resposta = await chamar('POST', '/excecoes', {
      profissionalId: profissionalDoDono,
      tipo: 'EXTRA',
      iniciaEm: dia.toUTC().toISO(),
      terminaEm: dia.plus({ hours: 3 }).toUTC().toISO(),
      diaInteiro: false,
      motivo: null,
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().tipo).toBe('EXTRA');
  });

  test('a listagem por período traz as duas', async () => {
    const de = DateTime.now().setZone(FUSO).toISODate();
    const ate = DateTime.now().setZone(FUSO).plus({ days: 20 }).toISODate();

    const resposta = await app.inject({
      method: 'GET',
      url: `/excecoes?de=${de}&ate=${ate}`,
      headers: { cookie: cookieDoDono, ...CABECALHO },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().excecoes).toHaveLength(2);
  });

  test('período sem exceção devolve lista vazia, não erro', async () => {
    const de = DateTime.now().setZone(FUSO).plus({ days: 100 }).toISODate();
    const ate = DateTime.now().setZone(FUSO).plus({ days: 110 }).toISODate();

    const resposta = await app.inject({
      method: 'GET',
      url: `/excecoes?de=${de}&ate=${ate}`,
      headers: { cookie: cookieDoDono, ...CABECALHO },
    });

    expect(resposta.json().excecoes).toEqual([]);
  });

  test('fim antes do início é recusado', async () => {
    const dia = DateTime.now().setZone(FUSO).plus({ days: 12 });

    const resposta = await chamar('POST', '/excecoes', {
      profissionalId: null,
      tipo: 'BLOQUEIO',
      iniciaEm: dia.toUTC().toISO(),
      terminaEm: dia.minus({ hours: 1 }).toUTC().toISO(),
      diaInteiro: false,
      motivo: null,
    });

    expect(resposta.statusCode).toBe(422);
  });

  test('funcionário não bloqueia o estabelecimento inteiro', async () => {
    const dia = DateTime.now().setZone(FUSO).plus({ days: 13 });

    const resposta = await chamar(
      'POST',
      '/excecoes',
      {
        profissionalId: null,
        tipo: 'BLOQUEIO',
        iniciaEm: dia.toUTC().toISO(),
        terminaEm: dia.plus({ hours: 2 }).toUTC().toISO(),
        diaInteiro: false,
        motivo: null,
      },
      cookieDoFuncionario,
    );

    expect(resposta.statusCode).toBe(403);
  });

  test('remover o bloqueio devolve o horário', async () => {
    expect((await chamar('DELETE', `/excecoes/${bloqueioId}`)).statusCode).toBe(200);
    expect((await chamar('DELETE', `/excecoes/${bloqueioId}`)).statusCode).toBe(404);
  });
});

/**
 * O critério de pronto da etapa 7: "um profissional autônomo configura um
 * horário e um serviço, e a rota de disponibilidade já devolve slots corretos
 * para os próximos dias".
 */
describe('o critério de pronto da etapa', () => {
  test('grade nova, serviço novo, e os slots saem certos', async () => {
    // Uma grade só, num dia da semana conhecido
    const alvo = DateTime.now().setZone(FUSO).plus({ days: 3 });

    await chamar('PUT', `/horarios/${profissionalDoDono}`, {
      faixas: [{ diaSemana: alvo.weekday % 7, horaInicio: '09:00', horaFim: '12:00' }],
    });

    const criado = await chamar('POST', '/catalogo/servicos', {
      nome: 'Corte rápido',
      slug: 'corte-rapido',
      descricao: null,
      categoriaId: null,
      duracaoMin: 30,
      folgaAntesMin: 0,
      folgaDepoisMin: 0,
      valorCentavos: 4000,
      exibicaoValor: 'FIXO',
      cor: null,
      posicao: 0,
    });

    const servicoId = (criado.json().servicos as { id: string; slug: string }[]).find(
      (servico) => servico.slug === 'corte-rapido',
    )?.id;

    await chamar('PUT', `/equipe/profissionais/${profissionalDoDono}/servicos`, {
      servicos: [{ servicoId, duracaoOverrideMin: null, valorOverrideCentavos: null }],
    });

    const slots = await app.inject({
      method: 'GET',
      url: `/publico/corte-fino/slots?data=${alvo.toISODate()}&servicos=${servicoId}`,
    });

    expect(slots.statusCode).toBe(200);

    const horarios = (slots.json().slots as { inicio: string }[]).map((slot) =>
      DateTime.fromISO(slot.inicio).setZone(FUSO).toFormat('HH:mm'),
    );

    // 09:00–12:00, granularidade de 15 min, serviço de 30: o último cabe às 11:30
    expect(horarios[0]).toBe('09:00');
    expect(horarios[horarios.length - 1]).toBe('11:30');
    expect(horarios).toHaveLength(11);
  });

  test('e o dia fora da grade não devolve nada', async () => {
    const alvo = DateTime.now().setZone(FUSO).plus({ days: 4 });
    const catalogo = await app.inject({ method: 'GET', url: '/publico/corte-fino/catalogo' });

    const servicoId = (catalogo.json().servicos as { id: string; slug: string }[]).find(
      (servico) => servico.slug === 'corte-rapido',
    )?.id;

    const slots = await app.inject({
      method: 'GET',
      url: `/publico/corte-fino/slots?data=${alvo.toISODate()}&servicos=${servicoId}`,
    });

    expect(slots.json().slots).toEqual([]);
  });

  test('e o bloqueio de dia inteiro tira o dia da grade', async () => {
    // Dentro da janela de agendamento do tenant, que a semente deixa em 7 dias:
    // fora dela não há slot para bloquear, e o teste passaria por engano
    const alvo = DateTime.now().setZone(FUSO).plus({ days: 5 });
    const catalogo = await app.inject({ method: 'GET', url: '/publico/corte-fino/catalogo' });

    const servicoId = (catalogo.json().servicos as { id: string; slug: string }[]).find(
      (servico) => servico.slug === 'corte-rapido',
    )?.id;

    await chamar('PUT', `/horarios/${profissionalDoDono}`, {
      faixas: [{ diaSemana: alvo.weekday % 7, horaInicio: '09:00', horaFim: '12:00' }],
    });

    const antes = await app.inject({
      method: 'GET',
      url: `/publico/corte-fino/slots?data=${alvo.toISODate()}&servicos=${servicoId}`,
    });

    expect((antes.json().slots as unknown[]).length).toBeGreaterThan(0);

    await chamar('POST', '/excecoes', {
      profissionalId: null,
      tipo: 'BLOQUEIO',
      iniciaEm: alvo.startOf('day').toUTC().toISO(),
      terminaEm: alvo.endOf('day').toUTC().toISO(),
      diaInteiro: true,
      motivo: 'Feriado',
    });

    const depois = await app.inject({
      method: 'GET',
      url: `/publico/corte-fino/slots?data=${alvo.toISODate()}&servicos=${servicoId}`,
    });

    expect(depois.json().slots).toEqual([]);
  });
});
