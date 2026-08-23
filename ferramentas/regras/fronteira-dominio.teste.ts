import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { verificar } from './fronteira-dominio.ts';
import { criarFixtura, type Fixtura } from './lib/fixtura.ts';

describe('fronteira de packages/dominio', () => {
  let fixtura: Fixtura;

  beforeEach(() => {
    fixtura = criarFixtura('regra-dominio');
  });

  afterEach(() => {
    fixtura.descartar();
  });

  test('aceita luxon e import relativo', () => {
    fixtura.escrever(
      'packages/dominio/src/tempo/converter.ts',
      ["import { DateTime } from 'luxon';", "import { grade } from './grade.js';", ''].join('\n'),
    );

    expect(verificar(fixtura.raiz)).toEqual([]);
  });

  test('recusa qualquer outro pacote', () => {
    fixtura.escrever(
      'packages/dominio/src/agendamento/repositorio.ts',
      "import { sql } from 'drizzle-orm';\n",
    );

    const violacoes = verificar(fixtura.raiz);

    expect(violacoes).toHaveLength(1);
    expect(violacoes[0]?.mensagem).toContain('drizzle-orm');
    expect(violacoes[0]?.linha).toBe(1);
  });

  test('recusa builtin do node, que não roda no browser', () => {
    fixtura.escrever(
      'packages/dominio/src/tempo/relogio.ts',
      "import { readFileSync } from 'node:fs';\n",
    );

    expect(verificar(fixtura.raiz)).toHaveLength(1);
  });

  const IMPORTA_VITEST = ["import { test } from 'vitest';", ''].join('\n');

  test('arquivo de teste pode importar vitest: nao vai para o dist', () => {
    fixtura.escrever('packages/dominio/src/tempo/tempo.teste.ts', IMPORTA_VITEST);

    expect(verificar(fixtura.raiz)).toEqual([]);
  });

  test('mas o codigo publicado ao lado dele nao pode', () => {
    fixtura.escrever('packages/dominio/src/tempo/tempo.teste.ts', IMPORTA_VITEST);
    fixtura.escrever('packages/dominio/src/tempo/index.ts', IMPORTA_VITEST);

    const violacoes = verificar(fixtura.raiz);

    expect(violacoes).toHaveLength(1);
    expect(violacoes[0]?.arquivo).toBe('packages/dominio/src/tempo/index.ts');
  });

  test('ignora ocorrencia em comentario e em literal de texto', () => {
    fixtura.escrever(
      'packages/dominio/src/nota.ts',
      [
        "// os dados vem from 'drizzle-orm', carregados pelo caso de uso",
        'export const nota = "carrega from \'zod\' antes de calcular";',
        '',
      ].join('\n'),
    );

    expect(verificar(fixtura.raiz)).toEqual([]);
  });
});
