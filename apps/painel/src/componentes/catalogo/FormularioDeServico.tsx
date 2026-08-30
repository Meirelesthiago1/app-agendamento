import {
  aplicarErrosServidor,
  type Categoria,
  type DadosDoServico,
  dadosDoServico,
  paraSlug,
  type ServicoDoPainel,
} from '@agendamento/contratos';
import {
  AreaTexto,
  Aviso,
  Botao,
  Campo,
  CORES_DE_ETIQUETA,
  Dialogo,
  Entrada,
  EntradaMoeda,
  FechamentoDoDialogo,
  Passo,
  RaizDoDialogo,
  Selecao,
  SeletorCor,
} from '@agendamento/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useAtualizarServico, useCriarServico } from '../../lib/catalogo.ts';

const MODOS: { valor: DadosDoServico['exibicaoValor']; rotulo: string; apoio: string }[] = [
  { valor: 'FIXO', rotulo: 'Valor fixo', apoio: 'O cliente vê o preço exato.' },
  { valor: 'A_PARTIR_DE', rotulo: 'A partir de', apoio: 'O preço final depende do atendimento.' },
  { valor: 'OCULTO', rotulo: 'Não exibir', apoio: 'Nenhuma linha de valor aparece.' },
  { valor: 'GRATUITO', rotulo: 'Gratuito', apoio: 'Sem cobrança.' },
];

const NOVO: DadosDoServico = {
  nome: '',
  slug: '',
  descricao: null,
  categoriaId: null,
  duracaoMin: 30,
  folgaAntesMin: 0,
  folgaDepoisMin: 0,
  valorCentavos: null,
  exibicaoValor: 'FIXO',
  cor: null,
  posicao: null,
};

function semId(servico: ServicoDoPainel): DadosDoServico {
  const { id: _id, ativo: _ativo, ...dados } = servico;

  return dados;
}

export type PropsDoFormularioDeServico = {
  aberto: boolean;
  aoMudarAbertura: (aberto: boolean) => void;
  /** Ausente cria; presente edita. */
  servico?: ServicoDoPainel;
  categorias: readonly Categoria[];
};

