/**
 * As cinco dependências externas da seção 3 do stack, declaradas aqui e
 * implementadas em `apps/api/src/infra/`. Nenhum SDK de plataforma cruza esta
 * fronteira (T26) — é o que torna a decisão de hospedagem reversível.
 */

export type EnderecoEmail = string;

export type Anexo = {
  nome: string;
  tipo: string;
  conteudo: Uint8Array;
};

export type Mensagem = {
  para: EnderecoEmail;
  assunto: string;
  html: string;
  texto: string;
  anexos?: readonly Anexo[];
};

export type EnviadorEmail = {
  enviar(mensagem: Mensagem): Promise<void>;
};

export type CanalDeEntregaOtp = 'SMS' | 'WHATSAPP' | 'LOG';

/**
 * A lógica de OTP é independente do canal (decisão 30). A implementação `LOG`
 * não pode existir no artefato de produção — 10.4 e a seção 8.2 da operação.
 */
export type CanalOtp = {
  readonly canal: CanalDeEntregaOtp;
  enviarCodigo(destino: string, codigo: string): Promise<void>;
};

export type Cache = {
  ler<T>(chave: string): Promise<T | null>;
  gravar<T>(chave: string, valor: T, ttlSegundos: number): Promise<void>;
  invalidarPrefixo(prefixo: string): Promise<void>;
};

export type ResultadoDoLimite = {
  permitido: boolean;
  restantes: number;
  liberaEm: Date;
};

export type LimitadorTaxa = {
  consumir(chave: string, limite: number, janelaSegundos: number): Promise<ResultadoDoLimite>;
};

export type ArquivoGuardado = {
  chave: string;
  url: string;
  tamanhoBytes: number;
};

export type Armazenamento = {
  guardar(chave: string, conteudo: Uint8Array, tipo: string): Promise<ArquivoGuardado>;
  remover(chave: string): Promise<void>;
  urlDe(chave: string): string;
};
