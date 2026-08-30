import { describe, expect, test } from 'vitest';
import {
  centavosDoTexto,
  horaDeMinutos,
  mascararCep,
  mascararHora,
  mascararMoeda,
  mascararTelefone,
  minutosDeHora,
} from './mascaras.ts';

describe('telefone', () => {
  test('o parcial é legível enquanto se digita', () => {
    expect(mascararTelefone('')).toBe('');
    expect(mascararTelefone('1')).toBe('(1');
    expect(mascararTelefone('11')).toBe('(11');
    expect(mascararTelefone('119')).toBe('(11) 9');
    expect(mascararTelefone('11987')).toBe('(11) 987');
    expect(mascararTelefone('119876')).toBe('(11) 9876');
  });

  test('fixo quebra em 4+4 e celular em 5+4', () => {
    expect(mascararTelefone('1123456789')).toBe('(11) 2345-6789');
    expect(mascararTelefone('11987654321')).toBe('(11) 98765-4321');
  });

  test('o que passa de onze dígitos é descartado, não empurra a máscara', () => {
    expect(mascararTelefone('119876543219999')).toBe('(11) 98765-4321');
  });

  test('texto colado com formatação alheia é reformatado', () => {
    expect(mascararTelefone('+55 (11) 98765.4321')).toBe('(55) 11987-6543');
  });
});

describe('CEP', () => {
  test('parte em 5+3', () => {
    expect(mascararCep('01310200')).toBe('01310-200');
    expect(mascararCep('013')).toBe('013');
  });
});

describe('moeda', () => {
  test('digita da direita para a esquerda, como caixa', () => {
    expect(mascararMoeda(0)).toBe('0,00');
    expect(mascararMoeda(5)).toBe('0,05');
    expect(mascararMoeda(80)).toBe('0,80');
    expect(mascararMoeda(8000)).toBe('80,00');
  });

  test('milhar recebe separador', () => {
    expect(mascararMoeda(123456)).toBe('1.234,56');
  });

  test('o texto volta a centavos sem passar por ponto flutuante', () => {
    expect(centavosDoTexto('1.234,56')).toBe(123456);
    expect(centavosDoTexto('')).toBe(0);
    // 0,29 em float é 28.999...; o caminho inteiro não tem esse problema
    expect(centavosDoTexto('0,29')).toBe(29);
  });

  test('ida e volta preserva o valor', () => {
    for (const centavos of [0, 1, 99, 100, 4999, 123456, 99999999]) {
      expect(centavosDoTexto(mascararMoeda(centavos))).toBe(centavos);
    }
  });
});

describe('hora', () => {
  test('três dígitos são hora de um algarismo', () => {
    expect(mascararHora('930')).toBe('09:30');
    expect(mascararHora('9')).toBe('9');
    expect(mascararHora('0930')).toBe('09:30');
    expect(mascararHora('1830')).toBe('18:30');
  });

  test('hora incompleta não vira minutos', () => {
    expect(minutosDeHora('9:3')).toBeNull();
    expect(minutosDeHora('')).toBeNull();
  });

  test('hora impossível é recusada em vez de normalizada', () => {
    expect(minutosDeHora('24:00')).toBeNull();
    expect(minutosDeHora('12:60')).toBeNull();
  });

  test('minutos e texto são o mesmo valor nos dois sentidos', () => {
    expect(minutosDeHora('00:00')).toBe(0);
    expect(minutosDeHora('09:30')).toBe(570);
    expect(minutosDeHora('23:59')).toBe(1439);
    expect(horaDeMinutos(570)).toBe('09:30');
    expect(horaDeMinutos(0)).toBe('00:00');
  });

  test('comparar como número ordena certo, o que comparar texto não faz', () => {
    // '9:00' > '10:00' em ordem alfabética — é o erro que a unidade evita
    expect(minutosDeHora('09:00')).toBeLessThan(minutosDeHora('10:00') ?? 0);
  });
});
