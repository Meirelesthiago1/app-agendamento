import {
  Aba,
  Abas,
  Acordeao,
  Alternancia,
  Botao,
  BotaoIcone,
  CabecalhoDaTabela,
  Campo,
  Cartao,
  Celula,
  Coluna,
  Confirmacao,
  ConteudoDoMenu,
  CorpoDaTabela,
  EntradaHora,
  EntradaMascarada,
  EntradaMoeda,
  formatarMoeda,
  GatilhoDoMenu,
  IconeReticencias,
  ItemDoAcordeao,
  ItemDoMenu,
  LinhaDaTabela,
  ListaDeAbas,
  MenuSuspenso,
  Paginacao,
  PainelDaAba,
  Passo,
  ResumoDeValor,
  SeletorCor,
  SeparadorDoMenu,
  Tabela,
} from '@agendamento/ui';
import { type ReactNode, useState } from 'react';

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

/** As cores do playground. Em produção, quem decide a paleta é o catálogo. */
const CORES = [
  { cor: '#ef4444', nome: 'Vermelho' },
  { cor: '#f59e0b', nome: 'Ambar' },
  { cor: '#10b981', nome: 'Verde' },
  { cor: '#3b82f6', nome: 'Azul' },
  { cor: '#8b5cf6', nome: 'Violeta' },
  { cor: '#ec4899', nome: 'Rosa' },
];

const LINHAS = [
  { nome: 'Corte masculino', duracao: 30, valor: 4500 },
  { nome: 'Barba', duracao: 20, valor: 3000 },
  { nome: 'Corte + barba', duracao: 50, valor: 7000 },
];

