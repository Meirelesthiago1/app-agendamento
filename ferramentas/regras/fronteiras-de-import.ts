import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { comBarras, varrer } from './lib/arquivos.ts';
import { eRelativo, extrairEspecificadores, pacoteDe } from './lib/fonte.ts';
import type { Violacao } from './lib/tipos.ts';

export const NOME = 'grafo de dependências e fronteira entre funcionalidades (T16, D8)';

/** O grafo de 4.2 do stack, mais D8: `ui` não conhece domínio. */
const PERMITIDO: Record<string, readonly string[]> = {
  'packages/dominio': [],
  'packages/contratos': ['@agendamento/dominio'],
  'packages/db': ['@agendamento/dominio'],
  'packages/ui': [],
  /**
   * `ui` entra aqui como emenda a 4.2, e a razão é dura: cliente de e-mail não
   * suporta custom property, então template precisa dos valores de cor
   * **embutidos** no HTML. Sem esta aresta, a paleta seria copiada para dentro
   * da API — que é exatamente o que D14 existe para impedir. A API usa de `ui`
   * apenas os tokens e `derivarPaleta`, nunca componente.
   */
  'apps/api': [
    '@agendamento/dominio',
    '@agendamento/contratos',
    '@agendamento/db',
    '@agendamento/ui',
  ],
  'apps/painel': ['@agendamento/dominio', '@agendamento/contratos', '@agendamento/ui'],
  'apps/publico': ['@agendamento/dominio', '@agendamento/contratos', '@agendamento/ui'],
  'apps/playground': ['@agendamento/ui'],
};

const ESCOPO = '@agendamento/';

function areaDe(caminho: string): string | null {
  const partes = caminho.split('/');
  const raiz = partes[0];
  const nome = partes[1];

  if ((raiz !== 'apps' && raiz !== 'packages') || nome === undefined) {
    return null;
  }

  return `${raiz}/${nome}`;
}

function funcionalidadeDe(caminho: string): string | null {
  const partes = caminho.split('/');
  const indice = partes.indexOf('funcionalidades');

  if (indice === -1 || partes[indice + 1] === undefined) {
    return null;
  }

  return partes.slice(0, indice + 2).join('/');
}

export function verificar(raiz: string): Violacao[] {
  const violacoes: Violacao[] = [];

  for (const area of Object.keys(PERMITIDO)) {
    const permitidos = PERMITIDO[area] ?? [];

    for (const arquivo of varrer(join(raiz, area), ['.ts', '.tsx'])) {
      const caminho = comBarras(relative(raiz, arquivo));
      const fonte = readFileSync(arquivo, 'utf8');

      for (const { valor, linha } of extrairEspecificadores(fonte)) {
        const relatar = (mensagem: string) => violacoes.push({ arquivo: caminho, linha, mensagem });

        if (!eRelativo(valor)) {
          const pacote = pacoteDe(valor);

          if (pacote.startsWith(ESCOPO) && !permitidos.includes(pacote)) {
            relatar(
              permitidos.length === 0
                ? `importa '${pacote}'; ${area} não pode depender de nenhum pacote interno`
                : `importa '${pacote}'; ${area} só pode depender de ${permitidos.join(', ')}`,
            );
          }

          continue;
        }

        const alvo = comBarras(relative(raiz, resolve(dirname(arquivo), valor)));
        const areaAlvo = areaDe(alvo);

        if (areaAlvo !== null && areaAlvo !== area) {
          relatar(`alcança '${alvo}' por caminho relativo; ${area} não pode sair da própria área`);
          continue;
        }

        const origem = funcionalidadeDe(caminho);
        const destino = funcionalidadeDe(alvo);

        if (origem !== null && destino !== null && origem !== destino) {
          relatar(
            `importa de '${destino}'; funcionalidade não importa de funcionalidade — o que é comum sobe para componentes/ ou packages/ui`,
          );
        }
      }
    }
  }

  return violacoes;
}
