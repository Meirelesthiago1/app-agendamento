import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { FormularioDeSenha } from '../componentes/FormularioDeSenha.tsx';
import { useAceitarConvite } from '../lib/sessao.ts';

/**
 * A porta de entrada do sistema. Não existe cadastro aberto (2.2): proprietário
 * e equipe chegam por este link, e é aqui que a senha é definida pela primeira
 * vez. O aceite também verifica o e-mail, porque quem clicou provou a posse.
 */
export const Route = createFileRoute('/convite')({
  validateSearch: (busca: Record<string, unknown>) => ({
    token: typeof busca.token === 'string' ? busca.token : '',
  }),
  component: TelaDeConvite,
});

function TelaDeConvite() {
  const { token } = Route.useSearch();
  const navegar = useNavigate();
  const aceitar = useAceitarConvite();

  return (
    <FormularioDeSenha
      token={token}
      titulo="Criar sua senha"
      apoio="Você foi convidado. Defina uma senha para entrar."
      rotuloDaAcao="Entrar"
      salvando={aceitar.isPending}
      rodape={
        <Link to="/entrada" className="underline">
          Já tenho uma senha
        </Link>
      }
      aoDefinir={async (senha) => {
        await aceitar.mutateAsync({ token, senha });
        await navegar({ to: '/agenda' });
      }}
    />
  );
}
