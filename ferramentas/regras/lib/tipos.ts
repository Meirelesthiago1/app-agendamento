export type Violacao = {
  arquivo: string;
  linha: number;
  mensagem: string;
};

export type Regra = {
  NOME: string;
  verificar: (raiz: string) => Violacao[];
};
