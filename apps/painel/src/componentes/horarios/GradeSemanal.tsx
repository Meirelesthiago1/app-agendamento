import {
  aplicarErrosServidor,
  type FaixaDeTrabalho,
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
  Selecao,
} from '@agendamento/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useDefinirGrade } from '../../lib/horarios.ts';

/** 0 = domingo, como a coluna guarda (8.5). */
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;

const PADRAO: FaixaDeTrabalho = { diaSemana: 1, horaInicio: '09:00', horaFim: '18:00' };

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

      <Cartao className="flex flex-col gap-3">
        {fields.length === 0 ? (
          <p className="text-sm text-conteudo-suave">
            Sem horário definido — esta pessoa não recebe agendamentos.
          </p>
        ) : null}

        {fields.map((campo, indice) => (
          <div key={campo.id} className="flex flex-wrap items-end gap-2">
            <Campo
              rotulo="Dia"
              className="min-w-36 flex-1"
              erro={errors.faixas?.[indice]?.diaSemana?.message}
            >
              {(ligacao) => (
                <Controller
                  control={control}
                  name={`faixas.${indice}.diaSemana`}
                  render={({ field }) => (
                    <Selecao
                      {...ligacao}
                      value={field.value}
                      onChange={(evento) => field.onChange(Number(evento.target.value))}
                    >
                      {DIAS.map((dia, numero) => (
                        <option key={dia} value={numero}>
                          {dia}
                        </option>
                      ))}
                    </Selecao>
                  )}
                />
              )}
            </Campo>

            <Campo
              rotulo="Das"
              className="w-28"
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

            <Campo rotulo="Às" className="w-28" erro={errors.faixas?.[indice]?.horaFim?.message}>
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
              variante="contorno"
              onClick={() => remove(indice)}
              className="mb-0.5"
            >
              <IconeRemover aria-hidden className="size-4" />
            </BotaoIcone>
          </div>
        ))}

        <div>
          <Botao
            variante="contorno"
            tamanho="pequeno"
            onClick={() => append(fields.length === 0 ? PADRAO : { ...PADRAO })}
          >
            <IconeMais aria-hidden className="size-4" />
            Adicionar intervalo
          </Botao>
        </div>
      </Cartao>

      <div className="flex items-center justify-between gap-3">
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
