import { DateTime } from 'luxon';
import { describe, expect, test } from 'vitest';
import { ErroDominio } from '../erros/index.js';
import {
  type ContextoDeDisponibilidade,
  calcularSlots,
  diasComVaga,
  duracaoTotal,
  folgasDoBloco,
  type ItemPedido,
  janelasDoDia,
  type Profissional,
  profissionaisElegiveis,
} from './index.js';

const SP = 'America/Sao_Paulo';

/** Terça-feira comum, longe de qualquer transição de fuso. */
const TERCA = '2026-09-01';
const AGORA = DateTime.fromISO('2026-08-25T12:00:00.000Z');

const CORTE: ItemPedido = {
  servicoId: 's-corte',
  duracaoMin: 30,
  folgaAntesMin: 0,
  folgaDepoisMin: 0,
};

const BARBA: ItemPedido = {
  servicoId: 's-barba',
  duracaoMin: 20,
  folgaAntesMin: 0,
  folgaDepoisMin: 0,
};

const rui: Profissional = {
  id: 'p-rui',
  servicos: [
    { servicoId: 's-corte', duracaoOverrideMin: null },
    { servicoId: 's-barba', duracaoOverrideMin: null },
  ],
};

const ana: Profissional = {
  id: 'p-ana',
  servicos: [{ servicoId: 's-corte', duracaoOverrideMin: null }],
};

function contexto(parcial: Partial<ContextoDeDisponibilidade> = {}): ContextoDeDisponibilidade {
  return {
    agora: AGORA,
    fuso: SP,
    config: {
      granularidadeSlotMin: 15,
      estrategiaSlot: 'GRADE',
      antecedenciaMinimaMin: 60,
      janelaAgendamentoDias: 30,
      folgaPodeExcederJanela: true,
    },
    grade: [
      {
        profissionalId: 'p-rui',
        diaSemana: 2,
        horaInicio: '09:00',
        horaFim: '11:00',
        vigenciaInicio: '2026-01-01',
        vigenciaFim: null,
      },
    ],
    excecoes: [],
    ocupacoes: [],
    ...parcial,
  };
}

const horas = (slots: { inicio: DateTime }[]) =>
  slots.map((s) => s.inicio.setZone(SP).toFormat('HH:mm'));

describe('elegibilidade e duração', () => {
  test('só quem executa todos os itens é elegível (6.2)', () => {
    expect(profissionaisElegiveis([rui, ana], [CORTE]).map((p) => p.id)).toEqual([
      'p-rui',
      'p-ana',
    ]);
    expect(profissionaisElegiveis([rui, ana], [CORTE, BARBA]).map((p) => p.id)).toEqual(['p-rui']);
  });

  test('a duração soma os itens', () => {
    expect(duracaoTotal([CORTE, BARBA], rui)).toBe(50);
  });

  test('o override por profissional se aplica item a item', () => {
    const lento: Profissional = {
      id: 'p-lento',
      servicos: [
        { servicoId: 's-corte', duracaoOverrideMin: 45 },
        { servicoId: 's-barba', duracaoOverrideMin: null },
      ],
    };

    expect(duracaoTotal([CORTE, BARBA], lento)).toBe(65);
  });

  test('folga do primeiro e do último; as do meio são ignoradas', () => {
    const meio: ItemPedido = { ...BARBA, folgaAntesMin: 99, folgaDepoisMin: 99 };
    const itens = [
      { ...CORTE, folgaAntesMin: 10 },
      meio,
      { ...CORTE, servicoId: 's-outro', folgaDepoisMin: 20 },
    ];

    expect(folgasDoBloco(itens)).toEqual({ antesMin: 10, depoisMin: 20 });
  });

  test('fora do limite de 1 a 5 itens é recusado', () => {
    const seis = Array.from({ length: 6 }, () => CORTE);

    expect(() => calcularSlots(contexto(), { itens: [], profissionais: [rui] }, TERCA)).toThrow(
      ErroDominio,
    );
    expect(() => calcularSlots(contexto(), { itens: seis, profissionais: [rui] }, TERCA)).toThrow(
      /1 a 5/,
    );
  });

  test('cinco itens são aceitos', () => {
    const cinco: Profissional = {
      id: 'p-cinco',
      servicos: Array.from({ length: 5 }, (_, i) => ({
        servicoId: `s-${i}`,
        duracaoOverrideMin: null,
      })),
    };
    const itens = Array.from({ length: 5 }, (_, i) => ({ ...CORTE, servicoId: `s-${i}` }));
    const ctx = contexto({
      grade: [
        {
          profissionalId: 'p-cinco',
          diaSemana: 2,
          horaInicio: '09:00',
          horaFim: '13:00',
          vigenciaInicio: '2026-01-01',
          vigenciaFim: null,
        },
      ],
    });

    // 5 × 30 min = 2h30; janela de 4h começando 09:00 → último início às 10:30
    expect(horas(calcularSlots(ctx, { itens, profissionais: [cinco] }, TERCA))).toEqual([
      '09:00',
      '09:15',
      '09:30',
      '09:45',
      '10:00',
      '10:15',
      '10:30',
    ]);
  });
});

