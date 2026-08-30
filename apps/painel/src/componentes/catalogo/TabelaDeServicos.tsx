import { type Categoria, eErroDaApi, type ServicoDoPainel } from '@agendamento/contratos';
import {
  BotaoIcone,
  Confirmacao,
  ConteudoDoMenu,
  formatarDuracao,
  formatarMoeda,
  GatilhoDoMenu,
  IconeLoja,
  IconeReticencias,
  ItemDoMenu,
  ListaOuTabela,
  ListaVazia,
  MenuSuspenso,
  Selo,
  SeparadorDoMenu,
} from '@agendamento/ui';
import { useState } from 'react';
import { useDefinirServicoAtivo } from '../../lib/catalogo.ts';

/** `OCULTO` não vira "sob consulta" (C10): a célula fica vazia. */
function valorEmTexto(servico: ServicoDoPainel): string {
  switch (servico.exibicaoValor) {
    case 'FIXO':
      return servico.valorCentavos === null ? '—' : formatarMoeda(servico.valorCentavos);
    case 'A_PARTIR_DE':
      return servico.valorCentavos === null
        ? '—'
        : `a partir de ${formatarMoeda(servico.valorCentavos)}`;
    case 'GRATUITO':
      return 'Gratuito';
    case 'OCULTO':
      return '';
  }
}

export type PropsDaTabelaDeServicos = {
  servicos: readonly ServicoDoPainel[];
  categorias: readonly Categoria[];
  aoEditar: (servico: ServicoDoPainel) => void;
};

export function TabelaDeServicos({ servicos, categorias, aoEditar }: PropsDaTabelaDeServicos) {
  const definirAtivo = useDefinirServicoAtivo();
  const [aDesativar, definirADesativar] = useState<ServicoDoPainel | null>(null);
  const [bloqueio, definirBloqueio] = useState<string | null>(null);

  const nomeDaCategoria = (id: string | null) =>
    id === null ? '—' : (categorias.find((categoria) => categoria.id === id)?.nome ?? '—');

  async function desativar(servico: ServicoDoPainel): Promise<void> {
    try {
      await definirAtivo.mutateAsync({ id: servico.id, ativo: false });
      definirADesativar(null);
    } catch (erro) {
      // 6.3 recusa quando há agenda futura, e a mensagem do servidor diz
      // quantos agendamentos são. Trocá-la por uma genérica esconderia o motivo
      definirBloqueio(
        eErroDaApi(erro) ? erro.message : 'Não foi possível desativar. Tente de novo.',
      );
      definirADesativar(null);
    }
  }

  if (servicos.length === 0) {
    return (
      <ListaVazia
        icone={IconeLoja}
        titulo="Nenhum serviço ainda"
        apoio="Cadastre o primeiro serviço para o catálogo aparecer na sua página."
      />
    );
  }

  return (
    <>
      {bloqueio === null ? null : (
        <Confirmacao
          aberta
          aoMudarAbertura={() => definirBloqueio(null)}
          titulo="Não dá para desativar agora"
          descricao={`${bloqueio} A transferência em lote e o cancelamento com aviso ficam na tela da agenda.`}
          rotuloConfirmar="Entendi"
          rotuloCancelar="Fechar"
          aoConfirmar={() => definirBloqueio(null)}
        />
      )}

      {aDesativar === null ? null : (
        <Confirmacao
          aberta
          aoMudarAbertura={(aberta) => {
            if (!aberta) {
              definirADesativar(null);
            }
          }}
          titulo={`Desativar ${aDesativar.nome}?`}
          descricao="Ele sai da sua página pública. Agendamentos já marcados continuam valendo, e você pode reativá-lo quando quiser."
          rotuloConfirmar="Desativar"
          destrutiva
          carregando={definirAtivo.isPending}
          aoConfirmar={() => void desativar(aDesativar)}
        />
      )}

      <ListaOuTabela
        itens={servicos}
        chaveDoItem={(servico) => servico.id}
        colunas={[
          {
            chave: 'nome',
            rotulo: 'Serviço',
            principal: true,
            conteudo: (servico) => (
              <span className="flex items-center gap-2">
                {servico.cor === null ? null : (
                  <span
                    aria-hidden
                    // A cor vem do dado, em tempo de execução: não há classe
                    style={{ backgroundColor: servico.cor }}
                    className="size-2.5 shrink-0 rounded-completo"
                  />
                )}
                {servico.nome}
              </span>
            ),
          },
          {
            chave: 'categoria',
            rotulo: 'Categoria',
            // No cartão o agrupamento não vale a linha que ocuparia
            soNaTabela: true,
            conteudo: (servico) => (
              <span className="text-conteudo-suave">{nomeDaCategoria(servico.categoriaId)}</span>
            ),
          },
          {
            chave: 'duracao',
            rotulo: 'Duração',
            numerica: true,
            conteudo: (servico) => formatarDuracao(servico.duracaoMin),
          },
          {
            chave: 'valor',
            rotulo: 'Valor',
            numerica: true,
            conteudo: (servico) => valorEmTexto(servico),
          },
          {
            chave: 'situacao',
            rotulo: 'Situação',
            conteudo: (servico) =>
              servico.ativo ? <Selo tom="positivo">Ativo</Selo> : <Selo tom="neutro">Inativo</Selo>,
          },
          {
            chave: 'acoes',
            rotulo: 'Ações',
            fixada: true,
            conteudo: (servico) => (
              <MenuSuspenso>
                <GatilhoDoMenu asChild>
                  <BotaoIcone rotulo={`Ações de ${servico.nome}`} tamanho="pequeno">
                    <IconeReticencias aria-hidden className="size-4" />
                  </BotaoIcone>
                </GatilhoDoMenu>

                <ConteudoDoMenu align="end">
                  <ItemDoMenu onSelect={() => aoEditar(servico)}>Editar</ItemDoMenu>
                  <SeparadorDoMenu />

                  {servico.ativo ? (
                    <ItemDoMenu tom="negativo" onSelect={() => definirADesativar(servico)}>
                      Desativar
                    </ItemDoMenu>
                  ) : (
                    <ItemDoMenu
                      onSelect={() =>
                        void definirAtivo.mutateAsync({ id: servico.id, ativo: true })
                      }
                    >
                      Reativar
                    </ItemDoMenu>
                  )}
                </ConteudoDoMenu>
              </MenuSuspenso>
            ),
          },
        ]}
      />
    </>
  );
}
