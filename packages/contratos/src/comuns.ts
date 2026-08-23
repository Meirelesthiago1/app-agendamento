import { z } from 'zod';

export const uuid = z.uuid();

/** Data civil do estabelecimento, `AAAA-MM-DD` (8.7). */
export const dataLocal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD');

export const horaLocal = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'use o formato HH:MM');

/**
 * `app`, `auth`, `api` e `envio` são endereços do próprio sistema, e um tenant
 * com um desses slugs sequestraria o subdomínio (8.3 do stack).
 */
export const SLUGS_RESERVADOS = [
  'app',
  'api',
  'auth',
  'envio',
  'www',
  'admin',
  'painel',
  'static',
  'assets',
  'cdn',
  'mail',
  'suporte',
] as const;

export const slug = z
  .string()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use apenas letras minúsculas, números e hífen')
  .refine((valor) => !SLUGS_RESERVADOS.includes(valor as (typeof SLUGS_RESERVADOS)[number]), {
    message: 'este endereço é reservado pelo sistema',
  });

/** Lista separada por vírgula, como o deep link `?servicos=corte,barba` (5.1). */
export const listaDeUuids = z
  .string()
  .transform((valor) => valor.split(',').filter((parte) => parte.length > 0))
  .pipe(z.array(uuid).min(1).max(5));

export const paginacao = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

export type Paginacao = z.infer<typeof paginacao>;
