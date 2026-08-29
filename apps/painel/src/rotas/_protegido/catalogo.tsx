import type { ServicoDoPainel } from '@agendamento/contratos';
import {
  Aba,
  Abas,
  Botao,
  CabecalhoTela,
  Cartao,
  Esqueleto,
  ListaDeAbas,
  PainelDaAba,
} from '@agendamento/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ControlePermissao } from '../../componentes/ControlePermissao.tsx';
import { FormularioDeServico } from '../../componentes/catalogo/FormularioDeServico.tsx';
import { GestaoDeCategorias } from '../../componentes/catalogo/GestaoDeCategorias.tsx';
import { TabelaDeServicos } from '../../componentes/catalogo/TabelaDeServicos.tsx';
import { useCatalogo } from '../../lib/catalogo.ts';

export const Route = createFileRoute('/_protegido/catalogo')({ component: TelaDoCatalogo });

function TelaDoCatalogo() {
  const { data: catalogo, isPending } = useCatalogo();
  const [emEdicao, definirEmEdicao] = useState<ServicoDoPainel | undefined>(undefined);
  const [formularioAberto, definirFormularioAberto] = useState(false);

  function abrirNovo(): void {
    definirEmEdicao(undefined);
    definirFormularioAberto(true);
  }

  function abrirEdicao(servico: ServicoDoPainel): void {
    definirEmEdicao(servico);
    definirFormularioAberto(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoTela
        titulo="Catálogo"
        subtitulo="Os serviços que aparecem na sua página de agendamento"
        acao={
          <ControlePermissao permissao="servicos.escrever">
            <Botao onClick={abrirNovo}>Novo serviço</Botao>
          </ControlePermissao>
        }
      />

      {isPending || catalogo === undefined ? (
        <Cartao className="flex flex-col gap-3">
          <Esqueleto className="h-8 w-48" />
          <Esqueleto className="h-10 w-full" />
          <Esqueleto className="h-10 w-full" />
        </Cartao>
      ) : (
        <>
          <Abas defaultValue="servicos">
            <ListaDeAbas>
              <Aba value="servicos">Serviços</Aba>
              <Aba value="categorias">Categorias</Aba>
            </ListaDeAbas>

            <PainelDaAba value="servicos">
              <Cartao className="p-0">
                <TabelaDeServicos
                  servicos={catalogo.servicos}
                  categorias={catalogo.categorias}
                  aoEditar={abrirEdicao}
                />
              </Cartao>
            </PainelDaAba>

            <PainelDaAba value="categorias">
              <GestaoDeCategorias categorias={catalogo.categorias} servicos={catalogo.servicos} />
            </PainelDaAba>
          </Abas>

          {/* Montado só quando aberto: `values` do formulário lê o serviço em
              edição uma vez, e um diálogo sempre montado carregaria o anterior */}
          {formularioAberto ? (
            <FormularioDeServico
              aberto
              aoMudarAbertura={definirFormularioAberto}
              servico={emEdicao}
              categorias={catalogo.categorias}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
