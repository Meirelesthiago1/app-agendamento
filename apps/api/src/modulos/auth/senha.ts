import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id (2.3 do stack). Os parâmetros seguem a recomendação da OWASP para
 * argon2id — 19 MiB de memória, duas iterações e um grau de paralelismo. O custo
 * de memória é o que torna o ataque por GPU caro, e é o parâmetro que não deve
 * ser reduzido para "acelerar o login".
 */
const PARAMETROS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function gerarHashDeSenha(senha: string): Promise<string> {
  return hash(senha, PARAMETROS);
}

/**
 * Devolve `false` em vez de lançar quando o hash está corrompido ou ausente: um
 * usuário só de Google tem `senha_hash` nulo, e isso é estado esperado, não erro
 * (8.3).
 */
export async function senhaConfere(senha: string, hashArmazenado: string | null): Promise<boolean> {
  if (hashArmazenado === null) {
    return false;
  }

  try {
    return await verify(hashArmazenado, senha, PARAMETROS);
  } catch {
    return false;
  }
}
