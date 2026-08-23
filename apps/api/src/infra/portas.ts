import type {
  Armazenamento,
  Cache,
  CanalOtp,
  EnviadorEmail,
  LimitadorTaxa,
} from '@agendamento/dominio';
import type { Config } from '../config.ts';
import { criarArmazenamentoEmDisco } from './armazenamento/disco.ts';
import { criarCacheEmMemoria } from './cache/memoria.ts';
import { criarEnviadorSmtp } from './email/smtp.ts';
import type { Registrador } from './otp/log.ts';
import { criarCanalOtpInerte } from './otp/nenhum.ts';

export type Portas = {
  email: EnviadorEmail;
  otp: CanalOtp;
  cache: Cache;
  limitador: LimitadorTaxa;
  armazenamento: Armazenamento;
};

/**
 * A importação do canal `LOG` é dinâmica de propósito: é o que permite ao
 * bundler eliminá-lo do artefato de produção (8.2 da operação). O `config.ts`
 * já recusa subir com `OTP_CANAL=LOG` em produção, então este caminho nunca é
 * alcançado lá — as duas camadas se cobrem.
 */
async function escolherCanalOtp(config: Config, log: Registrador): Promise<CanalOtp> {
  if (config.OTP_CANAL === 'LOG' && config.NODE_ENV !== 'production') {
    const { criarCanalOtpDeLog } = await import('./otp/log.ts');

    return criarCanalOtpDeLog(log);
  }

  return criarCanalOtpInerte();
}

export async function criarPortas(
  config: Config,
  log: Registrador,
  limitador: LimitadorTaxa,
): Promise<Portas> {
  return {
    email: criarEnviadorSmtp(config),
    otp: await escolherCanalOtp(config, log),
    cache: criarCacheEmMemoria(),
    limitador,
    armazenamento: criarArmazenamentoEmDisco(
      config.ARMAZENAMENTO_DIRETORIO ?? './.dados/armazenamento',
      `${config.API_URL.replace(/\/$/, '')}/arquivos`,
    ),
  };
}
