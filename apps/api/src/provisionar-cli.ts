import { slug as esquemaDeSlug, FUSOS_BRASIL } from '@agendamento/contratos';
import { ErroDominio } from '@agendamento/dominio';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { z } from 'zod';
import { carregarConfig } from './config.ts';
import { criarEnviadorSmtp } from './infra/email/smtp.ts';
import { provisionarTenant } from './modulos/estabelecimentos/provisionar.ts';

/**
 * Provisionar um tenant é operação da plataforma, não da aplicação (2.1). Fica
 * numa linha de comando porque tela de super admin é superfície que só nós
 * usaríamos — e porque a conexão precisa ser a do **dono do banco**, que ignora
 * RLS: não existe tenant ainda para abrir contexto.
 */
const argumentos = z.object({
  nome: z.string().min(2).max(120),
  slug: esquemaDeSlug,
  email: z.email(),
  responsavel: z.string().min(2).max(120),
  fuso: z.enum(FUSOS_BRASIL).default('America/Sao_Paulo'),
  segmento: z.string().max(50).nullable().default(null),
  plano: z.string().max(30).default('padrao'),
});

const USO = `
Uso: pnpm --filter @agendamento/api provisionar -- \\
       --nome "Barbearia Corte Fino" \\
       --slug corte-fino \\
       --email dono@exemplo.com \\
       --responsavel "Rui Barbosa" \\
       [--fuso America/Sao_Paulo] [--segmento barbearia] [--plano padrao]
`;

/** `--chave valor`. Bandeira sem valor vira string vazia, que o Zod recusa. */
function lerArgumentos(argv: readonly string[]): Record<string, string> {
  const lidos: Record<string, string> = {};
  // O `pnpm run -- ...` repassa o próprio `--`; sem descartá-lo ele viraria uma
  // chave de nome vazio
  const partes = argv.filter((parte) => parte !== '--');

  for (let i = 0; i < partes.length; i += 1) {
    const parte = partes[i];

    if (parte === undefined || !parte.startsWith('--')) {
      continue;
    }

    const proximo = partes[i + 1];
    const temValor = proximo !== undefined && !proximo.startsWith('--');

    lidos[parte.slice(2)] = temValor ? proximo : '';
    i += temValor ? 1 : 0;
  }

  return lidos;
}

const analisado = argumentos.safeParse(lerArgumentos(process.argv.slice(2)));

if (!analisado.success) {
  process.stderr.write(`${USO}\n`);

  for (const problema of analisado.error.issues) {
    process.stderr.write(`  ${problema.path.join('.')}: ${problema.message}\n`);
  }

  process.exit(1);
}

const config = carregarConfig();

// A conexão do dono, e não a do papel gestor: só ela pode inserir em
// `estabelecimentos`, que não tem política de inserção de propósito
const pool = new Pool({ connectionString: config.DIRETO_BANCO_URL });

try {
  const tenant = await provisionarTenant(
    { executor: drizzle(pool), config, email: criarEnviadorSmtp(config) },
    {
      nome: analisado.data.nome,
      slug: analisado.data.slug,
      fusoHorario: analisado.data.fuso,
      segmento: analisado.data.segmento,
      plano: analisado.data.plano,
      proprietario: { nome: analisado.data.responsavel, email: analisado.data.email },
    },
  );

  process.stdout.write(
    [
      `Tenant provisionado: ${tenant.slug}`,
      `  id:      ${tenant.estabelecimentoId}`,
      `  convite: ${tenant.linkDoConvite}`,
      '',
      'O convite foi enviado por e-mail. O link acima vale por sete dias e é',
      'o que define a senha do proprietário.',
      '',
    ].join('\n'),
  );
} catch (erro) {
  const mensagem = erro instanceof ErroDominio ? erro.message : String(erro);

  process.stderr.write(`Falhou: ${mensagem}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
