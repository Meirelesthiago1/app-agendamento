import type { CanalOtp } from '@agendamento/dominio';

/**
 * Produção na v1: `exige_otp_telefone` é inerte, e não há provedor de mensagens
 * contratado. Falhar aqui é melhor que fingir que enviou.
 */
export function criarCanalOtpInerte(): CanalOtp {
  return {
    canal: 'LOG',
    async enviarCodigo() {
      throw new Error('Nenhum canal de OTP configurado neste ambiente.');
    },
  };
}