export function Formularios() {
  const [telefone, definirTelefone] = useState('11987654321');
  const [cep, definirCep] = useState('');
  const [valor, definirValor] = useState<number | null>(4500);
  const [inicio, definirInicio] = useState<number | null>(540);
  const [fim, definirFim] = useState<number | null>(1080);
  const [granularidade, definirGranularidade] = useState(15);
  const [janela, definirJanela] = useState(14);
  const [cor, definirCor] = useState<string | null>('#3b82f6');
  const [pagina, definirPagina] = useState(1);
  const [confirmando, definirConfirmando] = useState(false);
  const [automatica, definirAutomatica] = useState(true);

  return (
    <div className="flex flex-col gap-8">
      <Secao
        titulo="Entradas com máscara"
        nota="A máscara é função pura de dígitos para texto. O que sai do componente é sempre só dígitos."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Telefone" apoio="Obrigatório no fluxo público (9.5)">
            {(ligacao) => (
              <EntradaMascarada
                {...ligacao}
                mascara="telefone"
                value={telefone}
                onChange={definirTelefone}
              />
            )}
          </Campo>

          <Campo rotulo="CEP">
            {(ligacao) => (
              <EntradaMascarada {...ligacao} mascara="cep" value={cep} onChange={definirCep} />
            )}
          </Campo>
        </div>

        <p className="text-xs text-conteudo-tenue">
          Valor cru: <span className="tabular-nums">{telefone === '' ? '—' : telefone}</span>
        </p>
      </Secao>

      <Secao
        titulo="Valor e hora"
        nota="Centavos inteiros e minutos desde a meia-noite. Nenhum ponto flutuante no caminho."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Valor" apoio="Digita da direita para a esquerda">
            {(ligacao) => <EntradaMoeda {...ligacao} value={valor} onChange={definirValor} />}
          </Campo>

          <Campo rotulo="Abre às">
            {(ligacao) => <EntradaHora {...ligacao} value={inicio} onChange={definirInicio} />}
          </Campo>

          <Campo rotulo="Fecha às">
            {(ligacao) => <EntradaHora {...ligacao} value={fim} onChange={definirFim} />}
          </Campo>
        </div>

        <p className="text-xs tabular-nums text-conteudo-tenue">
          Centavos: {valor ?? '—'} · Minutos: {inicio ?? '—'} até {fim ?? '—'}
        </p>
      </Secao>

      <Secao titulo="Passo" nota="As três configurações numéricas de 8.2, no incremento certo.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Granularidade do slot">
            {(ligacao) => (
              <Passo
                {...ligacao}
                value={granularidade}
                onChange={definirGranularidade}
                passo={5}
                minimo={5}
                maximo={120}
                unidade="min"
              />
            )}
          </Campo>

          <Campo rotulo="Janela de agendamento">
            {(ligacao) => (
              <Passo
                {...ligacao}
                value={janela}
                onChange={definirJanela}
                minimo={1}
                maximo={365}
                unidade="dias"
              />
            )}
          </Campo>
        </div>
      </Secao>

      <Secao
        titulo="Seletor de cor"
        nota="Escolha entre opções: cor livre na agenda vira texto ilegível sobre ela."
      >
        <SeletorCor value={cor} onChange={definirCor} opcoes={CORES} />
        <p className="text-xs text-conteudo-tenue">Escolhida: {cor ?? 'nenhuma'}</p>
      </Secao>

      <Secao titulo="Abas">
        <Abas defaultValue="servicos">
          <ListaDeAbas>
            <Aba value="servicos">Serviços</Aba>
            <Aba value="categorias">Categorias</Aba>
            <Aba value="inativos">Inativos</Aba>
          </ListaDeAbas>

          <PainelDaAba value="servicos">
            <p className="text-sm text-conteudo-suave">Três serviços ativos.</p>
          </PainelDaAba>
          <PainelDaAba value="categorias">
            <p className="text-sm text-conteudo-suave">Duas categorias.</p>
          </PainelDaAba>
          <PainelDaAba value="inativos">
            <p className="text-sm text-conteudo-suave">Nenhum serviço inativo.</p>
          </PainelDaAba>
        </Abas>
      </Secao>

      <Secao
        titulo="Acordeão"
        nota="Grupos de configuração: trinta campos numa lista só é ilegível."
      >
        <Acordeao type="single" collapsible defaultValue="agenda">
          <ItemDoAcordeao value="agenda" titulo="Agenda" resumo="15 min · 14 dias">
            <p className="text-sm text-conteudo-suave">
              Granularidade, antecedência mínima e janela de agendamento.
            </p>
          </ItemDoAcordeao>

          <ItemDoAcordeao value="reserva" titulo="Reserva" resumo="Automática">
            <div className="flex items-center gap-3">
              <Alternancia
                id="confirmacao-automatica"
                checked={automatica}
                onCheckedChange={definirAutomatica}
              />
              <label htmlFor="confirmacao-automatica" className="text-sm text-conteudo">
                Confirmar automaticamente
              </label>
            </div>
          </ItemDoAcordeao>

          <ItemDoAcordeao value="publico" titulo="Página pública">
            <p className="text-sm text-conteudo-suave">Telefone, endereço e cor da marca.</p>
          </ItemDoAcordeao>
        </Acordeao>
      </Secao>

      <Secao titulo="Tabela, menu e paginação">
        <Tabela>
          <CabecalhoDaTabela>
            <LinhaDaTabela>
              <Coluna ordenacao="asc" aoOrdenar={() => undefined}>
                Serviço
              </Coluna>
              <Coluna numerica>Duração</Coluna>
              <Coluna numerica>Valor</Coluna>
              <Coluna className="w-10">
                <span className="sr-only">Ações</span>
              </Coluna>
            </LinhaDaTabela>
          </CabecalhoDaTabela>

          <CorpoDaTabela>
            {LINHAS.map((linha) => (
              <LinhaDaTabela key={linha.nome}>
                <Celula>{linha.nome}</Celula>
                <Celula numerica>{linha.duracao} min</Celula>
                <Celula numerica>{formatarMoeda(linha.valor)}</Celula>
                <Celula>
                  <MenuSuspenso>
                    <GatilhoDoMenu asChild>
                      <BotaoIcone rotulo="Ações" tamanho="pequeno">
                        <IconeReticencias aria-hidden className="size-4" />
                      </BotaoIcone>
                    </GatilhoDoMenu>

                    <ConteudoDoMenu align="end">
                      <ItemDoMenu>Editar</ItemDoMenu>
                      <ItemDoMenu>Duplicar</ItemDoMenu>
                      <SeparadorDoMenu />
                      <ItemDoMenu tom="negativo" onSelect={() => definirConfirmando(true)}>
                        Desativar
                      </ItemDoMenu>
                    </ConteudoDoMenu>
                  </MenuSuspenso>
                </Celula>
              </LinhaDaTabela>
            ))}
          </CorpoDaTabela>
        </Tabela>

        <Paginacao pagina={pagina} porPagina={3} total={47} aoMudarPagina={definirPagina} />
      </Secao>

      <Secao
        titulo="Confirmação"
        nota="AlertDialog, não Dialog: estas são as ações que não têm desfazer."
      >
        <Botao variante="destrutiva" onClick={() => definirConfirmando(true)}>
          Desativar serviço
        </Botao>

        <Confirmacao
          aberta={confirmando}
          aoMudarAbertura={definirConfirmando}
          titulo="Desativar Corte masculino?"
          descricao="Ele sai do catálogo público. Agendamentos já marcados continuam valendo."
          rotuloConfirmar="Desativar"
          destrutiva
          aoConfirmar={() => definirConfirmando(false)}
        />
      </Secao>

      <Secao
        titulo="Resumo de valor"
        nota="OCULTO não vira sob consulta (C10): a linha de valor simplesmente não existe."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-2xs font-medium uppercase tracking-wide text-conteudo-tenue">
              todos com valor
            </span>
            <ResumoDeValor
              itens={[
                {
                  nome: 'Corte masculino',
                  duracaoMin: 30,
                  valor: { tipo: 'FIXO', centavos: 4500 },
                },
                { nome: 'Barba', duracaoMin: 20, valor: { tipo: 'FIXO', centavos: 3000 } },
              ]}
              total={{ tipo: 'FIXO', centavos: 7500 }}
              duracaoTotalMin={50}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-2xs font-medium uppercase tracking-wide text-conteudo-tenue">
              um item oculto contamina o total
            </span>
            <ResumoDeValor
              itens={[
                {
                  nome: 'Corte masculino',
                  duracaoMin: 30,
                  valor: { tipo: 'FIXO', centavos: 4500 },
                },
                { nome: 'Coloração', duracaoMin: 90, valor: { tipo: 'OCULTO' } },
              ]}
              total={{ tipo: 'A_PARTIR_DE', centavos: 4500 }}
              duracaoTotalMin={120}
            />
          </div>
        </div>
      </Secao>
    </div>
  );
}
