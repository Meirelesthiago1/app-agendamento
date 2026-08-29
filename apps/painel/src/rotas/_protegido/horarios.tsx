import {
  Aba,
  Abas,
  CabecalhoTela,
  Cartao,
  Esqueleto,
  ListaDeAbas,
  PainelDaAba,
  Selecao,
  Selo,
} from '@agendamento/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Bloqueios } from '../../componentes/horarios/Bloqueios.tsx';
import { GradeSemanalDoProfissional } from '../../componentes/horarios/GradeSemanal.tsx';
import { useHorarios } from '../../lib/horarios.ts';

export const Route = createFileRoute('/_protegido/horarios')({ component: TelaDeHorarios });

function TelaDeHorarios() {
  const { data, isPending } = useHorarios();
  const [escolhido, definirEscolhido] = useState<string | null>(null);

  const grades = data?.grades ?? [];
  const atual = grades.find((grade) => grade.profissionalId === escolhido) ?? grades[0];

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoTela
        titulo="Horários"
        subtitulo="A grade de trabalho e os bloqueios que tiram horários da agenda"
      />

      {isPending ? (
        <Cartao className="flex flex-col gap-3">
          <Esqueleto className="h-8 w-48" />
          <Esqueleto className="h-10 w-full" />
        </Cartao>
      ) : (
        <Abas defaultValue="grade">
          <ListaDeAbas>
            <Aba value="grade">Grade semanal</Aba>
            <Aba value="bloqueios">Bloqueios e extras</Aba>
          </ListaDeAbas>

          <PainelDaAba value="grade">
            <div className="flex flex-col gap-4">
              {/* Autônomo tem uma pessoa só: o seletor some em vez de oferecer
                  uma escolha entre uma opção (2.4) */}
              {grades.length > 1 ? (
                <div className="flex max-w-sm items-center gap-3">
                  <Selecao
                    aria-label="Pessoa"
                    value={atual?.profissionalId ?? ''}
                    onChange={(evento) => definirEscolhido(evento.target.value)}
                  >
                    {grades.map((grade) => (
                      <option key={grade.profissionalId} value={grade.profissionalId}>
                        {grade.nomeExibicao}
                      </option>
                    ))}
                  </Selecao>

                  {atual?.ativo === false ? <Selo tom="neutro">Inativo</Selo> : null}
                </div>
              ) : null}

              {atual === undefined ? (
                <Cartao>
                  <p className="text-sm text-conteudo-suave">
                    Cadastre alguém na equipe antes de definir horários.
                  </p>
                </Cartao>
              ) : (
                <GradeSemanalDoProfissional key={atual.profissionalId} grade={atual} />
              )}
            </div>
          </PainelDaAba>

          <PainelDaAba value="bloqueios">
            <Bloqueios grades={grades} />
          </PainelDaAba>
        </Abas>
      )}
    </div>
  );
}
