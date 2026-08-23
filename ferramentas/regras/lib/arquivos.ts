import { type Dirent, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

const PASTAS_IGNORADAS = new Set(['node_modules', 'dist', 'build', 'coverage']);

export function varrer(raiz: string, extensoes: readonly string[]): string[] {
  const encontrados: string[] = [];

  const descer = (pasta: string) => {
    let entradas: Dirent[];

    try {
      entradas = readdirSync(pasta, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entrada of entradas) {
      const caminho = join(pasta, entrada.name);

      if (entrada.isDirectory()) {
        if (entrada.name.startsWith('.') || PASTAS_IGNORADAS.has(entrada.name)) {
          continue;
        }
        descer(caminho);
        continue;
      }

      if (extensoes.some((extensao) => entrada.name.endsWith(extensao))) {
        encontrados.push(caminho);
      }
    }
  };

  descer(raiz);

  return encontrados.sort();
}

/** Caminho com barras para frente, para que o relato não mude entre Windows e o CI. */
export function comBarras(caminho: string): string {
  return caminho.split(sep).join('/');
}
