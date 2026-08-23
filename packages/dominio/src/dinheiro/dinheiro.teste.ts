import { describe, expect, test } from 'vitest';
import {
  formatarBRL,
  formatarValorExibido,
  type ItemDeValor,
  somarCentavos,
  totalizar,
} from './index.js';

/** O Intl usa espaço não separável depois do símbolo da moeda. */
const semEspacoEstranho = (texto: string) => texto.replace(/ /g, ' ');

const item = (exibicao: ItemDeValor['exibicao'], centavos: number | null): ItemDeValor => ({
  exibicao,
  centavos,
});

describe('formatação', () => {
  test('formata centavos em reais', () => {
    expect(semEspacoEstranho(formatarBRL(5000))).toBe('R$ 50,00');
    expect(semEspacoEstranho(formatarBRL(18050))).toBe('R$ 180,50');
    expect(semEspacoEstranho(formatarBRL(0))).toBe('R$ 0,00');
  });

  test('separa milhar', () => {
    expect(semEspacoEstranho(formatarBRL(123456))).toBe('R$ 1.234,56');
  });

  test('valor negativo, como o estorno do caixa', () => {
    expect(semEspacoEstranho(formatarBRL(-8000))).toBe('-R$ 80,00');
  });
});

describe('soma', () => {
  test('trata nulo como zero', () => {
    expect(somarCentavos([5000, null, 2500])).toBe(7500);
  });

  test('lista vazia soma zero', () => {
    expect(somarCentavos([])).toBe(0);
  });
});

describe('total de um agendamento com múltiplos itens', () => {
  test('todos fixos somam e continuam fixos', () => {
    expect(totalizar([item('FIXO', 5000), item('FIXO', 3000)])).toEqual({
      tipo: 'FIXO',
      centavos: 8000,
    });
  });

  test('um item A_PARTIR_DE torna o total a partir de', () => {
    expect(totalizar([item('FIXO', 5000), item('A_PARTIR_DE', 3000)])).toEqual({
      tipo: 'A_PARTIR_DE',
      centavos: 8000,
    });
  });

  test('um item OCULTO torna o total a partir de, somando o que se conhece', () => {
    expect(totalizar([item('FIXO', 5000), item('OCULTO', null)])).toEqual({
      tipo: 'A_PARTIR_DE',
      centavos: 5000,
    });
  });

  test('gratuito soma zero sem tornar o total incerto', () => {
    expect(totalizar([item('FIXO', 5000), item('GRATUITO', null)])).toEqual({
      tipo: 'FIXO',
      centavos: 5000,
    });
  });

  test('todos gratuitos resultam em gratuito', () => {
    expect(totalizar([item('GRATUITO', null), item('GRATUITO', null)])).toEqual({
      tipo: 'GRATUITO',
    });
  });

  test('todos ocultos resultam em oculto, não em "a partir de R$ 0,00"', () => {
    expect(totalizar([item('OCULTO', null), item('OCULTO', null)])).toEqual({ tipo: 'OCULTO' });
  });

  test('sem itens não há valor a exibir', () => {
    expect(totalizar([])).toEqual({ tipo: 'OCULTO' });
  });

  test('os cinco itens do limite de 6.2', () => {
    const cinco = Array.from({ length: 5 }, () => item('FIXO', 2000));

    expect(totalizar(cinco)).toEqual({ tipo: 'FIXO', centavos: 10000 });
  });
});

describe('texto exibido', () => {
  test('cada tipo tem sua forma', () => {
    expect(semEspacoEstranho(formatarValorExibido({ tipo: 'FIXO', centavos: 5000 }))).toBe(
      'R$ 50,00',
    );
    expect(semEspacoEstranho(formatarValorExibido({ tipo: 'A_PARTIR_DE', centavos: 5000 }))).toBe(
      'a partir de R$ 50,00',
    );
    expect(formatarValorExibido({ tipo: 'GRATUITO' })).toBe('Gratuito');
    expect(formatarValorExibido({ tipo: 'OCULTO' })).toBe('Sob consulta');
  });
});