describe('grade e janelas', () => {
  test('slots alinhados à granularidade, e o atendimento cabe na janela', () => {
    expect(
      horas(calcularSlots(contexto(), { itens: [CORTE], profissionais: [rui] }, TERCA)),
    ).toEqual(['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30']);
  });

  test('múltiplos intervalos no mesmo dia: manhã e tarde', () => {
    const ctx = contexto({
      grade: [
        {
          profissionalId: 'p-rui',
          diaSemana: 2,
          horaInicio: '09:00',
          horaFim: '10:00',
          vigenciaInicio: '2026-01-01',
          vigenciaFim: null,
        },
        {
          profissionalId: 'p-rui',
          diaSemana: 2,
          horaInicio: '14:00',
          horaFim: '15:00',
          vigenciaInicio: '2026-01-01',
          vigenciaFim: null,
        },
      ],
    });

    expect(horas(calcularSlots(ctx, { itens: [CORTE], profissionais: [rui] }, TERCA))).toEqual([
      '09:00',
      '09:15',
      '09:30',
      '14:00',
      '14:15',
      '14:30',
    ]);
  });

  test('dia sem grade não tem slot', () => {
    // Quarta-feira, e a grade só cobre terça
    expect(
      calcularSlots(contexto(), { itens: [CORTE], profissionais: [rui] }, '2026-09-02'),
    ).toEqual([]);
  });

  test('a janela de trabalho sai em instantes absolutos', () => {
    const [janela] = janelasDoDia(contexto(), 'p-rui', TERCA);

    expect(janela?.start?.toISO()).toBe('2026-09-01T12:00:00.000Z');
    expect(janela?.end?.toISO()).toBe('2026-09-01T14:00:00.000Z');
  });
});

describe('vigência da grade (6.5)', () => {
  const comDuasVersoes = contexto({
    // Relógio afastado: aqui o alvo é a vigência, não a antecedência mínima
    agora: DateTime.fromISO('2026-08-20T12:00:00.000Z'),
    grade: [
      {
        profissionalId: 'p-rui',
        diaSemana: 2,
        horaInicio: '09:00',
        horaFim: '10:00',
        vigenciaInicio: '2026-01-01',
        vigenciaFim: '2026-08-31',
      },
      {
        profissionalId: 'p-rui',
        diaSemana: 2,
        horaInicio: '14:00',
        horaFim: '15:00',
        vigenciaInicio: '2026-09-01',
        vigenciaFim: null,
      },
    ],
  });

  test('a versão vigente na data é a que vale', () => {
    expect(
      horas(calcularSlots(comDuasVersoes, { itens: [CORTE], profissionais: [rui] }, TERCA)),
    ).toEqual(['14:00', '14:15', '14:30']);
  });

  test('a versão anterior ainda vale no último dia da vigência', () => {
    // 2026-08-25 é terça, dentro da primeira vigência
    expect(
      horas(calcularSlots(comDuasVersoes, { itens: [CORTE], profissionais: [rui] }, '2026-08-25')),
    ).toEqual(['09:00', '09:15', '09:30']);
  });
});

