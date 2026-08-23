import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { comBarras, varrer } from './lib/arquivos.ts';
import { removerComentarios } from './lib/fonte.ts';
import type { Violacao } from './lib/tipos.ts';

export const NOME = 'nenhum hex fora de primitivos.css (D14)';

/**
 * A fonte dos valores crus é `primitivos.ts`; o `.css` é gerado a partir dele, e
 * há teste que reprova a divergência entre os dois. Arquivo de teste fica de
 * fora pela mesma razão da regra de fronteira: não vai para o artefato, e um
 * teste de cor precisa de literais para ter o que verificar.
 */
const ARQUIVOS_PERMITIDOS = new Set([
  'packages/ui/src/tokens/primitivos.ts',
  'packages/ui/src/tokens/primitivos.css',
]);

const SUFIXO_DE_TESTE = /\.teste\.tsx?$/;

const EXTENSOES = ['.css', '.ts', '.tsx'];

const HEX =
  /(?<![\w#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;

const AREAS = ['apps', 'packages', 'ferramentas'];

export function verificar(raiz: string): Violacao[] {
  const violacoes: Violacao[] = [];

  for (const area of AREAS) {
    for (const arquivo of varrer(join(raiz, area), EXTENSOES)) {
      const caminho = comBarras(relative(raiz, arquivo));

      if (ARQUIVOS_PERMITIDOS.has(caminho) || SUFIXO_DE_TESTE.test(caminho)) {
        continue;
      }

      const fonte = readFileSync(arquivo, 'utf8');
      const codigo = removerComentarios(fonte, caminho.endsWith('.css') ? 'css' : 'ts', true);

      for (const encontro of codigo.matchAll(HEX)) {
        violacoes.push({
          arquivo: caminho,
          linha: codigo.slice(0, encontro.index).split('\n').length,
          mensagem: `hex literal '${encontro[0]}'; a fonte é ${[...ARQUIVOS_PERMITIDOS][0]}`,
        });
      }
    }
  }

  return violacoes;
}
