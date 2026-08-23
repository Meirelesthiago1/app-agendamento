/**
 * Lista fechada. `contratos` a transforma no enum Zod de 6.10 do stack, e é o que
 * faz um código inexistente falhar em tempo de compilação nas três aplicações.
 * Um lugar só traduz para HTTP.
 */
export const CODIGOS_ERRO = [
  // Agenda e disponibilidade
  'SLOT_OCUPADO',
  'SLOT_INDISPONIVEL',
  'FORA_DA_JANELA',
  'ANTECEDENCIA_INSUFICIENTE',
  'PROFISSIONAL_NAO_ELEGIVEL',

  // Máquina de estados (7.2, 7.3)
  'TRANSICAO_INVALIDA',
  'GUARDA_FALHOU',
  'PRAZO_CANCELAMENTO_EXPIRADO',
  'REABERTURA_FORA_DO_PRAZO',
  'AINDA_NAO_TERMINOU',

  // Autorização (2.3, decisão 33)
  'SEM_PERMISSAO',
  'FORA_DO_ESCOPO',

  // Itens do agendamento (6.2)
  'ITENS_FORA_DO_LIMITE',
  'MULTIPLOS_SERVICOS_DESABILITADO',

  // Cliente (8.3.1)
  'CLIENTE_BLOQUEADO',
  'LIMITE_DE_ATIVOS_ATINGIDO',

  // Genéricos
  'NAO_ENCONTRADO',
  'DADOS_INVALIDOS',
  'CONFLITO',
] as const;

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