describe('ocupação e folgas', () => {
  test('agendamento existente bloqueia a faixa', () => {
    const ctx = contexto({
      ocupacoes: [
        {
          profissionalId: 'p-rui',
          ocupacaoInicio: DateTime.fromISO('2026-09-01T12:30:00.000Z'),
          ocupacaoFim: DateTime.fromISO('2026-09-01T13:00:00.000Z'),
        },
      ],
    });

    expect(horas(calcularSlots(ctx, { itens: [CORTE], profissionais: [rui] }, TERCA))).toEqual([
      '09:00',
      '10:00',
      '10:15',
      '10:30',
    ]);
  });

  test('a ocupação de outro profissional não atrapalha', () => {
    const ctx = contexto({
      ocupacoes: [
        {
          profissionalId: 'p-outro',
          ocupacaoInicio: DateTime.fromISO('2026-09-01T12:30:00.000Z'),
          ocupacaoFim: DateTime.fromISO('2026-09-01T13:00:00.000Z'),
        },
      ],
    });

    expect(horas(calcularSlots(ctx, { itens: [CORTE], profissionais: [rui] }, TERCA))).toHaveLength(
      7,
    );
  });

  test('com folga_pode_exceder_janela a folga transborda', () => {
    const comFolga = { ...CORTE, folgaAntesMin: 15, folgaDepoisMin: 15 };

    expect(
      horas(calcularSlots(contexto(), { itens: [comFolga], profissionais: [rui] }, TERCA)),
    ).toEqual(['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30']);
  });

  test('sem folga_pode_exceder_janela a folga precisa caber, nas duas pontas', () => {
    const comFolga = { ...CORTE, folgaAntesMin: 15, folgaDepoisMin: 15 };
    const ctx = contexto({
      config: { ...contexto().config, folgaPodeExcederJanela: false },
    });

    // 09:00 sai porque a folga da frente cairia às 08:45; 10:30 sai porque a de
    // trás cairia às 11:15
    expect(horas(calcularSlots(ctx, { itens: [comFolga], profissionais: [rui] }, TERCA))).toEqual([
      '09:15',
      '09:30',
      '09:45',
      '10:00',
      '10:15',
    ]);
  });
});

describe('exceções de agenda', () => {
  test('BLOQUEIO tira faixa da janela', () => {
    const ctx = contexto({
      excecoes: [
        {
          profissionalId: 'p-rui',
          tipo: 'BLOQUEIO',
          iniciaEm: DateTime.fromISO('2026-09-01T12:00:00.000Z'),
          terminaEm: DateTime.fromISO('2026-09-01T13:00:00.000Z'),
        },
      ],
    });

    expect(horas(calcularSlots(ctx, { itens: [CORTE], profissionais: [rui] }, TERCA))).toEqual([
      '10:00',
      '10:15',
      '10:30',
    ]);
  });

  test('bloqueio do estabelecimento alcança todo mundo', () => {
    const ctx = contexto({
      excecoes: [
        {
          profissionalId: null,
          tipo: 'BLOQUEIO',
          iniciaEm: DateTime.fromISO('2026-09-01T12:00:00.000Z'),
          terminaEm: DateTime.fromISO('2026-09-01T14:00:00.000Z'),
        },
      ],
    });

    expect(calcularSlots(ctx, { itens: [CORTE], profissionais: [rui] }, TERCA)).toEqual([]);
  });

  test('EXTRA acrescenta faixa fora da grade', () => {
    const ctx = contexto({
      excecoes: [
        {
          profissionalId: 'p-rui',
          tipo: 'EXTRA',
          iniciaEm: DateTime.fromISO('2026-09-01T17:00:00.000Z'),
          terminaEm: DateTime.fromISO('2026-09-01T18:00:00.000Z'),
        },
      ],
    });

    expect(horas(calcularSlots(ctx, { itens: [CORTE], profissionais: [rui] }, TERCA))).toContain(
      '14:00',
    );
  });

  test('bloqueio vence extra no mesmo horário', () => {
    const ctx = contexto({
      excecoes: [
        {
          profissionalId: 'p-rui',
          tipo: 'EXTRA',
          iniciaEm: DateTime.fromISO('2026-09-01T17:00:00.000Z'),
          terminaEm: DateTime.fromISO('2026-09-01T18:00:00.000Z'),
        },
        {
          profissionalId: 'p-rui',
          tipo: 'BLOQUEIO',
          iniciaEm: DateTime.fromISO('2026-09-01T17:00:00.000Z'),
          terminaEm: DateTime.fromISO('2026-09-01T18:00:00.000Z'),
        },
      ],
    });

    expect(
      horas(calcularSlots(ctx, { itens: [CORTE], profissionais: [rui] }, TERCA)),
    ).not.toContain('14:00');
  });
});