export function FormularioDeServico({
  aberto,
  aoMudarAbertura,
  servico,
  categorias,
}: PropsDoFormularioDeServico) {
  const criar = useCriarServico();
  const atualizar = useAtualizarServico();
  const salvando = criar.isPending || atualizar.isPending;

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(dadosDoServico),
    values: servico === undefined ? NOVO : semId(servico),
  });

  const exibicao = watch('exibicaoValor');
  const semValor = exibicao === 'OCULTO' || exibicao === 'GRATUITO';

  const enviar = handleSubmit(async (valores) => {
    // O modo sem preço não guarda valor: deixar o número gravado faria o
    // catálogo voltar a exibi-lo ao trocar o modo de volta, sem ninguém pedir
    const corpo = semValor ? { ...valores, valorCentavos: null } : valores;

    try {
      if (servico === undefined) {
        await criar.mutateAsync(corpo);
      } else {
        await atualizar.mutateAsync({ id: servico.id, corpo });
      }

      aoMudarAbertura(false);
    } catch (erro) {
      if (!aplicarErrosServidor(erro, setError as never)) {
        setError('root', { message: 'Não foi possível salvar. Tente de novo.' });
      }
    }
  });

  return (
    <RaizDoDialogo open={aberto} onOpenChange={aoMudarAbertura}>
      <Dialogo
        titulo={servico === undefined ? 'Novo serviço' : 'Editar serviço'}
        descricao="Duração, valor e como ele aparece para quem agenda."
        rodape={
          <>
            <FechamentoDoDialogo asChild>
              <Botao variante="contorno" disabled={salvando}>
                Cancelar
              </Botao>
            </FechamentoDoDialogo>

            <Botao type="submit" form="formulario-de-servico" carregando={salvando}>
              Salvar
            </Botao>
          </>
        }
      >
        <form id="formulario-de-servico" onSubmit={enviar} className="flex flex-col gap-4">
          {errors.root?.message !== undefined ? (
            <Aviso tom="negativo" titulo="Não foi possível salvar">
              {errors.root.message}
            </Aviso>
          ) : null}

          <Campo rotulo="Nome" obrigatorio erro={errors.nome?.message}>
            {(ligacao) => (
              <Entrada
                {...ligacao}
                {...register('nome', {
                  // Só sugere ao criar: mudar o endereço de um serviço já
                  // publicado quebraria os deep links que já circulam
                  onChange: (evento) => {
                    if (servico === undefined) {
                      setValue('slug', paraSlug(evento.target.value), { shouldValidate: true });
                    }
                  },
                })}
              />
            )}
          </Campo>

          <Campo
            rotulo="Endereço"
            obrigatorio
            apoio="Usado no link direto para este serviço"
            erro={errors.slug?.message}
          >
            {(ligacao) => <Entrada {...ligacao} {...register('slug')} />}
          </Campo>

          <Campo rotulo="Descrição" erro={errors.descricao?.message}>
            {(ligacao) => (
              <AreaTexto
                {...ligacao}
                rows={2}
                {...register('descricao', {
                  setValueAs: (texto: string) => (texto.trim() === '' ? null : texto),
                })}
              />
            )}
          </Campo>

          <Campo rotulo="Categoria" erro={errors.categoriaId?.message}>
            {(ligacao) => (
              <Selecao
                {...ligacao}
                {...register('categoriaId', {
                  setValueAs: (valor: string) => (valor === '' ? null : valor),
                })}
              >
                <option value="">Sem categoria</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Duração" obrigatorio erro={errors.duracaoMin?.message}>
              {(ligacao) => (
                <Controller
                  control={control}
                  name="duracaoMin"
                  render={({ field }) => (
                    <Passo
                      {...ligacao}
                      value={field.value}
                      onChange={field.onChange}
                      passo={5}
                      minimo={5}
                      maximo={600}
                      unidade="min"
                    />
                  )}
                />
              )}
            </Campo>

            <Campo rotulo="Folga antes" apoio="Preparo" erro={errors.folgaAntesMin?.message}>
              {(ligacao) => (
                <Controller
                  control={control}
                  name="folgaAntesMin"
                  render={({ field }) => (
                    <Passo
                      {...ligacao}
                      value={field.value}
                      onChange={field.onChange}
                      passo={5}
                      maximo={240}
                      unidade="min"
                    />
                  )}
                />
              )}
            </Campo>

            <Campo rotulo="Folga depois" apoio="Limpeza" erro={errors.folgaDepoisMin?.message}>
              {(ligacao) => (
                <Controller
                  control={control}
                  name="folgaDepoisMin"
                  render={({ field }) => (
                    <Passo
                      {...ligacao}
                      value={field.value}
                      onChange={field.onChange}
                      passo={5}
                      maximo={240}
                      unidade="min"
                    />
                  )}
                />
              )}
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Como exibir o valor"
              apoio={MODOS.find((modo) => modo.valor === exibicao)?.apoio}
              erro={errors.exibicaoValor?.message}
            >
              {(ligacao) => (
                <Selecao {...ligacao} {...register('exibicaoValor')}>
                  {MODOS.map((modo) => (
                    <option key={modo.valor} value={modo.valor}>
                      {modo.rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>

            {semValor ? null : (
              <Campo rotulo="Valor" erro={errors.valorCentavos?.message}>
                {(ligacao) => (
                  <Controller
                    control={control}
                    name="valorCentavos"
                    render={({ field }) => (
                      <EntradaMoeda
                        {...ligacao}
                        value={field.value ?? null}
                        onChange={field.onChange}
                      />
                    )}
                  />
                )}
              </Campo>
            )}
          </div>

          <Campo
            rotulo="Cor na agenda"
            apoio="Para reconhecer o serviço de relance"
            erro={errors.cor?.message}
          >
            {(ligacao) => (
              <Controller
                control={control}
                name="cor"
                render={({ field }) => (
                  <SeletorCor
                    {...ligacao}
                    value={field.value}
                    onChange={field.onChange}
                    opcoes={CORES_DE_ETIQUETA}
                  />
                )}
              />
            )}
          </Campo>
        </form>
      </Dialogo>
    </RaizDoDialogo>
  );
}
