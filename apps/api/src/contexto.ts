import type { Origem, Papel } from '@agendamento/dominio';
import type { Executor } from './infra/db/pools.ts';

/**
 * Primeiro parâmetro de todo caso de uso, sem exceção (T13). É verboso de
 * propósito: o caso de uso fica testável sem servidor HTTP, e o TypeScript
 * impede chamá-lo sem tenant. `AsyncLocalStorage` é permitido apenas para
 * correlacionar log — nunca para transportar tenant, que é a origem do
 * vazamento silencioso de 9.6.
 */
export type Contexto = {
  estabelecimentoId: string;
  usuarioId: string | null;
  clienteId: string | null;
  papel: Papel | null;
  profissionalId: string | null;
  origem: Origem;
  /** Escolhido pela rota: `/publico/*` usa `poolPublico` (6.8). */
  pool: Executor;
};
