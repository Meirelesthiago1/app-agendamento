import {
  BarraDeAcoes,
  Botao,
  BotaoIcone,
  CabecalhoTela,
  Cartao,
  type ColunaDeLista,
  ConteudoDoMenu,
  formatarDuracao,
  formatarMoeda,
  GatilhoDoMenu,
  IconeCalendarioVazio,
  IconeReticencias,
  ItemDoMenu,
  ListaOuTabela,
  ListaVazia,
  MenuSuspenso,
  ResumoDeValor,
  Selo,
  SeparadorDoMenu,
} from '@agendamento/ui';
import type { ReactNode } from 'react';

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

type Linha = {
  id: string;
  nome: string;
  categoria: string;
  duracaoMin: number;
  centavos: number;
  ativo: boolean;
};

const LINHAS: Linha[] = [
  {
    id: '1',
    nome: 'Corte masculino',
    categoria: 'Cabelo',
    duracaoMin: 30,
    centavos: 4500,
    ativo: true,
  },
  { id: '2', nome: 'Barba', categoria: 'Barba', duracaoMin: 20, centavos: 3000, ativo: true },
  {
    id: '3',
    nome: 'Coloração',
    categoria: 'Cabelo',
    duracaoMin: 90,
    centavos: 12000,
    ativo: false,
  },
];

const COLUNAS: ColunaDeLista<Linha>[] = [
  {
    chave: 'nome',
    rotulo: 'Serviço',
    principal: true,
    conteudo: (linha) => linha.nome,
  },
  {
    chave: 'categoria',
    rotulo: 'Categoria',
    // Cabe na tabela e não vale a altura no cartão
    soNaTabela: true,
    conteudo: (linha) => linha.categoria,
  },
  {
    chave: 'duracao',
    rotulo: 'Duração',
    numerica: true,
    conteudo: (linha) => formatarDuracao(linha.duracaoMin),
  },
  {
    chave: 'valor',
    rotulo: 'Valor',
    numerica: true,
    conteudo: (linha) => formatarMoeda(linha.centavos),
  },
  {
    chave: 'situacao',
    rotulo: 'Situação',
    conteudo: (linha) =>
      linha.ativo ? <Selo tom="positivo">Ativo</Selo> : <Selo tom="neutro">Inativo</Selo>,
  },
  {
    chave: 'acoes',
    rotulo: 'Ações',
    fixada: true,
    conteudo: (linha) => (
      <MenuSuspenso>
        <GatilhoDoMenu asChild>
          <BotaoIcone rotulo={`Ações de ${linha.nome}`} tamanho="pequeno">
            <IconeReticencias aria-hidden className="size-4" />
          </BotaoIcone>
        </GatilhoDoMenu>

        <ConteudoDoMenu align="end">
          <ItemDoMenu>Editar</ItemDoMenu>
          <SeparadorDoMenu />
          <ItemDoMenu tom="negativo">Desativar</ItemDoMenu>
        </ConteudoDoMenu>
      </MenuSuspenso>
    ),
  },
];

export function Padroes() {
  return (
    <div className="flex flex-col gap-8">
      <Secao
        titulo="ListaOuTabela"
        nota="Arraste a janela pelos 768px: as duas formas mostram os mesmos valores, porque saem da mesma função por coluna. Categoria é `soNaTabela` e some no cartão; Ações é `fixada` e sobe para o canto."
      >
        <Cartao className="p-0">
          <ListaOuTabela
            itens={LINHAS}
            chaveDoItem={(linha) => linha.id}
            colunas={COLUNAS}
            vazio={<ListaVazia icone={IconeCalendarioVazio} titulo="Nada aqui" />}
          />
        </Cartao>
      </Secao>

      <Secao
        titulo="ListaOuTabela sem itens"
        nota="O vazio é do chamador: o texto é conteúdo, não design (6.5)"
      >
        <Cartao className="p-0">
          <ListaOuTabela
            itens={[]}
            chaveDoItem={(linha: Linha) => linha.id}
            colunas={COLUNAS}
            vazio={
              <ListaVazia
                icone={IconeCalendarioVazio}
                titulo="Nenhum serviço ainda"
                apoio="Cadastre o primeiro para o catálogo aparecer na sua página."
                acao={<Botao variante="suave">Novo serviço</Botao>}
              />
            }
          />
        </Cartao>
      </Secao>

      <Secao titulo="CabecalhoTela" nota="Título, subtítulo e ação primária — todas as telas">
        <CabecalhoTela
          titulo="Catálogo"
          subtitulo="Os serviços que aparecem na sua página de agendamento"
          acao={<Botao>Novo serviço</Botao>}
        />
      </Secao>

      <Secao titulo="ListaVazia" nota="A receita fixa de 6.5: sem ilustração, ação só quando óbvia">
        <ListaVazia
          icone={IconeCalendarioVazio}
          titulo="Nenhum agendamento hoje"
          apoio="Quando alguém agendar pelo seu link, aparece aqui."
          acao={<Botao variante="suave">Criar agendamento</Botao>}
        />

        <ListaVazia
          icone={IconeCalendarioVazio}
          titulo="Nenhum resultado"
          apoio="Nenhum registro corresponde a esses filtros."
        />
      </Secao>

      <Secao
        titulo="ResumoDeValor"
        nota="OCULTO não vira sob consulta (C10): a linha de valor simplesmente não existe"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <ResumoDeValor
            itens={[
              { nome: 'Corte masculino', duracaoMin: 30, valor: { tipo: 'FIXO', centavos: 4500 } },
              { nome: 'Barba', duracaoMin: 20, valor: { tipo: 'FIXO', centavos: 3000 } },
            ]}
            total={{ tipo: 'FIXO', centavos: 7500 }}
            duracaoTotalMin={50}
          />

          <ResumoDeValor
            itens={[
              { nome: 'Corte masculino', duracaoMin: 30, valor: { tipo: 'FIXO', centavos: 4500 } },
              { nome: 'Coloração', duracaoMin: 90, valor: { tipo: 'OCULTO' } },
            ]}
            total={{ tipo: 'A_PARTIR_DE', centavos: 4500 }}
            duracaoTotalMin={120}
          />
        </div>
      </Secao>

      <Secao titulo="BarraDeAcoes" nota="Rodapé com a ação primária — o padrão de todo o público">
        <BarraDeAcoes className="rounded-md border border-borda">
          <div className="flex flex-col">
            <span className="text-xs text-conteudo-suave">2 serviços · 50 min</span>
            <span className="text-sm font-medium text-conteudo">{formatarMoeda(7500)}</span>
          </div>
          <Botao className="ml-auto">Continuar</Botao>
        </BarraDeAcoes>
      </Secao>
    </div>
  );
}
