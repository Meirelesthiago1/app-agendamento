import type { Categoria, ServicoDoPainel } from '@agendamento/contratos';
import {
  Botao,
  BotaoIcone,
  Campo,
  Cartao,
  Confirmacao,
  Entrada,
  IconeEditar,
  IconeLoja,
  IconeRemover,
  ListaVazia,
} from '@agendamento/ui';
import { useState } from 'react';
import {
  useAtualizarCategoria,
  useCriarCategoria,
  useRemoverCategoria,
} from '../../lib/catalogo.ts';

export type PropsDaGestaoDeCategorias = {
  categorias: readonly Categoria[];
  servicos: readonly ServicoDoPainel[];
};

export function GestaoDeCategorias({ categorias, servicos }: PropsDaGestaoDeCategorias) {
  const criar = useCriarCategoria();
  const atualizar = useAtualizarCategoria();
  const remover = useRemoverCategoria();

  const [nova, definirNova] = useState('');
  const [emEdicao, definirEmEdicao] = useState<{ id: string; nome: string } | null>(null);
  const [aRemover, definirARemover] = useState<Categoria | null>(null);

  const quantosServicos = (categoriaId: string) =>
    servicos.filter((servico) => servico.categoriaId === categoriaId).length;

  async function adicionar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();

    if (nova.trim().length < 2) {
      return;
    }

    await criar.mutateAsync({ nome: nova.trim(), posicao: categorias.length });
    definirNova('');
  }

  async function renomear(): Promise<void> {
    if (emEdicao === null) {
      return;
    }

    const original = categorias.find((categoria) => categoria.id === emEdicao.id);

    await atualizar.mutateAsync({
      id: emEdicao.id,
      corpo: { nome: emEdicao.nome.trim(), posicao: original?.posicao ?? null },
    });

    definirEmEdicao(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {aRemover === null ? null : (
        <Confirmacao
          aberta
          aoMudarAbertura={(aberta) => {
            if (!aberta) {
              definirARemover(null);
            }
          }}
          titulo={`Remover ${aRemover.nome}?`}
          descricao={
            quantosServicos(aRemover.id) === 0
              ? 'Nenhum serviço usa esta categoria.'
              : `Os ${quantosServicos(aRemover.id)} serviços desta categoria ficam sem categoria. Nenhum deles é removido.`
          }
          rotuloConfirmar="Remover"
          destrutiva
          carregando={remover.isPending}
          aoConfirmar={async () => {
            await remover.mutateAsync(aRemover.id);
            definirARemover(null);
          }}
        />
      )}

      <Cartao>
        <form onSubmit={adicionar} className="flex items-end gap-2">
          <Campo rotulo="Nova categoria" className="flex-1">
            {(ligacao) => (
              <Entrada
                {...ligacao}
                value={nova}
                onChange={(evento) => definirNova(evento.target.value)}
                placeholder="Cabelo, barba, estética…"
              />
            )}
          </Campo>

          <Botao type="submit" carregando={criar.isPending} disabled={nova.trim().length < 2}>
            Adicionar
          </Botao>
        </form>
      </Cartao>

      {categorias.length === 0 ? (
        <ListaVazia
          icone={IconeLoja}
          titulo="Nenhuma categoria"
          apoio="Categorias agrupam os serviços na sua página pública. São opcionais."
        />
      ) : (
        <Cartao className="flex flex-col divide-y divide-borda p-0">
          {categorias.map((categoria) => (
            <div key={categoria.id} className="flex items-center gap-3 px-4 py-3">
              {emEdicao?.id === categoria.id ? (
                <>
                  <Entrada
                    autoFocus
                    value={emEdicao.nome}
                    onChange={(evento) =>
                      definirEmEdicao({ id: categoria.id, nome: evento.target.value })
                    }
                    onKeyDown={(evento) => {
                      if (evento.key === 'Enter') {
                        void renomear();
                      }

                      if (evento.key === 'Escape') {
                        definirEmEdicao(null);
                      }
                    }}
                    className="flex-1"
                  />

                  <Botao
                    tamanho="pequeno"
                    carregando={atualizar.isPending}
                    onClick={() => void renomear()}
                  >
                    Salvar
                  </Botao>

                  <Botao
                    tamanho="pequeno"
                    variante="fantasma"
                    onClick={() => definirEmEdicao(null)}
                  >
                    Cancelar
                  </Botao>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-conteudo">{categoria.nome}</span>

                  <span className="text-xs text-conteudo-suave tabular-nums">
                    {quantosServicos(categoria.id)}
                  </span>

                  <BotaoIcone
                    rotulo={`Renomear ${categoria.nome}`}
                    tamanho="pequeno"
                    onClick={() => definirEmEdicao({ id: categoria.id, nome: categoria.nome })}
                  >
                    <IconeEditar aria-hidden className="size-4" />
                  </BotaoIcone>

                  <BotaoIcone
                    rotulo={`Remover ${categoria.nome}`}
                    tamanho="pequeno"
                    onClick={() => definirARemover(categoria)}
                  >
                    <IconeRemover aria-hidden className="size-4" />
                  </BotaoIcone>
                </>
              )}
            </div>
          ))}
        </Cartao>
      )}
    </div>
  );
}
