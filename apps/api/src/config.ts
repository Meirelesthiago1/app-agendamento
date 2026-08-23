import { z } from 'zod';

const urlDePostgres = z.string().regex(/^postgres(ql)?:\/\/.+/, 'deve ser uma URL postgres://');

const esquema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_NIVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    PORTA: z.coerce.number().int().positive().default(3000),

    BANCO_URL: urlDePostgres,
    BANCO_URL_PUBLICO: urlDePostgres,
    // Migração não passa pelo pooler em modo `transaction`: `CREATE INDEX CONCURRENTLY`
    // e comandos fora de transação não funcionam através dele.
    DIRETO_BANCO_URL: urlDePostgres,

    SESSAO_SEGREDO: z.string().min(32),

    APP_URL: z.url(),
    API_URL: z.url(),
    AUTH_URL: z.url(),
    PUBLICO_DOMINIO_BASE: z.string().min(1),

    EMAIL_PROVEDOR: z.enum(['SMTP', 'RESEND']),
    EMAIL_SMTP_HOST: z.string().min(1).optional(),
    EMAIL_SMTP_PORTA: z.coerce.number().int().positive().optional(),
    EMAIL_CHAVE: z.string().min(1).optional(),
    EMAIL_REMETENTE: z.email(),

    OTP_CANAL: z.enum(['LOG', 'NENHUM']),

    ARMAZENAMENTO_TIPO: z.enum(['DISCO', 'S3']),
    ARMAZENAMENTO_DIRETORIO: z.string().min(1).optional(),
    ARMAZENAMENTO_ENDPOINT: z.url().optional(),
    ARMAZENAMENTO_BUCKET: z.string().min(1).optional(),
    ARMAZENAMENTO_CHAVE_ID: z.string().min(1).optional(),
    ARMAZENAMENTO_CHAVE_SECRETA: z.string().min(1).optional(),

    SENTRY_DSN: z.url().optional(),
  })
  .superRefine((valores, contexto) => {
    const exigir = (presente: unknown, campo: string, porque: string) => {
      if (presente === undefined) {
        contexto.addIssue({ code: 'custom', path: [campo], message: `obrigatória ${porque}` });
      }
    };

    // Segunda camada da restrição de 10.4: a primeira é a eliminação do módulo `LOG`
    // do bundle de produção, e ela depende de o bundler continuar configurado certo.
    if (valores.NODE_ENV === 'production' && valores.OTP_CANAL === 'LOG') {
      contexto.addIssue({
        code: 'custom',
        path: ['OTP_CANAL'],
        message: 'o canal LOG não pode existir em produção',
      });
    }

    if (valores.EMAIL_PROVEDOR === 'SMTP') {
      exigir(valores.EMAIL_SMTP_HOST, 'EMAIL_SMTP_HOST', 'quando EMAIL_PROVEDOR=SMTP');
      exigir(valores.EMAIL_SMTP_PORTA, 'EMAIL_SMTP_PORTA', 'quando EMAIL_PROVEDOR=SMTP');
    }

    if (valores.EMAIL_PROVEDOR === 'RESEND') {
      exigir(valores.EMAIL_CHAVE, 'EMAIL_CHAVE', 'quando EMAIL_PROVEDOR=RESEND');
    }

    if (valores.ARMAZENAMENTO_TIPO === 'DISCO') {
      exigir(
        valores.ARMAZENAMENTO_DIRETORIO,
        'ARMAZENAMENTO_DIRETORIO',
        'quando ARMAZENAMENTO_TIPO=DISCO',
      );
    }

    if (valores.ARMAZENAMENTO_TIPO === 'S3') {
      exigir(
        valores.ARMAZENAMENTO_ENDPOINT,
        'ARMAZENAMENTO_ENDPOINT',
        'quando ARMAZENAMENTO_TIPO=S3',
      );
      exigir(valores.ARMAZENAMENTO_BUCKET, 'ARMAZENAMENTO_BUCKET', 'quando ARMAZENAMENTO_TIPO=S3');
      exigir(
        valores.ARMAZENAMENTO_CHAVE_ID,
        'ARMAZENAMENTO_CHAVE_ID',
        'quando ARMAZENAMENTO_TIPO=S3',
      );
      exigir(
        valores.ARMAZENAMENTO_CHAVE_SECRETA,
        'ARMAZENAMENTO_CHAVE_SECRETA',
        'quando ARMAZENAMENTO_TIPO=S3',
      );
    }
  });

export type Config = z.infer<typeof esquema>;

export class ErroDeConfiguracao extends Error {
  readonly problemas: string[];

  constructor(problemas: string[]) {
    super(`Configuracao invalida:\n${problemas.join('\n')}`);
    this.name = 'ErroDeConfiguracao';
    this.problemas = problemas;
  }
}

/** Puro: recebe a fonte e devolve ou lança. É o que torna o boot testável. */
export function lerConfig(fonte: Record<string, string | undefined>): Config {
  const resultado = esquema.safeParse(fonte);

  if (!resultado.success) {
    throw new ErroDeConfiguracao(
      resultado.error.issues.map(
        (problema) => `  ${problema.path.join('.') || '(raiz)'}: ${problema.message}`,
      ),
    );
  }

  return resultado.data;
}

/**
 * Falhar no start é melhor que falhar no primeiro cliente: variável ausente
 * impede o processo de subir, em vez de produzir falha silenciosa em produção.
 */
export function carregarConfig(): Config {
  try {
    return lerConfig(process.env);
  } catch (erro) {
    process.stderr.write(
      erro instanceof ErroDeConfiguracao ? `${erro.message}\n` : `${String(erro)}\n`,
    );
    process.exit(1);
  }
}
