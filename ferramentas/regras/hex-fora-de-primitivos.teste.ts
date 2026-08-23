import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { verificar } from './hex-fora-de-primitivos.ts';
import { criarFixtura, type Fixtura } from './lib/fixtura.ts';

// Montado por concatenação de propósito: um hex literal aqui faria este arquivo
// reprovar na própria regra que ele testa.
const HEX = `#${'8b5cf6'}`;

describe('hex fora de primitivos.css', () => {
  let fixtura: Fixtura;

  beforeEach(() => {
    fixtura = criarFixtura('regra-hex');
  });

  afterEach(() => {
    fixtura.descartar();
  });

  test('aceita hex na fonte em TypeScript e no CSS gerado dela', () => {
    fixtura.escrever('packages/ui/src/tokens/primitivos.ts', `export const roxo = '${HEX}';\n`);
    fixtura.escrever('packages/ui/src/tokens/primitivos.css', `:root { --violeta-500: ${HEX}; }\n`);

    expect(verificar(fixtura.raiz)).toEqual([]);
  });

  test('aceita hex em arquivo de teste: nao vai para o artefato', () => {
    fixtura.escrever('packages/ui/src/marca/cor.teste.ts', `const alvo = '${HEX}';\n`);

    expect(verificar(fixtura.raiz)).toEqual([]);
  });

  test('recusa hex em outro css', () => {
    fixtura.escrever('packages/ui/src/tokens/semanticos.css', `:root { --acao: ${HEX}; }\n`);

    const violacoes = verificar(fixtura.raiz);

    expect(violacoes).toHaveLength(1);
    expect(violacoes[0]?.arquivo).toContain('semanticos.css');
  });

  test('recusa hex em literal de texto no tsx', () => {
    fixtura.escrever('apps/painel/src/Aplicacao.tsx', `export const cor = '${HEX}';\n`);

    expect(verificar(fixtura.raiz)).toHaveLength(1);
  });

  test('aceita hex citado em comentario', () => {
    fixtura.escrever(
      'apps/painel/src/nota.ts',
      `// a referencia do Figma usava ${HEX}\nexport {};\n`,
    );

    expect(verificar(fixtura.raiz)).toEqual([]);
  });

  test('ignora fragmento de url, que não é cor', () => {
    fixtura.escrever(
      'apps/painel/src/icone.ts',
      "export const alvo = 'sprite.svg#simbolo-agenda';\n",
    );

    expect(verificar(fixtura.raiz)).toEqual([]);
  });
});
