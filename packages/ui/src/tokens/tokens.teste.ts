import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { contraste } from '../marca/cor.ts';
import { gerarPrimitivosCss } from './gerar.ts';
import { ESTADOS, MARCA, NEUTROS, PRIMITIVOS } from './primitivos.ts';

const CSS_GERADO = fileURLToPath(new URL('./primitivos.css', import.meta.url));

describe('primitivos.css é gerado, não escrito', () => {
  test('o arquivo em disco confere com a fonte em TypeScript', () => {
    // Se este teste reprovar: `pnpm --filter @agendamento/ui tokens`
    expect(readFileSync(CSS_GERADO, 'utf8')).toBe(gerarPrimitivosCss());
  });

  test('todo primitivo aparece no CSS', () => {
    const css = gerarPrimitivosCss();

    for (const nome of Object.keys(PRIMITIVOS)) {
      expect(css).toContain(`--${nome}:`);
    }
  });
});

/**
 * A auditoria de contraste é critério de pronto da etapa, não revisão do fim
 * (4.5). AA pede 4.5:1 em texto e 3:1 em controle e borda de campo.
 */
describe('contraste AA da paleta padrão', () => {
  const TEXTO = 4.5;
  const CONTROLE = 3;

  test('texto principal sobre as duas superfícies', () => {
    expect(contraste(NEUTROS['cinza-900'], NEUTROS.branco)).toBeGreaterThanOrEqual(TEXTO);
    expect(contraste(NEUTROS['cinza-900'], NEUTROS['cinza-50'])).toBeGreaterThanOrEqual(TEXTO);
  });

  test('texto de apoio sobre as duas superfícies', () => {
    expect(contraste(NEUTROS['cinza-500'], NEUTROS.branco)).toBeGreaterThanOrEqual(TEXTO);
    expect(contraste(NEUTROS['cinza-500'], NEUTROS['cinza-50'])).toBeGreaterThanOrEqual(TEXTO);
  });

  test('a ação padrão carrega texto branco', () => {
    expect(contraste(MARCA['navy-500'], NEUTROS.branco)).toBeGreaterThanOrEqual(TEXTO);
    expect(contraste(MARCA['navy-600'], NEUTROS.branco)).toBeGreaterThanOrEqual(TEXTO);
  });

  test('cada família de estado tem contraste de texto sobre o próprio suave', () => {
    const familias = [
      [ESTADOS['verde-800'], ESTADOS['verde-50']],
      [ESTADOS['ambar-800'], ESTADOS['ambar-50']],
      [ESTADOS['vermelho-800'], ESTADOS['vermelho-50']],
      [NEUTROS['cinza-700'], NEUTROS['cinza-100']],
    ] as const;

    for (const [conteudo, fundo] of familias) {
      expect(contraste(conteudo, fundo)).toBeGreaterThanOrEqual(TEXTO);
    }
  });

  test('a cor sólida de cada estado serve de fundo com texto branco', () => {
    for (const solida of [
      ESTADOS['verde-700'],
      ESTADOS['ambar-700'],
      ESTADOS['vermelho-700'],
      NEUTROS['cinza-600'],
    ]) {
      expect(contraste(solida, NEUTROS.branco)).toBeGreaterThanOrEqual(TEXTO);
    }
  });

  test('a borda de campo se distingue da superfície', () => {
    expect(contraste(NEUTROS['cinza-300'], NEUTROS.branco)).toBeGreaterThanOrEqual(1.4);
    expect(contraste(NEUTROS['cinza-500'], NEUTROS.branco)).toBeGreaterThanOrEqual(CONTROLE);
  });
});
