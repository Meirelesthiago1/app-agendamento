import {
  Alternancia,
  AreaTexto,
  Avatar,
  Aviso,
  Botao,
  BotaoIcone,
  CabecalhoTela,
  Caixa,
  Campo,
  Cartao,
  Dialogo,
  Entrada,
  Esqueleto,
  FechamentoDaFolha,
  FolhaInferior,
  GatilhoDaFolha,
  GatilhoDoDialogo,
  IconeEditar,
  IconeRemover,
  RaizDaFolha,
  RaizDoDialogo,
  Selecao,
  Selo,
  Separador,
} from '@agendamento/ui';
import type { ReactNode } from 'react';

const HORAS_DO_DIA = Array.from(
  { length: 14 },
  (_, indice) => `${String(8 + indice).padStart(2, '0')}:00`,
);

/** Os sete estados de 4.3. Este é o critério de pronto de um componente. */
const ESTADOS = [
  { nome: 'repouso', forcar: undefined },
  { nome: 'hover', forcar: 'hover' },
  { nome: 'foco-visivel', forcar: 'foco' },
  { nome: 'ativo', forcar: 'ativo' },
] as const;

function Secao({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold text-conteudo">{titulo}</h2>
        {nota !== undefined ? <p className="text-xs text-conteudo-suave">{nota}</p> : null}
      </div>
      <Cartao className="flex flex-col gap-5">{children}</Cartao>
    </section>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-2xs font-medium uppercase tracking-wide text-conteudo-tenue">
        {rotulo}
      </span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/**
 * Cada estado é exibido com o estilo **real** do componente: as variantes
 * redefinidas em `estilos.css` fazem `hover:`, `focus-visible:` e `active:`
 * valerem sob este marcador. Recriar os estados na demonstração produziria uma
 * cópia que diverge do original no primeiro ajuste.
 */
function PorEstado({ children }: { children: (forcar: string | undefined) => ReactNode }) {
  return (
    <div className="flex flex-wrap gap-4">
      {ESTADOS.map((estado) => (
        <div key={estado.nome} className="flex flex-col items-start gap-1.5">
          <span className="text-2xs text-conteudo-tenue">{estado.nome}</span>
          <div data-forcar={estado.forcar}>{children(estado.forcar)}</div>
        </div>
      ))}
    </div>
  );
}

export function Primitivos() {
  return (
    <>
      <CabecalhoTela
        titulo="Primitivos"
        subtitulo="Cada variante nos sete estados de 4.3. Troque densidade e tema na barra acima."
      />

      <Secao titulo="Botao" nota="Cinco variantes × sete estados">
        {(['solida', 'suave', 'contorno', 'fantasma', 'destrutiva'] as const).map((variante) => (
          <Linha key={variante} rotulo={variante}>
            <PorEstado>
              {() => (
                <Botao variante={variante}>
                  {variante === 'destrutiva' ? 'Cancelar' : 'Confirmar'}
                </Botao>
              )}
            </PorEstado>
            <div className="flex flex-col items-start gap-1.5">
              <span className="text-2xs text-conteudo-tenue">desabilitado</span>
              <Botao variante={variante} disabled>
                Confirmar
              </Botao>
            </div>
            <div className="flex flex-col items-start gap-1.5">
              <span className="text-2xs text-conteudo-tenue">carregando</span>
              <Botao variante={variante} carregando>
                Salvando
              </Botao>
            </div>
          </Linha>
        ))}

        <Separador />

        <Linha rotulo="tamanhos">
          <Botao tamanho="pequeno">Pequeno</Botao>
          <Botao tamanho="medio">Medio</Botao>
          <Botao tamanho="grande">Grande</Botao>
        </Linha>
      </Secao>

      <Secao titulo="BotaoIcone" nota="Sempre com rótulo acessível: sem ele não tem nome">
        <Linha rotulo="variantes">
          <PorEstado>
            {() => (
              <BotaoIcone rotulo="Editar">
                <IconeEditar aria-hidden className="size-4" />
              </BotaoIcone>
            )}
          </PorEstado>
          <BotaoIcone rotulo="Remover" variante="contorno">
            <IconeRemover aria-hidden className="size-4" />
          </BotaoIcone>
          <BotaoIcone rotulo="Editar" variante="solida">
            <IconeEditar aria-hidden className="size-4" />
          </BotaoIcone>
          <BotaoIcone rotulo="Editar" disabled>
            <IconeEditar aria-hidden className="size-4" />
          </BotaoIcone>
        </Linha>
      </Secao>

      <Secao
        titulo="Campo, Entrada, AreaTexto e Selecao"
        nota="A ligação de acessibilidade acontece no Campo"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome" apoio="Como aparece para o cliente" obrigatorio>
            {(ligacao) => <Entrada {...ligacao} placeholder="Barbearia Corte Fino" />}
          </Campo>

          <Campo rotulo="Slug" erro="Este endereço é reservado pelo sistema">
            {(ligacao) => <Entrada {...ligacao} defaultValue="app" />}
          </Campo>

          <Campo rotulo="Segmento">
            {(ligacao) => (
              <Selecao {...ligacao} defaultValue="barbearia">
                <option value="barbearia">Barbearia</option>
                <option value="nutricao">Nutrição</option>
              </Selecao>
            )}
          </Campo>

          <Campo rotulo="Desabilitado" apoio="Em repouso, fundo afundado">
            {(ligacao) => <Entrada {...ligacao} disabled defaultValue="Não editável" />}
          </Campo>

          <Campo rotulo="Observações" apoio="Nunca exposto ao cliente" className="sm:col-span-2">
            {(ligacao) => <AreaTexto {...ligacao} placeholder="Anotação interna" />}
          </Campo>
        </div>

        <Separador />

        <Linha rotulo="rótulo oculto — para lista repetida, onde o cabeçalho já nomeia">
          <Campo rotulo="Início do intervalo 1" rotuloOculto className="w-28">
            {(ligacao) => <Entrada {...ligacao} defaultValue="08:00" />}
          </Campo>
          <span className="text-xs text-conteudo-suave">às</span>
          <Campo rotulo="Fim do intervalo 1" rotuloOculto className="w-28">
            {(ligacao) => <Entrada {...ligacao} defaultValue="12:00" />}
          </Campo>
        </Linha>

        <Linha rotulo="foco">
          <div data-forcar="foco">
            <Entrada defaultValue="Com anel de foco" />
          </div>
          <div data-forcar="foco">
            <Entrada invalido defaultValue="Invalido com foco" />
          </div>
        </Linha>
      </Secao>

      <Secao titulo="Alternancia e Caixa" nota="As onze chaves booleanas de configuracoes">
        <Linha rotulo="alternancia">
          <Alternancia defaultChecked aria-label="Confirmação automática" />
          <Alternancia aria-label="Exige OTP" />
          <Alternancia disabled aria-label="Desabilitada" />
          <div data-forcar="foco">
            <Alternancia defaultChecked aria-label="Com foco" />
          </div>
        </Linha>

        <Linha rotulo="caixa">
          <Caixa defaultChecked aria-label="Selecionado" />
          <Caixa aria-label="Vazio" />
          <Caixa checked="indeterminate" aria-label="Parcial" />
          <Caixa disabled aria-label="Desabilitada" />
          <div data-forcar="foco">
            <Caixa defaultChecked aria-label="Com foco" />
          </div>
        </Linha>
      </Secao>

      <Secao titulo="Selo" nota="Estado nunca só por cor: todo selo carrega rótulo textual (2.2)">
        <Linha rotulo="tons">
          <Selo tom="positivo">Confirmado</Selo>
          <Selo tom="atencao">Aguardando</Selo>
          <Selo tom="negativo">Cancelado</Selo>
          <Selo tom="neutro">Bloqueio</Selo>
          <Selo tom="marca">Encaixe</Selo>
        </Linha>
      </Secao>

      <Secao titulo="Aviso" nota="Retorno de toda mutação">
        <div className="flex flex-col gap-3">
          <Aviso tom="positivo" titulo="Agendamento confirmado">
            O cliente foi notificado por e-mail.
          </Aviso>
          <Aviso tom="atencao">Este profissional tem agenda fora da grade nesta data.</Aviso>
          <Aviso tom="negativo" titulo="Não foi possível concluir">
            Esse horário acabou de ser ocupado.
          </Aviso>
          <Aviso>A janela de agendamento deste estabelecimento é de 7 dias.</Aviso>
        </div>
      </Secao>

      <Secao titulo="Cartao, Avatar, Esqueleto e Separador">
        <Linha rotulo="avatar">
          <Avatar nome="Rui Barbosa" tamanho="pequeno" />
          <Avatar nome="Nina Prado" />
          <Avatar nome="Alex Ferreira" tamanho="grande" />
        </Linha>

        <Linha rotulo="esqueleto">
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Esqueleto className="h-4 w-1/3" />
            <Esqueleto className="h-4 w-2/3" />
            <Esqueleto className="h-4 w-1/2" />
          </div>
        </Linha>

        <Linha rotulo="cartao interativo">
          <Cartao interativo tabIndex={0} className="w-64">
            <p className="font-medium text-conteudo">Corte masculino</p>
            <p className="text-sm text-conteudo-suave">30 min · R$ 50,00</p>
          </Cartao>
        </Linha>
      </Secao>

      <Secao titulo="Dialogo" nota="Foco preso e devolvido ao gatilho, entregue pelo Radix (4.5)">
        <RaizDoDialogo>
          <GatilhoDoDialogo asChild>
            <Botao variante="contorno">Abrir diálogo</Botao>
          </GatilhoDoDialogo>
          <Dialogo
            titulo="Concluir atendimento"
            descricao="O valor previsto pode ser corrigido agora."
            rodape={
              <>
                <Botao variante="fantasma">Cancelar</Botao>
                <Botao>Concluir</Botao>
              </>
            }
          >
            <Campo rotulo="Valor cobrado" apoio="Em reais">
              {(ligacao) => <Entrada {...ligacao} defaultValue="50,00" />}
            </Campo>
          </Dialogo>
        </RaizDoDialogo>
      </Secao>

      <Secao
        titulo="FolhaInferior"
        nota="Contêiner, não controle: os sete estados de 4.3 pertencem ao gatilho e às linhas. O que se confere aqui é outra coisa — as duas densidades, o corpo longo rolando dentro do miolo com cabeçalho e rodapé parados, o recuo da barra de gestos no perfil de iPhone, e o foco preso com devolução ao gatilho no Escape."
      >
        <RaizDaFolha>
          <GatilhoDaFolha asChild>
            <Botao variante="contorno">Abrir folha</Botao>
          </GatilhoDaFolha>

          <FolhaInferior
            titulo="Bloquear o dia"
            descricao="Três agendamentos serão atingidos."
            rodape={
              <div className="flex flex-col gap-2">
                <Botao variante="destrutiva" larguraTotal>
                  Cancelar todos e avisar
                </Botao>
                <FechamentoDaFolha asChild>
                  <Botao variante="fantasma" larguraTotal>
                    Resolver um a um
                  </Botao>
                </FechamentoDaFolha>
              </div>
            }
          >
            {/* Longa de propósito: é o corpo rolando que se confere aqui */}
            <ul className="flex flex-col divide-y divide-borda">
              {HORAS_DO_DIA.map((hora, indice) => (
                <li key={hora} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="text-conteudo">Atendimento {indice + 1}</span>
                  <span className="tabular-nums text-conteudo-suave">{hora}</span>
                </li>
              ))}
            </ul>
          </FolhaInferior>
        </RaizDaFolha>
      </Secao>
    </>
  );
}
