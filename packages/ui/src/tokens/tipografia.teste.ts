import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import arial from '@capsizecss/metrics/arial';
import inter from '@capsizecss/metrics/inter';
import { describe, expect, test } from 'vitest';
import { calcularAjuste, faceDeFallbackCss } from './fallback-tipografico.ts';

const CSS_DA_FONTE = fileURLToPath(new URL('./fonte.css', import.meta.url));

const ajuste = calcularAjuste(inter, arial);

/** Encerra D-g: os números vêm das tabelas das fontes, não de um artigo. */
describe('métricas do fallback tipográfico', () => {
  test('o CSS declara exatamente o que o cálculo produz', () => {
    const css = readFileSync(CSS_DA_FONTE, 'utf8');

    expect(css).toContain(`size-adjust: ${ajuste.sizeAdjust};`);
    expect(css).toContain(`ascent-override: ${ajuste.ascentOverride};`);
    expect(css).toContain(`descent-override: ${ajuste.descentOverride};`);
    expect(css).toContain(`line-gap-override: ${ajuste.lineGapOverride};`);
  });

  test('a Arial é mais estreita que a Inter, e o ajuste a alarga', () => {
    expect(Number.parseFloat(ajuste.sizeAdjust)).toBeGreaterThan(100);
  });

  test('a caixa de linha resultante coincide com a da Inter', () => {
    const daInter = (inter.ascent - inter.descent + inter.lineGap) / inter.unitsPerEm;
    const escala = Number.parseFloat(ajuste.sizeAdjust) / 100;
    const doFallback =
      ((Number.parseFloat(ajuste.ascentOverride) +
        Number.parseFloat(ajuste.descentOverride) +
        Number.parseFloat(ajuste.lineGapOverride)) /
        100) *
      escala;

    expect(doFallback).toBeCloseTo(daInter, 3);
  });

  test('a face montada tem as quatro linhas de ajuste', () => {
    const face = faceDeFallbackCss('Inter Fallback', 'Arial', ajuste);

    expect(face).toContain("src: local('Arial')");
    expect(face.match(/override|size-adjust/g)).toHaveLength(4);
  });
});
