export type Dialeto = 'ts' | 'css';

export type Especificador = {
  valor: string;
  linha: number;
};

const ESPECIFICADOR =
  /\bfrom\s*['"]([^'"\n]+)['"]|\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)|\bimport\s+['"]([^'"\n]+)['"]|\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;

/**
 * Substitui comentários por espaços, preservando comprimento e quebras de linha, para
 * que as posições continuem alinhadas com a fonte original. Com `manterLiterais` falso,
 * o interior das aspas também vira espaço — é o que impede uma frase em prosa de ser
 * lida como import. A regra de hex precisa do contrário, porque `'#ff0000'` é um
 * literal e é justamente o que ela procura.
 */
export function removerComentarios(
  fonte: string,
  dialeto: Dialeto,
  manterLiterais = false,
): string {
  const saida: string[] = [];
  let i = 0;

  while (i < fonte.length) {
    const atual = fonte.charAt(i);
    const proximo = fonte.charAt(i + 1);

    if (atual === '/' && proximo === '*') {
      saida.push('  ');
      i += 2;

      while (i < fonte.length && !(fonte.charAt(i) === '*' && fonte.charAt(i + 1) === '/')) {
        saida.push(fonte.charAt(i) === '\n' ? '\n' : ' ');
        i += 1;
      }

      if (i < fonte.length) {
        saida.push('  ');
        i += 2;
      }

      continue;
    }

    if (dialeto === 'ts' && atual === '/' && proximo === '/') {
      while (i < fonte.length && fonte.charAt(i) !== '\n') {
        saida.push(' ');
        i += 1;
      }
      continue;
    }

    if (atual === '"' || atual === "'" || atual === '`') {
      saida.push(atual);
      i += 1;

      while (i < fonte.length) {
        const caractere = fonte.charAt(i);

        if (caractere === '\\') {
          const seguinte = fonte.charAt(i + 1);
          saida.push(manterLiterais ? caractere : ' ');
          saida.push(manterLiterais || seguinte === '\n' ? seguinte : ' ');
          i += 2;
          continue;
        }

        if (caractere === atual) {
          saida.push(caractere);
          i += 1;
          break;
        }

        if (caractere === '\n') {
          saida.push('\n');
          i += 1;
          if (atual !== '`') {
            break;
          }
          continue;
        }

        saida.push(manterLiterais ? caractere : ' ');
        i += 1;
      }

      continue;
    }

    saida.push(atual);
    i += 1;
  }

  return saida.join('');
}

export function extrairEspecificadores(fonte: string): Especificador[] {
  const semLiterais = removerComentarios(fonte, 'ts');
  const encontrados: Especificador[] = [];

  for (const encontro of fonte.matchAll(ESPECIFICADOR)) {
    const valor = encontro[1] ?? encontro[2] ?? encontro[3] ?? encontro[4];

    if (valor === undefined) {
      continue;
    }

    // A ocorrência só conta se a mesma posição continua sendo código depois de
    // comentários e literais de texto virarem espaço.
    if (semLiterais.charAt(encontro.index) === ' ') {
      continue;
    }

    encontrados.push({
      valor,
      linha: fonte.slice(0, encontro.index).split('\n').length,
    });
  }

  return encontrados;
}

export function pacoteDe(especificador: string): string {
  const partes = especificador.split('/');

  if (especificador.startsWith('@')) {
    return partes.slice(0, 2).join('/');
  }

  return partes[0] ?? especificador;
}

export function eRelativo(especificador: string): boolean {
  return especificador.startsWith('.');
}
