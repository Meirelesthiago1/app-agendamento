import { fileURLToPath } from 'node:url';

/**
 * A pasta de migrações, resolvida a partir do módulo. Vale tanto rodando o
 * fonte quanto o `dist/`, porque em ambos ela fica um nível acima.
 */
export const CAMINHO_DAS_MIGRACOES = fileURLToPath(new URL('../migracoes', import.meta.url));
