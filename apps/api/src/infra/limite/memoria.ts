import type { LimitadorTaxa, ResultadoDoLimite } from '@agendamento/dominio';

type Balde = {
  usos: number;
  reiniciaEm: number;
};

/** Mesma ressalva do cache: uma instância só, ou o limite vira N vezes N (T22). */
export function criarLimitadorEmMemoria(agora: () => number = Date.now): LimitadorTaxa {
  const baldes = new Map<string, Balde>();

  return {
    async consumir(chave, limite, janelaSegundos): Promise<ResultadoDoLimite> {
      const instante = agora();
      const existente = baldes.get(chave);
      const balde =
        existente === undefined || existente.reiniciaEm <= instante
          ? { usos: 0, reiniciaEm: instante + janelaSegundos * 1000 }
          : existente;

      balde.usos += 1;
      baldes.set(chave, balde);

      return {
        permitido: balde.usos <= limite,
        restantes: Math.max(0, limite - balde.usos),
        liberaEm: new Date(balde.reiniciaEm),
      };
    },
  };
}
