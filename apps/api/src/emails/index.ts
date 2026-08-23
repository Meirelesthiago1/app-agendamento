import type { Mensagem } from '@agendamento/dominio';
import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import {
  ConviteDeEquipe,
  type DadosDeConvite,
  type DadosDeRecuperacao,
  type DadosDeVerificacao,
  RecuperacaoDeSenha,
  VerificacaoDeEmail,
} from './transacionais.tsx';

/** Assunto com no máximo 60 caracteres, decisivo antes do 35 (3.0). */
const LIMITE_DO_ASSUNTO = 60;

export function exigirAssuntoCurto(assunto: string): string {
  if (assunto.length > LIMITE_DO_ASSUNTO) {
    throw new Error(`Assunto com ${assunto.length} caracteres; o limite é ${LIMITE_DO_ASSUNTO}`);
  }

  return assunto;
}

/**
 * A alternativa em texto puro é obrigatória (3.0). O React Email a gera, mas ela
 * precisa ser conferida: link em texto puro não é `[rótulo]`, é a URL — e é isso
 * que `plainText` produz.
 */
async function montar(para: string, assunto: string, elemento: ReactElement): Promise<Mensagem> {
  const [html, texto] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return { para, assunto: exigirAssuntoCurto(assunto), html, texto };
}

export function emailDeVerificacao(para: string, dados: DadosDeVerificacao): Promise<Mensagem> {
  return montar(para, 'Confirme seu e-mail', VerificacaoDeEmail(dados));
}

export function emailDeConvite(para: string, dados: DadosDeConvite): Promise<Mensagem> {
  // O nome de quem convida vem primeiro: é a informação que decide se a pessoa
  // abre, e precisa caber antes do corte do celular
  return montar(
    para,
    `${dados.convidadoPor} convidou você para ${dados.estabelecimento}`,
    ConviteDeEquipe(dados),
  );
}

export function emailDeRecuperacao(para: string, dados: DadosDeRecuperacao): Promise<Mensagem> {
  return montar(para, 'Redefinir sua senha', RecuperacaoDeSenha(dados));
}

export type { DadosDeConvite, DadosDeRecuperacao, DadosDeVerificacao };
