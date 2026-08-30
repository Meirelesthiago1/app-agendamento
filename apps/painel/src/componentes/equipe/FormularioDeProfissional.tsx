import {
  type AcessoDaEquipe,
  aplicarErrosServidor,
  type DadosDoProfissional,
  dadosDoProfissional,
  type MembroDaEquipe,
} from '@agendamento/contratos';
import {
  AreaTexto,
  Aviso,
  Botao,
  Campo,
  Dialogo,
  Entrada,
  FechamentoDoDialogo,
  RaizDoDialogo,
  Selecao,
} from '@agendamento/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useAtualizarProfissional, useCriarProfissional } from '../../lib/equipe.ts';

const NOVO: DadosDoProfissional = {
  nomeExibicao: '',
  bio: null,
  avatarUrl: null,
  posicao: null,
  vinculoId: null,
};

function semId(membro: MembroDaEquipe): DadosDoProfissional {
  return {
    nomeExibicao: membro.nomeExibicao,
    bio: membro.bio,
    avatarUrl: membro.avatarUrl,
    posicao: membro.posicao,
    vinculoId: membro.vinculoId,
  };
}

export type PropsDoFormularioDeProfissional = {
  aberto: boolean;
  aoMudarAbertura: (aberto: boolean) => void;
  /** Ausente cria; presente edita. */
  membro?: MembroDaEquipe;
  acessos: readonly AcessoDaEquipe[];
};

export function FormularioDeProfissional({
  aberto,
  aoMudarAbertura,
  membro,
  acessos,
}: PropsDoFormularioDeProfissional) {
  const criar = useCriarProfissional();
  const atualizar = useAtualizarProfissional();
  const salvando = criar.isPending || atualizar.isPending;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(dadosDoProfissional),
    values: membro === undefined ? NOVO : semId(membro),
  });

  // Um acesso pertence a no máximo um profissional (índice único em
  // `vinculo_id`), então os já ligados a outra pessoa saem da lista
  const disponiveis = acessos.filter(
    (acesso) => acesso.profissionalId === null || acesso.profissionalId === membro?.id,
  );

  const enviar = handleSubmit(async (valores) => {
    try {
      if (membro === undefined) {
        await criar.mutateAsync(valores);
      } else {
        await atualizar.mutateAsync({ id: membro.id, corpo: valores });
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
        titulo={membro === undefined ? 'Nova pessoa na equipe' : 'Editar pessoa'}
        descricao="Quem atende. O acesso ao painel é separado, e opcional."
        rodape={
          <>
            <FechamentoDoDialogo asChild>
              <Botao variante="contorno" disabled={salvando}>
                Cancelar
              </Botao>
            </FechamentoDoDialogo>

            <Botao type="submit" form="formulario-de-profissional" carregando={salvando}>
              Salvar
            </Botao>
          </>
        }
      >
        <form id="formulario-de-profissional" onSubmit={enviar} className="flex flex-col gap-4">
          {errors.root?.message !== undefined ? (
            <Aviso tom="negativo" titulo="Não foi possível salvar">
              {errors.root.message}
            </Aviso>
          ) : null}

          <Campo
            rotulo="Nome"
            obrigatorio
            apoio="Como aparece para quem agenda"
            erro={errors.nomeExibicao?.message}
          >
            {(ligacao) => <Entrada {...ligacao} {...register('nomeExibicao')} />}
          </Campo>

          <Campo rotulo="Apresentação" erro={errors.bio?.message}>
            {(ligacao) => (
              <AreaTexto
                {...ligacao}
                rows={3}
                {...register('bio', {
                  setValueAs: (texto: string) => (texto.trim() === '' ? null : texto),
                })}
              />
            )}
          </Campo>

          <Campo
            rotulo="Acesso ao painel"
            apoio="Sem acesso, esta pessoa recebe agendamentos mas não entra no sistema"
            erro={errors.vinculoId?.message}
          >
            {(ligacao) => (
              <Selecao
                {...ligacao}
                {...register('vinculoId', {
                  setValueAs: (valor: string) => (valor === '' ? null : valor),
                })}
              >
                <option value="">Sem acesso</option>
                {disponiveis.map((acesso) => (
                  <option key={acesso.vinculoId} value={acesso.vinculoId}>
                    {acesso.nome} ({acesso.email})
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </form>
      </Dialogo>
    </RaizDoDialogo>
  );
}
