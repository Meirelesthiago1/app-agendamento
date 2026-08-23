import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { comBarras, varrer } from './lib/arquivos.ts';
import { eRelativo, extrairEspecificadores, pacoteDe } from './lib/fonte.ts';
import type { Violacao } from './lib/tipos.ts';

export const NOME = 'packages/dominio importa apenas luxon (T25)';

const PERMITIDOS = new Set(['luxon']);

/**
 * A regra existe para garantir que `dominio` rode no browser, e o que roda no
 * browser é o que sai em `dist/`. Arquivo de teste é excluído do
 * `tsconfig.build.json` e nunca é publicado — o mesmo sufixo vale aqui.
 */
const SUFIXO_DE_TESTE = /\.teste\.tsx?$/;

export function verificar(raiz: string): Violacao[] {
  const violacoes: Violacao[] = [];

  for (const arquivo of varrer(join(raiz, 'packages', 'dominio', 'src'), ['.ts', '.tsx'])) {
    if (SUFIXO_DE_TESTE.test(arquivo)) {
      continue;
    }

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
