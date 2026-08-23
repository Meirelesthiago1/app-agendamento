import { CabecalhoTela, Cartao } from '@agendamento/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useSessao } from '../../lib/sessao.ts';

export const Route = createFileRoute('/_protegido/agenda')({ component: TelaDaAgenda });

function TelaDaAgenda() {
  const { data: sessao } = useSessao();

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoTela titulo="Agenda" subtitulo={`Olá, ${sessao?.nome ?? ''}`} />

      <Cartao>
        <p className="text-sm text-conteudo-suave">
          A lista do dia e a grade semanal entram na etapa 9.
        </p>
      </Cartao>
    </div>
  );
}
