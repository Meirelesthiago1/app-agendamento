import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { comBarras, varrer } from './lib/arquivos.ts';
import { eRelativo, extrairEspecificadores, pacoteDe } from './lib/fonte.ts';
import type { Violacao } from './lib/tipos.ts';

export const NOME = 'packages/dominio importa apenas luxon (T25)';

const PERMITIDOS = new Set(['luxon']);

export function verificar(raiz: string): Violacao[] {
  const violacoes: Violacao[] = [];

  for (const arquivo of varrer(join(raiz, 'packages', 'dominio', 'src'), ['.ts', '.tsx'])) {
    const fonte = readFileSync(arquivo, 'utf8');

    for (const { valor, linha } of extrairEspecificadores(fonte)) {
      if (eRelativo(valor) || PERMITIDOS.has(pacoteDe(valor))) {
        continue;
      }

      violacoes.push({
        arquivo: comBarras(relative(raiz, arquivo)),
        linha,
        mensagem: `importa '${valor}'; dominio só pode importar ${[...PERMITIDOS].join(', ')}`,
      });
    }
  }

  return violacoes;
}
