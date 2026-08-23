import { describe, expect, test } from 'vitest';
import { NEUTROS } from '../tokens/primitivos.ts';
import { contraste, hexParaOklch, hexParaRgb, oklchParaHex, rgbParaHex } from './cor.ts';
import { COR_PADRAO, derivarPaleta, paletaComoCss } from './derivar-paleta.ts';

describe('conversão de cor', () => {
  test('ida e volta preserva a cor', () => {
    for (const hex of ['#1C2A3A', '#FFFFFF', '#000000', '#FF0000', '#6B7280']) {
      expect(rgbParaHex(hexParaRgb(hex))).toBe(hex);
      expect(oklchParaHex(hexParaOklch(hex))).toBe(hex);
    }
  });

  test('aceita a forma de três dígitos', () => {
    expect(rgbParaHex(hexParaRgb('#FFF'))).toBe('#FFFFFF');
    expect(rgbParaHex(hexParaRgb('#000'))).toBe('#000000');
  });

  test('luminosidade em OKLCH bate com os extremos conhecidos', () => {
    expect(hexParaOklch('#FFFFFF').l).toBeCloseTo(1, 2);
    expect(hexParaOklch('#000000').l).toBeCloseTo(0, 2);
  });

  test('cinza puro tem croma zero', () => {
    expect(hexParaOklch('#808080').c).toBeCloseTo(0, 3);
  });

  test('contraste bate com os valores da WCAG', () => {
    expect(contraste('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  test('cor inválida é recusada', () => {
    expect(() => hexParaRgb('vermelho')).toThrow();
    expect(() => hexParaRgb('#12345')).toThrow();
  });
});

/** Os dois casos que o critério de pronto da etapa 4 nomeia. */
describe('a cor do tenant, derivada', () => {
  test('amarelo puro é ajustado: como veio, o botão some na página branca', () => {
    const paleta = derivarPaleta('#FFFF00');

    expect(paleta.comprimida).toBe(true);
    // O amarelo tem ótimo contraste com texto preto — o que ele reprova é o
    // contraste contra a superfície, e é por isso que o botão desaparece
    expect(contraste('#FFFF00', '#FFFFFF')).toBeLessThan(3);
    expect(paleta.contrasteDaSuperficie).toBeGreaterThanOrEqual(3);
    expect(paleta.contrasteDoConteudo).toBeGreaterThanOrEqual(4.5);
  });

  test('branco é ajustado: um botão branco sobre página branca não existe', () => {
    const paleta = derivarPaleta('#FFFFFF');

    expect(paleta.comprimida).toBe(true);
    expect(paleta.acao).not.toBe('#FFFFFF');
    expect(paleta.contrasteDaSuperficie).toBeGreaterThanOrEqual(3);
    expect(paleta.contrasteDoConteudo).toBeGreaterThanOrEqual(4.5);
  });

  test('a cor da referência passa intacta', () => {
    const paleta = derivarPaleta(COR_PADRAO);

    expect(paleta.comprimida).toBe(false);
    expect(paleta.acao).toBe(COR_PADRAO);
  });

  test('o texto sobre a ação nunca é fixo: escolhe o de maior contraste', () => {
    expect(derivarPaleta('#1C2A3A').acaoConteudo).toBe(NEUTROS.branco);
    expect(derivarPaleta('#FFFF00').acaoConteudo).toBe(NEUTROS['cinza-900']);
  });

  test('qualquer cor produz botão visível com texto legível', () => {
    const cores = [
      '#FFFF00',
      '#FFFFFF',
      '#000000',
      '#FF0000',
      '#00FF00',
      '#0000FF',
      '#1C2A3A',
      '#7C3AED',
      '#FF69B4',
      '#2E8B57',
      '#FFA500',
      '#00FFFF',
    ];

    for (const cor of cores) {
      const paleta = derivarPaleta(cor);

      expect(contraste(paleta.acao, paleta.acaoConteudo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(paleta.acao, '#FFFFFF')).toBeGreaterThanOrEqual(3);
    }
  });

  test('a forte é mais escura que a ação, e a suave é quase branca', () => {
    for (const cor of ['#1C2A3A', '#FFFF00', '#7C3AED']) {
      const paleta = derivarPaleta(cor);

      expect(hexParaOklch(paleta.acaoForte).l).toBeLessThan(hexParaOklch(paleta.acao).l);
      expect(hexParaOklch(paleta.acaoSuave).l).toBeGreaterThan(0.9);
    }
  });

  test('a matiz é preservada: o gestor recebe a cor que escolheu', () => {
    const escolhida = hexParaOklch('#7C3AED');
    const paleta = derivarPaleta('#7C3AED');

    expect(hexParaOklch(paleta.acao).h).toBeCloseTo(escolhida.h, 0);
    expect(hexParaOklch(paleta.acaoSuave).h).toBeCloseTo(escolhida.h, 0);
  });

  test('cor inválida cai no padrão em vez de quebrar a página', () => {
    expect(derivarPaleta('nao-e-cor').acao).toBe(COR_PADRAO);
  });

  test('o CSS sai pronto para o bloco do layout do público', () => {
    const css = paletaComoCss(derivarPaleta(COR_PADRAO));

    expect(css).toContain('--acao:');
    expect(css).toContain('--acao-conteudo:');
  });
});
