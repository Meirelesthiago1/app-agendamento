import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { comBarras, varrer } from './lib/arquivos.ts';
import { removerComentarios } from './lib/fonte.ts';
import type { Violacao } from './lib/tipos.ts';

export const NOME = 'nenhum hex fora de primitivos.css (D14)';

const ARQUIVO_PERMITIDO = 'packages/ui/src/tokens/primitivos.css';

const EXTENSOES = ['.css', '.ts', '.tsx'];

const HEX =
  /(?<![\w#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;

const AREAS = ['apps', 'packages', 'ferramentas'];

export function verificar(raiz: string): Violacao[] {
  const violacoes: Violacao[] = [];

  for (const area of AREAS) {
    for (const arquivo of varrer(join(raiz, area), EXTENSOES)) {
      const caminho = comBarras(relative(raiz, arquivo));

      if (caminho === ARQUIVO_PERMITIDO) {
        continue;
      }

      const fonte = readFileSync(arquivo, 'utf8');
      const codigo = removerComentarios(fonte, caminho.endsWith('.css') ? 'css' : 'ts', true);

      for (const encontro of codigo.matchAll(HEX)) {
        violacoes.push({
          arquivo: caminho,
          linha: codigo.slice(0, encontro.index).split('\n').length,
          mensagem: `hex literal '${encontro[0]}'; o único lugar é ${ARQUIVO_PERMITIDO}`,
        });
      }
    }
  }

  return violacoes;
}
