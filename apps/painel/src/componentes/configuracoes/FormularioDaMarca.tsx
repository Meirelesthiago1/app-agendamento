import {
  aplicarErrosServidor,
  type ConfiguracaoCompleta,
  dadosDoEstabelecimento,
  FUSOS_BRASIL,
} from '@agendamento/contratos';
import {
  AreaTexto,
  Aviso,
  Botao,
  Campo,
  Cartao,
  COR_PADRAO,
  Entrada,
  EntradaMascarada,
  Selecao,
  SeletorCorMarca,
} from '@agendamento/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useSalvarEstabelecimento } from '../../lib/configuracao.ts';

type Dados = ConfiguracaoCompleta['estabelecimento'];

/** `America/Sao_Paulo` para quem lê. O valor salvo continua sendo o IANA. */
function nomeDoFuso(fuso: string): string {
  return fuso.replace('America/', '').replaceAll('_', ' ');
}

/** O `<input>` não tem valor nulo: vazio na tela é `null` no contrato. */
function ouNulo(texto: string): string | null {
  const limpo = texto.trim();

  return limpo === '' ? null : limpo;
}

export function FormularioDaMarca({ dados }: { dados: Dados }) {
  const salvar = useSalvarEstabelecimento();

  const { id: _id, ...valoresIniciais } = dados;

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(dadosDoEstabelecimento),
    values: valoresIniciais,
  });

  const enviar = handleSubmit(async (valores) => {
    try {
      const salva = await salvar.mutateAsync(valores);

      reset({ ...salva.estabelecimento, id: undefined } as never);
    } catch (erro) {
      // Devolve `false` quando o erro não é de campo: aí vira o aviso do topo
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

      <Cartao className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome" obrigatorio erro={errors.nome?.message}>
            {(ligacao) => <Entrada {...ligacao} {...register('nome')} />}
          </Campo>

          <Campo
            rotulo="Endereço público"
            obrigatorio
            apoio="É o que vem depois do domínio na página de agendamento"
            erro={errors.slug?.message}
          >
            {(ligacao) => <Entrada {...ligacao} {...register('slug')} />}
          </Campo>

          <Campo rotulo="Segmento" erro={errors.segmento?.message}>
            {(ligacao) => (
              <Entrada
                {...ligacao}
                {...register('segmento', { setValueAs: ouNulo })}
                placeholder="Barbearia, clínica, estúdio…"
              />
            )}
          </Campo>

          <Campo
            rotulo="Fuso horário"
            obrigatorio
            apoio="Define a hora local de toda a agenda"
            erro={errors.fusoHorario?.message}
          >
            {(ligacao) => (
              <Selecao {...ligacao} {...register('fusoHorario')}>
                {FUSOS_BRASIL.map((fuso) => (
                  <option key={fuso} value={fuso}>
                    {nomeDoFuso(fuso)}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </div>
      </Cartao>

      <Cartao className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Telefone público" erro={errors.telefonePublico?.message}>
            {(ligacao) => (
              <Controller
                control={control}
                name="telefonePublico"
                render={({ field }) => (
                  <EntradaMascarada
                    {...ligacao}
                    mascara="telefone"
                    value={field.value ?? ''}
                    onChange={(digitos) => field.onChange(digitos === '' ? null : digitos)}
                    onBlur={field.onBlur}
                  />
                )}
              />
            )}
          </Campo>

          <Campo rotulo="Endereço" erro={errors.enderecoPublico?.message}>
            {(ligacao) => (
              <AreaTexto
                {...ligacao}
                rows={2}
                {...register('enderecoPublico', { setValueAs: ouNulo })}
              />
            )}
          </Campo>
        </div>

        {/* `SeletorCorMarca` já traz o próprio `Campo`, com a rampa derivada e o
            aviso de compressão: envolvê-lo em outro duplicaria o rótulo */}
        <Controller
          control={control}
          name="corTema"
          render={({ field }) => (
            <SeletorCorMarca
              valor={field.value ?? COR_PADRAO}
              aoMudar={(cor) => field.onChange(cor)}
            />
          )}
        />
      </Cartao>

      <div className="flex justify-end">
        <Botao type="submit" carregando={salvar.isPending} disabled={!isDirty}>
          Salvar
        </Botao>
      </div>
    </form>
  );
}
