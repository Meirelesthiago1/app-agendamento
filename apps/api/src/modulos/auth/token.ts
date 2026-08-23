import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 bytes, como 10.7 exige do `token_gestao`. Mesma força para a sessão. */
const BYTES = 32;

export function gerarToken(): string {
  return randomBytes(BYTES).toString('base64url');
}

/**
 * Guardar o hash, nunca o token (T19). Um vazamento da tabela de sessões não
 * pode virar acesso: quem lê `sessoes` precisa ainda descobrir a pré-imagem.
 *
 * SHA-256 sem sal e sem custo é adequado **aqui** e não seria numa senha: o
 * token tem 256 bits de entropia real, então não existe dicionário para atacar.
 * Custo alto encareceria toda requisição autenticada sem comprar segurança.
 */
export function hashDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparação em tempo constante, para não vazar o prefixo por temporização. */
export function tokensConferem(um: string, outro: string): boolean {
  const a = Buffer.from(um, 'hex');
  const b = Buffer.from(outro, 'hex');

  return a.length === b.length && timingSafeEqual(a, b);
}
