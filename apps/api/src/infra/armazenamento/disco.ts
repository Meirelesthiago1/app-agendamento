import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Armazenamento } from '@agendamento/dominio';

/**
 * Implementação local da porta. A troca por S3, R2 ou Blob é uma implementação
 * nova aqui dentro — nenhum SDK de plataforma cruza `infra/` (T26).
 */
export function criarArmazenamentoEmDisco(diretorio: string, urlBase: string): Armazenamento {
  const raiz = resolve(diretorio);

  const caminhoDe = (chave: string) => {
    const destino = resolve(join(raiz, chave));

    // Chave vinda de fora não pode escapar do diretório com `../`
    if (!destino.startsWith(raiz)) {
      throw new Error(`Chave de armazenamento invalida: ${chave}`);
    }

    return destino;
  };

  return {
    async guardar(chave, conteudo, _tipo) {
      const destino = caminhoDe(chave);

      await mkdir(dirname(destino), { recursive: true });
      await writeFile(destino, conteudo);

      return {
        chave,
        url: `${urlBase.replace(/\/$/, '')}/${chave}`,
        tamanhoBytes: conteudo.byteLength,
      };
    },

    async remover(chave) {
      await rm(caminhoDe(chave), { force: true });
    },

    urlDe(chave) {
      return `${urlBase.replace(/\/$/, '')}/${chave}`;
    },
  };
}
