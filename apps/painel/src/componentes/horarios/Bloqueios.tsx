import type { GradeDoProfissional } from '@agendamento/contratos';
import {
  Alternancia,
  Aviso,
  Botao,
  BotaoIcone,
  Campo,
  Cartao,
  Entrada,
  EntradaHora,
  IconeCalendarioVazio,
  IconeRemover,
  ListaVazia,
  Selecao,
  Selo,
} from '@agendamento/ui';
import { useState } from 'react';
import { useCriarExcecao, useExcecoes, useRemoverExcecao } from '../../lib/horarios.ts';

const TODOS = 'todos';

function hojeLocal(): string {
  return new Date().toISOString().slice(0, 10);
}

function daquiA(dias: number): string {
  const data = new Date();

  data.setDate(data.getDate() + dias);

  return data.toISOString().slice(0, 10);
}

/**
 * O instante enviado é montado a partir da data civil e da hora local **no fuso
 * do navegador**, que é o de quem está operando o painel. O servidor guarda o
 * instante absoluto; a conversão de volta usa o fuso do estabelecimento.
 */
function comoInstante(data: string, minutos: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const quando = new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1, 0, minutos, 0, 0);

  return quando.toISOString();
}

function formatarPeriodo(iniciaEm: string, terminaEm: string, diaInteiro: boolean): string {
  const inicio = new Date(iniciaEm);
  const fim = new Date(terminaEm);
  const dia = inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  if (diaInteiro) {
    return `${dia} · dia inteiro`;
  }

  const hora = (quando: Date) =>
    quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return `${dia} · ${hora(inicio)} às ${hora(fim)}`;
}

export function Bloqueios({ grades }: { grades: readonly GradeDoProfissional[] }) {
  const de = hojeLocal();
  const ate = daquiA(90);

  const { data, isPending } = useExcecoes(de, ate);
  const criar = useCriarExcecao();
  const remover = useRemoverExcecao();

  const [alvo, definirAlvo] = useState(TODOS);
  const [tipo, definirTipo] = useState<'BLOQUEIO' | 'EXTRA'>('BLOQUEIO');
  const [dia, definirDia] = useState(hojeLocal());
  const [diaInteiro, definirDiaInteiro] = useState(true);
  const [inicio, definirInicio] = useState<number | null>(9 * 60);
  const [fim, definirFim] = useState<number | null>(18 * 60);
  const [motivo, definirMotivo] = useState('');
  const [erro, definirErro] = useState<string | null>(null);

  async function adicionar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();
    definirErro(null);

    if (!diaInteiro && (inicio === null || fim === null)) {
      definirErro('Informe o horário de início e de fim.');
      return;
    }

    try {
      await criar.mutateAsync({
        profissionalId: alvo === TODOS ? null : alvo,
        tipo,
        iniciaEm: comoInstante(dia, diaInteiro ? 0 : (inicio ?? 0)),
        terminaEm: comoInstante(dia, diaInteiro ? 24 * 60 - 1 : (fim ?? 0)),
        diaInteiro,
        motivo: motivo.trim() === '' ? null : motivo.trim(),
      });

      definirMotivo('');
    } catch {
      definirErro('Não foi possível salvar. Confira as datas e tente de novo.');
    }
  }

  const nomeDoAlvo = (profissionalId: string | null) =>
    profissionalId === null
      ? 'Todo o estabelecimento'
      : (grades.find((grade) => grade.profissionalId === profissionalId)?.nomeExibicao ?? '—');

  return (
    <div className="flex flex-col gap-4">
      <Cartao>
        <form onSubmit={adicionar} className="flex flex-col gap-4">
          {erro === null ? null : (
            <Aviso tom="negativo" titulo="Não foi possível salvar">
              {erro}
            </Aviso>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Quem">
              {(ligacao) => (
                <Selecao
                  {...ligacao}
                  value={alvo}
                  onChange={(evento) => definirAlvo(evento.target.value)}
                >
                  <option value={TODOS}>Todo o estabelecimento</option>
                  {grades.map((grade) => (
                    <option key={grade.profissionalId} value={grade.profissionalId}>
                      {grade.nomeExibicao}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>

            <Campo rotulo="O quê">
              {(ligacao) => (
                <Selecao
                  {...ligacao}
                  value={tipo}
                  onChange={(evento) =>
                    definirTipo(evento.target.value === 'EXTRA' ? 'EXTRA' : 'BLOQUEIO')
                  }
                >
                  <option value="BLOQUEIO">Bloqueio</option>
                  <option value="EXTRA">Disponibilidade extra</option>
                </Selecao>
              )}
            </Campo>

            <Campo rotulo="Dia">
              {(ligacao) => (
                <Entrada
                  {...ligacao}
                  type="date"
                  value={dia}
                  min={de}
                  onChange={(evento) => definirDia(evento.target.value)}
                />
              )}
            </Campo>
          </div>

          <div className="flex items-center gap-3">
            <Alternancia
              id="dia-inteiro"
              checked={diaInteiro}
              onCheckedChange={definirDiaInteiro}
            />
            <label htmlFor="dia-inteiro" className="text-sm text-conteudo">
              O dia inteiro
            </label>
          </div>

          {diaInteiro ? null : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Das">
                {(ligacao) => <EntradaHora {...ligacao} value={inicio} onChange={definirInicio} />}
              </Campo>

              <Campo rotulo="Às">
                {(ligacao) => <EntradaHora {...ligacao} value={fim} onChange={definirFim} />}
              </Campo>
            </div>
          )}

          <Campo rotulo="Motivo" apoio="Só você vê. Nunca aparece para quem agenda.">
            {(ligacao) => (
              <Entrada
                {...ligacao}
                value={motivo}
                maxLength={120}
                onChange={(evento) => definirMotivo(evento.target.value)}
                placeholder="Consulta médica, feriado, viagem…"
              />
            )}
          </Campo>

          <div className="flex justify-end">
            <Botao type="submit" carregando={criar.isPending}>
              {tipo === 'BLOQUEIO' ? 'Bloquear' : 'Abrir horário'}
            </Botao>
          </div>
        </form>
      </Cartao>

      {isPending ? null : (data?.excecoes.length ?? 0) === 0 ? (
        <ListaVazia
          icone={IconeCalendarioVazio}
          titulo="Nenhum bloqueio nos próximos 90 dias"
          apoio="Feriados, folgas e compromissos entram aqui e somem da agenda pública."
        />
      ) : (
        <Cartao className="flex flex-col divide-y divide-borda p-0">
          {data?.excecoes.map((excecao) => (
            <div key={excecao.id} className="flex items-center gap-3 px-4 py-3">
              <Selo tom={excecao.tipo === 'BLOQUEIO' ? 'negativo' : 'positivo'}>
                {excecao.tipo === 'BLOQUEIO' ? 'Bloqueio' : 'Extra'}
              </Selo>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-conteudo">
                  {formatarPeriodo(excecao.iniciaEm, excecao.terminaEm, excecao.diaInteiro)}
                </span>
                <span className="truncate text-xs text-conteudo-suave">
                  {nomeDoAlvo(excecao.profissionalId)}
                  {excecao.motivo === null ? '' : ` · ${excecao.motivo}`}
                </span>
              </div>

              <BotaoIcone
                rotulo="Remover"
                tamanho="pequeno"
                onClick={() => void remover.mutateAsync(excecao.id)}
              >
                <IconeRemover aria-hidden className="size-4" />
              </BotaoIcone>
            </div>
          ))}
        </Cartao>
      )}
    </div>
  );
}