describe('limites de tempo', () => {
  test('antecedência mínima corta os primeiros slots', () => {
    const ctx = contexto({
      agora: DateTime.fromISO('2026-09-01T12:00:00.000Z'),
      config: { ...contexto().config, antecedenciaMinimaMin: 60 },
    });

    expect(horas(calcularSlots(ctx, { itens: [CORTE], profissionais: [rui] }, TERCA))).toEqual([
      '10:00',
      '10:15',
      '10:30',
    ]);
  });

  test('data além da janela de agendamento não devolve nada', () => {
    const ctx = contexto({ config: { ...contexto().config, janelaAgendamentoDias: 3 } });

    expect(calcularSlots(ctx, { itens: [CORTE], profissionais: [rui] }, TERCA)).toEqual([]);
  });

  test('o último dia da janela ainda vale', () => {
    const ctx = contexto({ config: { ...contexto().config, janelaAgendamentoDias: 7 } });

    expect(
      calcularSlots(ctx, { itens: [CORTE], profissionais: [rui] }, TERCA).length,
    ).toBeGreaterThan(0);
  });
});

describe('qualquer profissional', () => {
  const dois = contexto({
    grade: [
      {
        profissionalId: 'p-rui',
        diaSemana: 2,
        horaInicio: '09:00',
        horaFim: '10:00',
        vigenciaInicio: '2026-01-01',
        vigenciaFim: null,
      },
      {
        profissionalId: 'p-ana',
        diaSemana: 2,
        horaInicio: '09:30',
        horaFim: '10:30',
        vigenciaInicio: '2026-01-01',
        vigenciaFim: null,
      },
    ],
  });

  test('a união das disponibilidades, agrupada por horário', () => {
    const slots = calcularSlots(dois, { itens: [CORTE], profissionais: [rui, ana] }, TERCA);

    // 09:00 e 09:15 só do Rui; 09:30 dos dois; 09:45 e 10:00 só da Ana
    expect(horas(slots)).toEqual(['09:00', '09:15', '09:30', '09:45', '10:00']);
    expect(
      slots.find((s) => s.inicio.setZone(SP).toFormat('HH:mm') === '09:30')?.profissionalIds,
    ).toEqual(['p-ana', 'p-rui']);
  });

  test('a lista de profissionais é ordenada, não depende da ordem de entrada', () => {
    const numaOrdem = calcularSlots(dois, { itens: [CORTE], profissionais: [rui, ana] }, TERCA);
    const noutra = calcularSlots(dois, { itens: [CORTE], profissionais: [ana, rui] }, TERCA);

    expect(numaOrdem.map((s) => s.profissionalIds)).toEqual(noutra.map((s) => s.profissionalIds));
  });
});

describe('estratégia COMPACTO (6.7)', () => {
  test('emenda um atendimento no outro, sem alinhar à grade', () => {
    const ctx = contexto({
      config: { ...contexto().config, estrategiaSlot: 'COMPACTO' },
      grade: [
        {
          profissionalId: 'p-rui',
          diaSemana: 2,
          horaInicio: '09:00',
          horaFim: '10:30',
          vigenciaInicio: '2026-01-01',
          vigenciaFim: null,
        },
      ],
      ocupacoes: [
        {
          profissionalId: 'p-rui',
          ocupacaoInicio: DateTime.fromISO('2026-09-01T12:00:00.000Z'),
          ocupacaoFim: DateTime.fromISO('2026-09-01T12:20:00.000Z'),
        },
      ],
    });

    // O vão livre começa às 09:20 e o próximo slot sai exatamente daí
    expect(horas(calcularSlots(ctx, { itens: [CORTE], profissionais: [rui] }, TERCA))).toEqual([
      '09:20',
      '09:50',
    ]);
  });
});

