import { eErroDaApi, type MembroDaEquipe } from '@agendamento/contratos';
import {
  Aba,
  Abas,
  Avatar,
  Botao,
  BotaoIcone,
  CabecalhoDaTabela,
  CabecalhoTela,
  Cartao,
  Celula,
  Coluna,
  Confirmacao,
  ConteudoDoMenu,
  CorpoDaTabela,
  Esqueleto,
  GatilhoDoMenu,
  IconeReticencias,
  ItemDoMenu,
  LinhaDaTabela,
  ListaDeAbas,
  MenuSuspenso,
  PainelDaAba,
  Selo,
  SeparadorDoMenu,
  Tabela,
} from '@agendamento/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ControlePermissao } from '../../componentes/ControlePermissao.tsx';
import { FormularioDeProfissional } from '../../componentes/equipe/FormularioDeProfissional.tsx';
import { ServicosDoProfissional } from '../../componentes/equipe/ServicosDoProfissional.tsx';
import { useCatalogo } from '../../lib/catalogo.ts';
import { useDefinirProfissionalAtivo, useEquipe } from '../../lib/equipe.ts';

export const Route = createFileRoute('/_protegido/equipe')({ component: TelaDaEquipe });

const ROTULO_DO_PAPEL: Record<string, string> = {
  PROPRIETARIO: 'Proprietário',
  ADMIN: 'Admin',
  FUNCIONARIO: 'Funcionário',
};

const TOM_DO_STATUS = {
  ATIVO: 'positivo',
  CONVIDADO: 'atencao',
  DESATIVADO: 'neutro',
} as const;

const ROTULO_DO_STATUS: Record<string, string> = {
  ATIVO: 'Ativo',
  CONVIDADO: 'Convite enviado',
  DESATIVADO: 'Desativado',
};

