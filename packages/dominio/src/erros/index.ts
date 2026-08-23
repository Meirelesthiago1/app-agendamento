/**
 * Lista fechada. `contratos` a transforma no enum Zod de 6.10 do stack, e é o que
 * faz um código inexistente falhar em tempo de compilação nas três aplicações.
 */
export const CODIGOS_ERRO = ['SLOT_OCUPADO'] as const;

export type CodigoErro = (typeof CODIGOS_ERRO)[number];

/** Chaves na notação de caminho do react-hook-form: `itens.0.servicoId` (T30). */
export type CamposComErro = Record<string, string[]>;

export class ErroDominio extends Error {
  readonly codigo: CodigoErro;
  readonly campos: CamposComErro | undefined;

  constructor(codigo: CodigoErro, mensagem: string, campos?: CamposComErro) {
    super(mensagem);
    this.name = 'ErroDominio';
    this.codigo = codigo;
    this.campos = campos;
  }
}

export function eErroDominio(valor: unknown): valor is ErroDominio {
  return valor instanceof ErroDominio;
}
