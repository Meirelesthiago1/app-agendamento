import { Text } from '@react-email/components';
import { BotaoDoEmail, estiloDoEmail, LayoutDoEmail } from './base.tsx';

export type DadosDeConvite = {
  convidadoPor: string;
  estabelecimento: string;
  papelPorExtenso: string;
  telefonePublico: string | null;
  corTema: string | null;
  link: string;
};

/**
 * 7 dias. Diz o papel — quem recebe precisa saber o que está aceitando (seção 4).
 */
export function ConviteDeEquipe({
  convidadoPor,
  estabelecimento,
  papelPorExtenso,
  telefonePublico,
  corTema,
  link,
}: DadosDeConvite) {
  const estilo = estiloDoEmail(corTema);

  return (
    <LayoutDoEmail
      preheader={`${convidadoPor} convidou você como ${papelPorExtenso}.`}
      titulo={`Convite para ${estabelecimento}`}
      corTema={corTema}
      nomeDoEstabelecimento={estabelecimento}
      telefonePublico={telefonePublico}
    >
      <Text style={estilo.texto}>
        {convidadoPor} convidou você para participar de {estabelecimento} como {papelPorExtenso}.
      </Text>

      <BotaoDoEmail href={link} corTema={corTema}>
        Aceitar convite
      </BotaoDoEmail>

      <Text style={estilo.apoio}>Este convite vale por sete dias.</Text>
    </LayoutDoEmail>
  );
}

export type DadosDeRecuperacao = {
  link: string;
};

/**
 * 1 h. O fecho não é enfeite: sem ele, um e-mail de redefinição que a pessoa
 * não pediu assusta (seção 4).
 */
export function RecuperacaoDeSenha({ link }: DadosDeRecuperacao) {
  const estilo = estiloDoEmail(null);

  return (
    <LayoutDoEmail preheader="Link para redefinir sua senha." titulo="Redefinir sua senha">
      <Text style={estilo.texto}>Use o botão abaixo para escolher uma senha nova.</Text>

      <BotaoDoEmail href={link}>Redefinir senha</BotaoDoEmail>

      <Text style={estilo.apoio}>Este link vale por uma hora.</Text>
      <Text style={estilo.apoio}>
        Se não foi você, ignore este e-mail — sua senha continua a mesma.
      </Text>
    </LayoutDoEmail>
  );
}
