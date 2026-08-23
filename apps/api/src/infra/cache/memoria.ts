import type { Cache } from '@agendamento/dominio';

type Entrada = {
  valor: unknown;
  expiraEm: number;
};

/**
 * Funciona enquanto houver **uma** instância da API. Na segunda, o cache fica
 * incoerente entre processos — a porta existe para que a troca por Redis seja de
 * uma linha, mas ela precisa preceder o escalonamento, não segui-lo (T22).
 */
export function criarCacheEmMemoria(agora: () => number = Date.now): Cache {
  const entradas = new Map<string, Entrada>();

  return {
    async ler<T>(chave: string): Promise<T | null> {
      const entrada = entradas.get(chave);

      if (entrada === undefined) {
        return null;
      }

      if (entrada.expiraEm <= agora()) {
        entradas.delete(chave);
        return null;
      }

      return entrada.valor as T;
    },

    async gravar<T>(chave: string, valor: T, ttlSegundos: number): Promise<void> {
      entradas.set(chave, { valor, expiraEm: agora() + ttlSegundos * 1000 });
    },

    async invalidarPrefixo(prefixo: string): Promise<void> {
      for (const chave of entradas.keys()) {
        if (chave.startsWith(prefixo)) {
          entradas.delete(chave);
        }
      }
    },
  };
}
