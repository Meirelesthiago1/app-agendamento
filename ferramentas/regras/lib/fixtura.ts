import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export type Fixtura = {
  raiz: string;
  escrever: (caminho: string, conteudo: string) => void;
  descartar: () => void;
};

export function criarFixtura(prefixo: string): Fixtura {
  const raiz = mkdtempSync(join(tmpdir(), `${prefixo}-`));

  return {
    raiz,
    escrever(caminho, conteudo) {
      const destino = join(raiz, caminho);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, conteudo, 'utf8');
    },
    descartar() {
      rmSync(raiz, { recursive: true, force: true });
    },
  };
}
