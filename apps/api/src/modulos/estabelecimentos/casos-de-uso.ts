import { ErroDominio } from '@agendamento/dominio';
import type { Contexto } from '../../contexto.ts';
import { unidadeDeTrabalho } from '../../infra/db/pools.ts';
import * as repoProfissionais from '../profissionais/repositorio.ts';
import * as repoServicos from '../servicos/repositorio.ts';
import { buscarConfiguracao, type Estabelecimento } from './repositorio.ts';

export async function obterCatalogoPublico(contexto: Contexto, estabelecimento: Estabelecimento) {
  return unidadeDeTrabalho(contexto, async (tx) => {
    const config = await buscarConfiguracao(tx, contexto.estabelecimentoId);
    const servicos = await repoServicos.listar(tx, contexto.estabelecimentoId);
    const equipe = await repoProfissionais.listarComServicos(tx, contexto.estabelecimentoId);

    if (config === null) {
      throw new ErroDominio('NAO_ENCONTRADO', 'Estabelecimento sem configuração.');
    }

    return {
      estabelecimento: {
        ...estabelecimento,
        permiteMultiplosServicos: config.permiteMultiplosServicos,
        janelaAgendamentoDias: config.janelaAgendamentoDias,
      },
      servicos,
      profissionais: equipe.map((pessoa) => ({
        id: pessoa.id,
        nomeExibicao: pessoa.nomeExibicao,
        bio: pessoa.bio,
        avatarUrl: pessoa.avatarUrl,
        servicoIds: pessoa.servicos.map((servico) => servico.servicoId),
      })),
    };
  });
}
