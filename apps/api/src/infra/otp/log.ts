import type { CanalOtp } from '@agendamento/dominio';

/**
 * 10.4 e a seção 8.2 da operação: este módulo **não pode existir no artefato de
 * produção**. A primeira camada é a importação condicional, que elimina o
 * módulo do bundle; a segunda é o `config.ts`, que recusa subir com
 * `OTP_CANAL=LOG` e `NODE_ENV=production`. A segunda existe porque a primeira
 * depende de o bundler continuar configurado certo.
 */
/** Estrutural de propósito: aceita o logger do Fastify e o do pino. */
export type Registrador = {
  warn: (dados: object, mensagem: string) => void;
};

export function criarCanalOtpDeLog(log: Registrador): CanalOtp {
  return {
    canal: 'LOG',
    async enviarCodigo(destino, codigo) {
      log.warn({ destino, codigo }, 'codigo de verificacao (canal LOG, apenas desenvolvimento)');
    },
  };
}