function TelaDaEquipe() {
  const { data: equipe, isPending } = useEquipe();
  const { data: catalogo } = useCatalogo();
  const definirAtivo = useDefinirProfissionalAtivo();

  const [emEdicao, definirEmEdicao] = useState<MembroDaEquipe | undefined>(undefined);
  const [formularioAberto, definirFormularioAberto] = useState(false);
  const [servicosDe, definirServicosDe] = useState<MembroDaEquipe | null>(null);
  const [aDesativar, definirADesativar] = useState<MembroDaEquipe | null>(null);
  const [bloqueio, definirBloqueio] = useState<string | null>(null);

  async function desativar(membro: MembroDaEquipe): Promise<void> {
    try {
      await definirAtivo.mutateAsync({ id: membro.id, ativo: false });
      definirADesativar(null);
    } catch (erro) {
      definirBloqueio(
        eErroDaApi(erro) ? erro.message : 'Não foi possível desativar. Tente de novo.',
      );
      definirADesativar(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoTela
        titulo="Equipe"
        subtitulo="Quem atende, e quem tem acesso ao painel"
        acao={
          <ControlePermissao permissao="profissionais.escrever">
            <Botao
              onClick={() => {
                definirEmEdicao(undefined);
                definirFormularioAberto(true);
              }}
            >
              Nova pessoa
            </Botao>
          </ControlePermissao>
        }
      />

      {isPending || equipe === undefined ? (
        <Cartao className="flex flex-col gap-3">
          <Esqueleto className="h-8 w-48" />
          <Esqueleto className="h-10 w-full" />
        </Cartao>
      ) : (
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
              titulo={`Desativar ${aDesativar.nomeExibicao}?`}
              descricao="Esta pessoa deixa de receber agendamentos e sai da sua página pública. O histórico continua intacto."
              rotuloConfirmar="Desativar"
              destrutiva
              carregando={definirAtivo.isPending}
              aoConfirmar={() => void desativar(aDesativar)}
            />
          )}

          <Abas defaultValue="profissionais">
            <ListaDeAbas>
              <Aba value="profissionais">Quem atende</Aba>
              <Aba value="acessos">Acesso ao painel</Aba>
            </ListaDeAbas>

            <PainelDaAba value="profissionais">
              <Cartao className="p-0">
                <Tabela>
                  <CabecalhoDaTabela>
                    <LinhaDaTabela>
                      <Coluna>Pessoa</Coluna>
                      <Coluna numerica>Serviços</Coluna>
                      <Coluna>Acesso</Coluna>
                      <Coluna>Situação</Coluna>
                      <Coluna className="w-10">
                        <span className="sr-only">Ações</span>
                      </Coluna>
                    </LinhaDaTabela>
                  </CabecalhoDaTabela>

                  <CorpoDaTabela>
                    {equipe.profissionais.map((membro) => (
                      <LinhaDaTabela key={membro.id}>
                        <Celula>
                          <div className="flex items-center gap-2">
                            <Avatar nome={membro.nomeExibicao} tamanho="pequeno" />
                            {membro.nomeExibicao}
                          </div>
                        </Celula>

                        <Celula numerica>{membro.servicos.length}</Celula>

                        <Celula className="text-conteudo-suave">
                          {membro.vinculoId === null
                            ? 'Sem login'
                            : (equipe.acessos.find((a) => a.vinculoId === membro.vinculoId)
                                ?.email ?? '—')}
                        </Celula>

                        <Celula>
                          {membro.ativo ? (
                            <Selo tom="positivo">Ativo</Selo>
                          ) : (
                            <Selo tom="neutro">Inativo</Selo>
                          )}
                        </Celula>

                        <Celula>
                          <MenuSuspenso>
                            <GatilhoDoMenu asChild>
                              <BotaoIcone
                                rotulo={`Ações de ${membro.nomeExibicao}`}
                                tamanho="pequeno"
                              >
                                <IconeReticencias aria-hidden className="size-4" />
                              </BotaoIcone>
                            </GatilhoDoMenu>

                            <ConteudoDoMenu align="end">
                              <ItemDoMenu
                                onSelect={() => {
                                  definirEmEdicao(membro);
                                  definirFormularioAberto(true);
                                }}
                              >
                                Editar
                              </ItemDoMenu>

                              <ItemDoMenu onSelect={() => definirServicosDe(membro)}>
                                Serviços que atende
                              </ItemDoMenu>

                              <SeparadorDoMenu />

                              {membro.ativo ? (
                                <ItemDoMenu
                                  tom="negativo"
                                  onSelect={() => definirADesativar(membro)}
                                >
                                  Desativar
                                </ItemDoMenu>
                              ) : (
                                <ItemDoMenu
                                  onSelect={() =>
                                    void definirAtivo.mutateAsync({ id: membro.id, ativo: true })
                                  }
                                >
                                  Reativar
                                </ItemDoMenu>
                              )}
                            </ConteudoDoMenu>
                          </MenuSuspenso>
                        </Celula>
                      </LinhaDaTabela>
                    ))}
                  </CorpoDaTabela>
                </Tabela>
              </Cartao>
            </PainelDaAba>

            <PainelDaAba value="acessos">
              <Cartao className="p-0">
                <Tabela>
                  <CabecalhoDaTabela>
                    <LinhaDaTabela>
                      <Coluna>Pessoa</Coluna>
                      <Coluna>E-mail</Coluna>
                      <Coluna>Papel</Coluna>
                      <Coluna>Situação</Coluna>
                      <Coluna>Atende?</Coluna>
                    </LinhaDaTabela>
                  </CabecalhoDaTabela>

                  <CorpoDaTabela>
                    {equipe.acessos.map((acesso) => (
                      <LinhaDaTabela key={acesso.vinculoId}>
                        <Celula>{acesso.nome}</Celula>
                        <Celula className="text-conteudo-suave">{acesso.email}</Celula>
                        <Celula>{ROTULO_DO_PAPEL[acesso.papel] ?? acesso.papel}</Celula>

                        <Celula>
                          <Selo tom={TOM_DO_STATUS[acesso.status]}>
                            {ROTULO_DO_STATUS[acesso.status] ?? acesso.status}
                          </Selo>
                        </Celula>

                        <Celula className="text-conteudo-suave">
                          {acesso.profissionalId === null
                            ? 'Não atende'
                            : (equipe.profissionais.find((p) => p.id === acesso.profissionalId)
                                ?.nomeExibicao ?? '—')}
                        </Celula>
                      </LinhaDaTabela>
                    ))}
                  </CorpoDaTabela>
                </Tabela>
              </Cartao>
            </PainelDaAba>
          </Abas>

          {formularioAberto ? (
            <FormularioDeProfissional
              aberto
              aoMudarAbertura={definirFormularioAberto}
              membro={emEdicao}
              acessos={equipe.acessos}
            />
          ) : null}

          {servicosDe === null ? null : (
            <ServicosDoProfissional
              aberto
              aoMudarAbertura={(aberto) => {
                if (!aberto) {
                  definirServicosDe(null);
                }
              }}
              membro={servicosDe}
              servicos={catalogo?.servicos ?? []}
            />
          )}
        </>
      )}
    </div>
  );
}
