import {
  Aba,
  Abas,
  CabecalhoTela,
  Cartao,
  Esqueleto,
  ListaDeAbas,
  PainelDaAba,
} from '@agendamento/ui';
import { createFileRoute } from '@tanstack/react-router';
import { FormularioDaMarca } from '../../componentes/configuracoes/FormularioDaMarca.tsx';
import { FormularioDasPoliticas } from '../../componentes/configuracoes/FormularioDasPoliticas.tsx';
import { useConfiguracao } from '../../lib/configuracao.ts';

export const Route = createFileRoute('/_protegido/configuracoes')({
  component: TelaDeConfiguracoes,
});

function TelaDeConfiguracoes() {
  const { data: configuracao, isPending } = useConfiguracao();

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoTela
        titulo="Configurações"
        subtitulo="Como o estabelecimento aparece e como a agenda se comporta"
      />

      {isPending || configuracao === undefined ? (
        <Cartao className="flex flex-col gap-3">
          <Esqueleto className="h-8 w-48" />
          <Esqueleto className="h-10 w-full" />
          <Esqueleto className="h-10 w-full" />
        </Cartao>
      ) : (
        <Abas defaultValue="estabelecimento">
          <ListaDeAbas>
            <Aba value="estabelecimento">Estabelecimento</Aba>
            <Aba value="politicas">Agendamento</Aba>
          </ListaDeAbas>

          <PainelDaAba value="estabelecimento">
            <FormularioDaMarca dados={configuracao.estabelecimento} />
          </PainelDaAba>

          <PainelDaAba value="politicas">
            <FormularioDasPoliticas politicas={configuracao.politicas} />
          </PainelDaAba>
        </Abas>
      )}
    </div>
  );
}
