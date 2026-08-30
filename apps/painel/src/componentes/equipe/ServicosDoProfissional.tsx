import type { MembroDaEquipe, ServicoDoPainel } from '@agendamento/contratos';
import {
  Aviso,
  Botao,
  Caixa,
  Campo,
  Dialogo,
  EntradaMoeda,
  FechamentoDoDialogo,
  formatarDuracao,
  formatarMoeda,
  Passo,
  RaizDoDialogo,
} from '@agendamento/ui';
import { useState } from 'react';
import { useDefinirServicosDoProfissional } from '../../lib/equipe.ts';

type Marcado = {
  ligado: boolean;
  duracaoOverrideMin: number | null;
  valorOverrideCentavos: number | null;
};

function estadoInicial(
  membro: MembroDaEquipe,
  servicos: readonly ServicoDoPainel[],
): Map<string, Marcado> {
  return new Map(
    servicos.map((servico) => {
      const ligacao = membro.servicos.find((s) => s.servicoId === servico.id);

      return [
        servico.id,
        {
          ligado: ligacao !== undefined,
          duracaoOverrideMin: ligacao?.duracaoOverrideMin ?? null,
          valorOverrideCentavos: ligacao?.valorOverrideCentavos ?? null,
        },
      ];
    }),
  );
}

export type PropsDosServicosDoProfissional = {
  aberto: boolean;
  aoMudarAbertura: (aberto: boolean) => void;
  membro: MembroDaEquipe;
  servicos: readonly ServicoDoPainel[];
};

/**
 * O override existe porque a mesma coisa leva tempos e preços diferentes com
 * pessoas diferentes (8.4). Vazio significa "usa o do catálogo" — e é por isso
 * que ele é nulo, e não uma cópia do valor: mudar o preço do serviço precisa
 * alcançar quem não definiu um próprio.
 */
export function ServicosDoProfissional({
  aberto,
  aoMudarAbertura,
  membro,
  servicos,
}: PropsDosServicosDoProfissional) {
  const salvar = useDefinirServicosDoProfissional();
  const [marcados, definirMarcados] = useState(() => estadoInicial(membro, servicos));
  const [erro, definirErro] = useState<string | null>(null);

  function ajustar(servicoId: string, mudanca: Partial<Marcado>): void {
    definirMarcados((atual) => {
      const proximo = new Map(atual);
      const anterior = proximo.get(servicoId);

      if (anterior !== undefined) {
        proximo.set(servicoId, { ...anterior, ...mudanca });
      }

      return proximo;
    });
  }

  async function enviar(): Promise<void> {
    const lista = [...marcados.entries()]
      .filter(([, marcado]) => marcado.ligado)
      .map(([servicoId, marcado]) => ({
        servicoId,
        duracaoOverrideMin: marcado.duracaoOverrideMin,
        valorOverrideCentavos: marcado.valorOverrideCentavos,
      }));

    try {
      await salvar.mutateAsync({ id: membro.id, corpo: { servicos: lista } });
      aoMudarAbertura(false);
    } catch {
      definirErro('Não foi possível salvar. Tente de novo.');
    }
  }

  return (
    <RaizDoDialogo open={aberto} onOpenChange={aoMudarAbertura}>
      <Dialogo
        titulo={`O que ${membro.nomeExibicao} atende`}
        descricao="Marque os serviços. Duração e valor em branco usam os do catálogo."
        className="max-w-2xl"
        rodape={
          <>
            <FechamentoDoDialogo asChild>
              <Botao variante="contorno" disabled={salvar.isPending}>
                Cancelar
              </Botao>
            </FechamentoDoDialogo>

            <Botao carregando={salvar.isPending} onClick={() => void enviar()}>
              Salvar
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {erro === null ? null : (
            <Aviso tom="negativo" titulo="Não foi possível salvar">
              {erro}
            </Aviso>
          )}

          {servicos.length === 0 ? (
            <p className="text-sm text-conteudo-suave">
              Cadastre um serviço no catálogo antes de definir o que esta pessoa atende.
            </p>
          ) : null}

          <ul className="flex flex-col divide-y divide-borda">
            {servicos.map((servico) => {
              const marcado = marcados.get(servico.id);

              return (
                <li key={servico.id} className="flex flex-col gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <Caixa
                      id={`servico-${servico.id}`}
                      checked={marcado?.ligado ?? false}
                      onCheckedChange={(ligado) => ajustar(servico.id, { ligado: ligado === true })}
                    />

                    <label
                      htmlFor={`servico-${servico.id}`}
                      className="flex-1 text-sm text-conteudo"
                    >
                      {servico.nome}
                      <span className="ml-2 text-xs text-conteudo-suave">
                        {formatarDuracao(servico.duracaoMin)}
                        {servico.valorCentavos === null
                          ? ''
                          : ` · ${formatarMoeda(servico.valorCentavos)}`}
                      </span>
                    </label>
                  </div>

                  {marcado?.ligado === true ? (
                    <div className="grid gap-3 pl-8 sm:grid-cols-2">
                      <Campo rotulo="Duração própria">
                        {(ligacao) => (
                          <Passo
                            {...ligacao}
                            value={marcado.duracaoOverrideMin ?? servico.duracaoMin}
                            onChange={(valor) => ajustar(servico.id, { duracaoOverrideMin: valor })}
                            passo={5}
                            minimo={5}
                            maximo={600}
                            unidade="min"
                          />
                        )}
                      </Campo>

                      <Campo rotulo="Valor próprio">
                        {(ligacao) => (
                          <EntradaMoeda
                            {...ligacao}
                            value={marcado.valorOverrideCentavos}
                            onChange={(valor) =>
                              ajustar(servico.id, { valorOverrideCentavos: valor })
                            }
                          />
                        )}
                      </Campo>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </Dialogo>
    </RaizDoDialogo>
  );
}
