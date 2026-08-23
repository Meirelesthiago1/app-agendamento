import { derivarPaleta, NEUTROS } from '@agendamento/ui/paleta';
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';

/**
 * Os valores vêm embutidos porque cliente de e-mail não suporta custom
 * property: `var(--acao)` num Outlook simplesmente não pinta. É a razão de a API
 * importar os tokens de `packages/ui` em vez de ler o CSS.
 */
export type EstiloDoEmail = ReturnType<typeof estiloDoEmail>;

export function estiloDoEmail(corTema: string | null) {
  const paleta = derivarPaleta(corTema ?? '');

  return {
    corpo: {
      backgroundColor: NEUTROS['cinza-50'],
      fontFamily: "Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
      margin: 0,
      padding: '32px 0',
    },
    caixa: {
      backgroundColor: NEUTROS.branco,
      border: `1px solid ${NEUTROS['cinza-200']}`,
      borderRadius: '14px',
      margin: '0 auto',
      maxWidth: '480px',
      padding: '32px',
    },
    titulo: {
      color: NEUTROS['cinza-900'],
      fontSize: '20px',
      fontWeight: 600,
      lineHeight: '28px',
      margin: '0 0 16px',
    },
    texto: {
      color: NEUTROS['cinza-700'],
      fontSize: '16px',
      lineHeight: '24px',
      margin: '0 0 16px',
    },
    apoio: {
      color: NEUTROS['cinza-500'],
      fontSize: '12px',
      lineHeight: '18px',
      margin: '0 0 8px',
    },
    botao: {
      backgroundColor: paleta.acao,
      borderRadius: '10px',
      color: paleta.acaoConteudo,
      display: 'inline-block',
      fontSize: '16px',
      fontWeight: 500,
      padding: '14px 24px',
      textDecoration: 'none',
    },
    separador: {
      borderColor: NEUTROS['cinza-200'],
      margin: '24px 0',
    },
    link: { color: NEUTROS['cinza-500'], fontSize: '12px', wordBreak: 'break-all' as const },
  };
}

export type PropsDoLayout = {
  /** Vazio, o cliente de e-mail exibe o começo do HTML (3.0). */
  preheader: string;
  titulo: string;
  corTema?: string | null;
  nomeDoEstabelecimento?: string | null;
  telefonePublico?: string | null;
  children: ReactNode;
};

/**
 * Um CTA por e-mail (3.0): dois botões competem e nenhum é clicado. Por isso o
 * layout aceita um `acao` só, e o link cru aparece embaixo — para quem lê em
 * cliente que bloqueia botão.
 */
export function LayoutDoEmail({
  preheader,
  titulo,
  corTema = null,
  nomeDoEstabelecimento,
  telefonePublico,
  children,
}: PropsDoLayout) {
  const estilo = estiloDoEmail(corTema);

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preheader}</Preview>
      <Body style={estilo.corpo}>
        <Container style={estilo.caixa}>
          <Text style={estilo.titulo}>{titulo}</Text>
          {children}

          {nomeDoEstabelecimento !== undefined && nomeDoEstabelecimento !== null ? (
            <>
              <Hr style={estilo.separador} />
              <Section>
                <Text style={estilo.apoio}>{nomeDoEstabelecimento}</Text>
                {telefonePublico !== undefined && telefonePublico !== null ? (
                  <Text style={estilo.apoio}>{telefonePublico}</Text>
                ) : null}
              </Section>
            </>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}

export function BotaoDoEmail({
  href,
  corTema,
  children,
}: {
  href: string;
  corTema?: string | null;
  children: ReactNode;
}) {
  const estilo = estiloDoEmail(corTema ?? null);

  return (
    <>
      <Section style={{ margin: '8px 0 24px' }}>
        <Button href={href} style={estilo.botao}>
          {children}
        </Button>
      </Section>
      <Text style={estilo.apoio}>
        Se o botão não funcionar, abra este endereço:
        <br />
        <Link href={href} style={estilo.link}>
          {href}
        </Link>
      </Text>
    </>
  );
}
