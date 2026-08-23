import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  agendamentos,
  clientes,
  configuracoes,
  estabelecimentos,
  horariosTrabalho,
  profissionais,
  profissionaisServicos,
  servicos,
  usuarios,
  vinculos,
} from './esquema/index.js';

/**
 * Identificadores fixos: o desenvolvimento local referencia os dois tenants, e a
 * semente pode ser reaplicada sobre um banco recriado sem mudar nada em volta.
 */
export const TENANT_BARBEARIA = '11111111-1111-4111-8111-111111111111';
export const TENANT_CLINICA = '22222222-2222-4222-8222-222222222222';

const FUSO = 'America/Sao_Paulo';

type Executor = ReturnType<typeof drizzle>;

type Molde = {
  id: string;
  slug: string;
  nome: string;
  segmento: string;
  janelaDias: number;
  proprietario: { nome: string; email: string };
  profissional: string;
  servico: { slug: string; nome: string; duracaoMin: number; valorCentavos: number };
  cliente: { nome: string; telefone: string; email: string };
};

const MOLDES: readonly Molde[] = [
  {
    id: TENANT_BARBEARIA,
    slug: 'corte-fino',
    nome: 'Barbearia Corte Fino',
    segmento: 'barbearia',
    janelaDias: 7,
    proprietario: { nome: 'Rui Barbosa', email: 'rui@corte-fino.teste' },
    profissional: 'Rui',
    servico: {
      slug: 'corte-masculino',
      nome: 'Corte masculino',
      duracaoMin: 30,
      valorCentavos: 5000,
    },
    cliente: { nome: 'Alex Ferreira', telefone: '11988880001', email: 'alex@cliente.teste' },
  },
  {
    id: TENANT_CLINICA,
    slug: 'bem-estar',
    nome: 'Clinica Bem Estar',
    segmento: 'nutricao',
    janelaDias: 30,
    proprietario: { nome: 'Nina Prado', email: 'nina@bem-estar.teste' },
    profissional: 'Dra. Nina Prado',
    servico: {
      slug: 'consulta-nutricional',
      nome: 'Consulta nutricional',
      duracaoMin: 60,
      valorCentavos: 18000,
    },
    cliente: { nome: 'Bruno Salles', telefone: '11988880002', email: 'bruno@cliente.teste' },
  },
];

/** Segunda a sexta, manhã e tarde — a grade com dois intervalos no mesmo dia (8.5). */
const GRADE = [
  { inicio: '08:00:00', fim: '12:00:00' },
  { inicio: '13:00:00', fim: '18:00:00' },
];

export async function semear(bd: Executor): Promise<void> {
  for (const molde of MOLDES) {
    await bd.insert(estabelecimentos).values({
      id: molde.id,
      slug: molde.slug,
      nome: molde.nome,
      segmento: molde.segmento,
      fusoHorario: FUSO,
      plano: 'gratuito',
      status: 'ATIVO',
    });

    await bd.insert(configuracoes).values({
      estabelecimentoId: molde.id,
      janelaAgendamentoDias: molde.janelaDias,
    });

    const [usuario] = await bd
      .insert(usuarios)
      .values({
        nome: molde.proprietario.nome,
        email: molde.proprietario.email,
        emailVerificadoEm: new Date(),
      })
      .returning({ id: usuarios.id });

    if (!usuario) {
      throw new Error(`Falha ao criar o usuario proprietario de ${molde.slug}`);
    }

    const [vinculo] = await bd
      .insert(vinculos)
      .values({
        usuarioId: usuario.id,
        estabelecimentoId: molde.id,
        papel: 'PROPRIETARIO',
        status: 'ATIVO',
      })
      .returning({ id: vinculos.id });

    if (!vinculo) {
      throw new Error(`Falha ao criar o vinculo de ${molde.slug}`);
    }

    // Decisão 4: o proprietário nasce como profissional
    const [profissional] = await bd
      .insert(profissionais)
      .values({
        estabelecimentoId: molde.id,
        vinculoId: vinculo.id,
        nomeExibicao: molde.profissional,
      })
      .returning({ id: profissionais.id });

    const [servico] = await bd
      .insert(servicos)
      .values({
        estabelecimentoId: molde.id,
        slug: molde.servico.slug,
        nome: molde.servico.nome,
        duracaoMin: molde.servico.duracaoMin,
        valorCentavos: molde.servico.valorCentavos,
      })
      .returning({ id: servicos.id });

    if (!profissional || !servico) {
      throw new Error(`Falha ao criar profissional ou servico de ${molde.slug}`);
    }

    await bd.insert(profissionaisServicos).values({
      estabelecimentoId: molde.id,
      profissionalId: profissional.id,
      servicoId: servico.id,
    });

    await bd.insert(horariosTrabalho).values(
      [1, 2, 3, 4, 5].flatMap((diaSemana) =>
        GRADE.map((faixa) => ({
          estabelecimentoId: molde.id,
          profissionalId: profissional.id,
          diaSemana,
          horaInicio: faixa.inicio,
          horaFim: faixa.fim,
          vigenciaInicio: '2026-01-01',
        })),
      ),
    );

    await bd.insert(clientes).values({
      estabelecimentoId: molde.id,
      nome: molde.cliente.nome,
      telefone: molde.cliente.telefone,
      email: molde.cliente.email,
    });
  }
}

export async function limpar(bd: Executor): Promise<void> {
  await bd.delete(agendamentos);
  await bd.delete(horariosTrabalho);
  await bd.delete(profissionaisServicos);
  await bd.delete(clientes);
  await bd.delete(servicos);
  await bd.delete(profissionais);
  await bd.delete(vinculos);
  await bd.delete(usuarios);
  await bd.delete(configuracoes);
  await bd.delete(estabelecimentos);
}

if (process.argv[1]?.endsWith('semente.ts') || process.argv[1]?.endsWith('semente.js')) {
  const url = process.env.DIRETO_BANCO_URL;

  if (!url) {
    process.stderr.write('DIRETO_BANCO_URL ausente.\n');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const bd = drizzle(pool);

  await limpar(bd);
  await semear(bd);
  await pool.end();

  process.stdout.write('Semente aplicada: 2 estabelecimentos.\n');
}
