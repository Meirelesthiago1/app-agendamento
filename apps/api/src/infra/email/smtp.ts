import type { EnviadorEmail } from '@agendamento/dominio';
import { createTransport } from 'nodemailer';
import type { Config } from '../../config.ts';

/**
 * Mailpit em desenvolvimento (T21): SMTP falso com interface web, que torna o
 * e-mail de `token_gestao` visível e testável sem contratar nada. A escolha do
 * provedor real fica atrás desta porta, sem bloquear implementação.
 */
export function criarEnviadorSmtp(config: Config): EnviadorEmail {
  const transporte = createTransport({
    host: config.EMAIL_SMTP_HOST,
    port: config.EMAIL_SMTP_PORTA,
    // Mailpit não usa TLS; em produção o provedor real entra por outra porta
    secure: false,
    ignoreTLS: config.NODE_ENV !== 'production',
  });

  return {
    async enviar(mensagem) {
      await transporte.sendMail({
        from: config.EMAIL_REMETENTE,
        to: mensagem.para,
        subject: mensagem.assunto,
        text: mensagem.texto,
        html: mensagem.html,
        attachments: mensagem.anexos?.map((anexo) => ({
          filename: anexo.nome,
          contentType: anexo.tipo,
          content: Buffer.from(anexo.conteudo),
        })),
      });
    },
  };
}
