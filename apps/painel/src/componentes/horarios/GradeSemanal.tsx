import {
  aplicarErrosServidor,
  type GradeDoProfissional,
  gradeSemanal,
} from '@agendamento/contratos';
import {
  Aviso,
  Botao,
  BotaoIcone,
  Campo,
  Cartao,
  EntradaHora,
  horaDeMinutos,
  IconeMais,
  IconeRemover,
  minutosDeHora,
} from '@agendamento/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useDefinirGrade } from '../../lib/horarios.ts';

/** 0 = domingo, como a coluna guarda (8.5). */
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;

const FAIXA_PADRAO = { horaInicio: '09:00', horaFim: '18:00' };

/**
 * Agrupada por dia, e não por faixa. Duas razões:
 *
 * A aritmética — com o seletor de dia em cada linha, a faixa pedia 392px numa
 * tela de 358px úteis, quebrava em três linhas e não sobrava separação entre uma
 * faixa e a seguinte. Sem ele, a linha cabe inteira.
 *
 * E o modelo mental: "segunda, 08–12 e 13–18" é como o gestor pensa. A lista
 * plana era a estrutura da tabela vazando para a tela.
 *
 * **O contrato não muda.** `useFieldArray` continua sobre a lista plana, e o
 * agrupamento é só de renderização — os caminhos de erro seguem
 * `faixas.<índice global>`, então a recusa de sobreposição do contrato continua
 * acendendo a linha certa. `fields[i].diaSemana` é o instantâneo do valor
 * padrão, o que normalmente é armadilha do react-hook-form; aqui é seguro
 * porque o dia deixou de ser editável e só muda em `append` ou `remove`, que
 * remontam `fields`.
 */
export function GradeSemanalDoProfissional({ grade }: { grade: GradeDoProfissional }) {
  const salvar = useDefinirGrade();

  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(gradeSemanal),
    values: { faixas: grade.faixas },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'faixas' });

  const enviar = handleSubmit(async (valores) => {
    try {
      const salvas = await salvar.mutateAsync({
        profissionalId: grade.profissionalId,
        corpo: valores,
      });

      const atualizada = salvas.grades.find((g) => g.profissionalId === grade.profissionalId);

      reset({ faixas: atualizada?.faixas ?? [] });
    } catch (erro) {
      if (!aplicarErrosServidor(erro, setError as never)) {
        setError('root', { message: 'Não foi possível salvar. Tente de novo.' });
      }
    }
  });

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      {errors.root?.message !== undefined ? (
        <Aviso tom="negativo" titulo="Não foi possível salvar">
          {errors.root.message}
        </Aviso>
      ) : null}

      <Cartao className="flex flex-col divide-y divide-borda p-0">
        {DIAS.map((nomeDoDia, diaSemana) => {
          // Preserva o índice global: é ele que o caminho do erro usa
          const doDia = fields
            .map((campo, indice) => ({ campo, indice }))
            .filter(({ campo }) => campo.diaSemana === diaSemana);

          return (
            <section key={nomeDoDia} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <h3 className="flex-1 text-sm font-medium text-conteudo">{nomeDoDia}</h3>

                {doDia.length === 0 ? (
                  <span className="text-xs text-conteudo-tenue">não atende</span>
                ) : null}

                <BotaoIcone
                  rotulo={`Adicionar intervalo na ${nomeDoDia.toLowerCase()}`}
                  variante="contorno"
                  tamanho="pequeno"
                  onClick={() => append({ diaSemana, ...FAIXA_PADRAO })}
                >
                  <IconeMais aria-hidden className="size-4" />
                </BotaoIcone>
              </div>

              {doDia.map(({ campo, indice }) => (
                <div key={campo.id} className="flex items-end gap-2">
                  <Campo
                    rotulo={`Início do intervalo ${indice + 1}`}
                    rotuloOculto
                    className="w-24"
                    erro={errors.faixas?.[indice]?.horaInicio?.message}
                  >
                    {(ligacao) => (
                      <Controller
                        control={control}
                        name={`faixas.${indice}.horaInicio`}
                        render={({ field }) => (
                          <EntradaHora
                            {...ligacao}
                            value={minutosDeHora(field.value)}
                            onChange={(minutos) =>
                              field.onChange(minutos === null ? '' : horaDeMinutos(minutos))
                            }
                            onBlur={field.onBlur}
                          />
                        )}
                      />
                    )}
                  </Campo>

                  <span className="pb-2 text-xs text-conteudo-suave">às</span>

                  <Campo
                    rotulo={`Fim do intervalo ${indice + 1}`}
                    rotuloOculto
                    className="w-24"
                    erro={errors.faixas?.[indice]?.horaFim?.message}
                  >
                    {(ligacao) => (
                      <Controller
                        control={control}
                        name={`faixas.${indice}.horaFim`}
                        render={({ field }) => (
                          <EntradaHora
                            {...ligacao}
                            value={minutosDeHora(field.value)}
                            onChange={(minutos) =>
                              field.onChange(minutos === null ? '' : horaDeMinutos(minutos))
                            }
                            onBlur={field.onBlur}
                          />
                        )}
                      />
                    )}
                  </Campo>

                  <BotaoIcone
                    rotulo={`Remover o intervalo ${indice + 1}`}
                    variante="fantasma"
                    onClick={() => remove(indice)}
                  >
                    <IconeRemover aria-hidden className="size-4" />
                  </BotaoIcone>
                </div>
              ))}
            </section>
          );
        })}
      </Cartao>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-conteudo-suave">
          {grade.vigenciaInicio === null
            ? 'Ainda sem horário.'
            : 'Alterações valem a partir de hoje. A agenda passada continua com o horário que valia nela.'}
        </p>

        <Botao type="submit" carregando={salvar.isPending} disabled={!isDirty}>
          Salvar
        </Botao>
      </div>
    </form>
  );
}
