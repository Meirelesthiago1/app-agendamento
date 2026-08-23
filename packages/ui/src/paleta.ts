/**
 * A parte da marca que é só matemática de cor: sem React, sem DOM, sem
 * componente. Existe como ponto de entrada próprio porque a API precisa dela
 * para embutir cores nos templates de e-mail, e não deve arrastar a biblioteca
 * de componentes junto.
 */
export * from './marca/cor.ts';
export * from './marca/derivar-paleta.ts';
export * from './tokens/primitivos.ts';
