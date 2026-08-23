import { DateTime } from 'luxon';
import { describe, expect, test } from 'vitest';
import {
  dataDe,
  datasEntre,
  diaDaSemana,
  emUtc,
  horasNoDia,
  janelaEmUtc,
  somarDias,
  vigenteEm,
} from './index.js';

const SP = 'America/Sao_Paulo';

// O Brasil observou horário de verão até 2019, e são essas as datas reais das
// duas transições que 10.2 do stack exige cobrir.
const ENTRADA_DO_VERAO = '2018-11-04';
const SAIDA_DO_VERAO = '2019-02-16';
const DIA_COMUM = '2018-11-03';

describe('conversão de hora local para UTC', () => {
  test('usa o fuso do estabelecimento', () => {
    expect(emUtc('2026-09-01', '08:00', SP).toISO()).toBe('2026-09-01T11:00:00.000Z');
  });

  test('aceita hora com e sem segundos', () => {
    expect(emUtc('2026-09-01', '08:00', SP).toISO()).toBe(
      emUtc('2026-09-01', '08:00:00', SP).toISO(),
    );
  });

  test('o mesmo horário da grade cai em instantes diferentes conforme a data', () => {
    const comum = emUtc(DIA_COMUM, '08:00', SP);
    const noVerao = emUtc('2018-11-05', '08:00', SP);

    // É por isso que a conversão não pode ser pré-calculada para a semana (6.3)
    expect(comum.toISO()).toBe('2018-11-03T11:00:00.000Z');
    expect(noVerao.toISO()).toBe('2018-11-05T10:00:00.000Z');
  });
});

describe('horário de verão', () => {
  test('a entrada do horário de verão tem dia de 23 horas', () => {
    expect(horasNoDia(ENTRADA_DO_VERAO, SP)).toBe(23);
  });

  test('a saída do horário de verão tem dia de 25 horas', () => {
    expect(horasNoDia(SAIDA_DO_VERAO, SP)).toBe(25);
  });

  test('dia comum tem 24 horas', () => {
    expect(horasNoDia(DIA_COMUM, SP)).toBe(24);
  });

  test('a janela comercial atravessa a transição sem encolher', () => {
    const janela = janelaEmUtc(ENTRADA_DO_VERAO, '08:00', '12:00', SP);

    expect(janela.fim.diff(janela.inicio, 'hours').hours).toBe(4);
  });

  test('hora local inexistente é deslocada para frente, e a janela encurta', () => {
    // 00:00 não existe em 2018-11-04: o relógio pula de 23:59 para 01:00
    const janela = janelaEmUtc(ENTRADA_DO_VERAO, '00:00', '06:00', SP);

    expect(janela.fim.diff(janela.inicio, 'hours').hours).toBe(5);
  });

  test('a hora repetida na saída do verão resolve de forma determinística', () => {
    // 23:00 acontece duas vezes em 2019-02-16: às 01:00 UTC (offset -02:00) e às
    // 02:00 UTC (offset -03:00). O Luxon devolve a segunda, já com o offset de
    // depois da transição. Qual das duas importa menos do que ser sempre a mesma.
    const janela = janelaEmUtc(SAIDA_DO_VERAO, '23:00', '23:59', SP);

    expect(janela.inicio.toISO()).toBe('2019-02-17T02:00:00.000Z');
    expect(janelaEmUtc(SAIDA_DO_VERAO, '23:00', '23:59', SP).inicio.toISO()).toBe(
      janela.inicio.toISO(),
    );
  });
});

describe('calendário', () => {
  test('domingo é 0 e sábado é 6', () => {
    expect(diaDaSemana('2026-08-23')).toBe(0);
    expect(diaDaSemana('2026-08-24')).toBe(1);
    expect(diaDaSemana('2026-08-29')).toBe(6);
  });

  test('datasEntre é inclusivo nas duas pontas', () => {
    expect(datasEntre('2026-09-01', '2026-09-03')).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ]);
  });

  test('datasEntre atravessa a transição sem pular nem repetir dia', () => {
    expect(datasEntre('2018-11-03', '2018-11-05')).toEqual([
      '2018-11-03',
      '2018-11-04',
      '2018-11-05',
    ]);
  });

  test('a data de um instante depende do fuso', () => {
    const instante = DateTime.fromISO('2026-09-02T02:00:00.000Z');

    expect(dataDe(instante, SP)).toBe('2026-09-01');
    expect(dataDe(instante, 'UTC')).toBe('2026-09-02');
  });

  test('somarDias', () => {
    expect(somarDias('2026-08-30', 3)).toBe('2026-09-02');
    expect(somarDias('2026-09-02', -3)).toBe('2026-08-30');
  });
});

describe('vigência da grade', () => {
  test('fim nulo significa vigente', () => {
    expect(vigenteEm('2026-09-01', '2026-01-01', null)).toBe(true);
  });

  test('inclusiva nas duas pontas', () => {
    expect(vigenteEm('2026-01-01', '2026-01-01', '2026-01-31')).toBe(true);
    expect(vigenteEm('2026-01-31', '2026-01-01', '2026-01-31')).toBe(true);
  });

  test('fora do intervalo', () => {
    expect(vigenteEm('2025-12-31', '2026-01-01', '2026-01-31')).toBe(false);
    expect(vigenteEm('2026-02-01', '2026-01-01', '2026-01-31')).toBe(false);
  });
});

describe('entradas inválidas', () => {
  test('janela invertida é recusada', () => {
    expect(() => janelaEmUtc('2026-09-01', '18:00', '08:00', SP)).toThrow(/invertida/);
  });

  test('fuso inexistente é recusado', () => {
    expect(() => emUtc('2026-09-01', '08:00', 'Marte/Olympus')).toThrow();
  });
});