describe('horário de verão (6.3)', () => {
  // 2018-11-04 é domingo e tem 23 horas; 2019-02-16 é sábado e tem 25
  const gradeDeFimDeSemana = (diaSemana: number) => [
    {
      profissionalId: 'p-rui',
      diaSemana,
      horaInicio: '09:00',
      horaFim: '11:00',
      vigenciaInicio: '2018-01-01',
      vigenciaFim: null,
    },
  ];

  test('o dia de 23 horas produz slots normais, no offset daquele dia', () => {
    const ctx = contexto({
      agora: DateTime.fromISO('2018-11-01T12:00:00.000Z'),
      grade: gradeDeFimDeSemana(0),
    });
    const slots = calcularSlots(ctx, { itens: [CORTE], profissionais: [rui] }, '2018-11-04');

    expect(horas(slots)).toEqual(['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30']);
    // Offset -02:00 naquele dia, contra -03:00 num dia comum
    expect(slots[0]?.inicio.toISO()).toBe('2018-11-04T11:00:00.000Z');
  });

  test('o dia de 25 horas produz slots normais, no outro offset', () => {
    const ctx = contexto({
      agora: DateTime.fromISO('2019-02-13T12:00:00.000Z'),
      grade: gradeDeFimDeSemana(6),
    });
    const slots = calcularSlots(ctx, { itens: [CORTE], profissionais: [rui] }, '2019-02-16');

    expect(horas(slots)).toHaveLength(7);
    expect(slots[0]?.inicio.toISO()).toBe('2019-02-16T11:00:00.000Z');
  });
});

describe('dias com vaga (6.4)', () => {
  test('lista só os dias que têm alguma vaga', () => {
    // A grade cobre terça; a semana de 2026-08-31 a 2026-09-06 tem uma terça
    expect(
      diasComVaga(contexto(), { itens: [CORTE], profissionais: [rui] }, '2026-08-31', '2026-09-06'),
    ).toEqual(['2026-09-01']);
  });

  test('dia inteiro bloqueado sai da lista', () => {
    const ctx = contexto({
      excecoes: [
        {
          profissionalId: null,
          tipo: 'BLOQUEIO',
          iniciaEm: DateTime.fromISO('2026-09-01T00:00:00.000Z'),
          terminaEm: DateTime.fromISO('2026-09-02T00:00:00.000Z'),
        },
      ],
    });

    expect(
      diasComVaga(ctx, { itens: [CORTE], profissionais: [rui] }, '2026-08-31', '2026-09-06'),
    ).toEqual([]);
  });

  test('respeita a janela de agendamento nos dois lados da fronteira', () => {
    const ctx = contexto({ config: { ...contexto().config, janelaAgendamentoDias: 3 } });
    const pedido = { itens: [CORTE], profissionais: [rui] };

    // Hoje é 2026-08-25, terça com grade: dentro da janela, aparece
    expect(diasComVaga(ctx, pedido, '2026-08-25', '2026-08-28')).toEqual(['2026-08-25']);

    // 2026-09-01 também é terça com grade, mas cai depois dos 3 dias
    expect(diasComVaga(ctx, pedido, '2026-08-29', '2026-09-30')).toEqual([]);
  });

  test('concorda com calcularSlots dia a dia', () => {
    const ctx = contexto();
    const pedido = { itens: [CORTE], profissionais: [rui] };
    const dias = diasComVaga(ctx, pedido, '2026-08-31', '2026-09-15');

    for (const dia of dias) {
      expect(calcularSlots(ctx, pedido, dia).length).toBeGreaterThan(0);
    }
  });
});
