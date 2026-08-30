import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { FormularioDeSenha } from '../componentes/FormularioDeSenha.tsx';
import { useRedefinirSenha } from '../lib/sessao.ts';

export const Route = createFileRoute('/nova-senha')({
  validateSearch: (busca: Record<string, unknown>) => ({
    token: typeof busca.token === 'string' ? busca.token : '',
  }),
  component: TelaDeNovaSenha,
});

function TelaDeNovaSenha() {
  const { token } = Route.useSearch();
  const navegar = useNavigate();
  const redefinir = useRedefinirSenha();

  return (
    <FormularioDeSenha
      token={token}
      titulo="Definir senha nova"
      apoio="Ao salvar, as sessões abertas em outros aparelhos são encerradas."
      rotuloDaAcao="Salvar e entrar"
      salvando={redefinir.isPending}
      rodape={
        <Link to="/entrada" className="underline">
          Voltar para a entrada
        </Link>
      }
      aoDefinir={async (senha) => {
        await redefinir.mutateAsync({ token, senha });

        // Redefinir derruba todas as sessões, inclusive a desta aba: entrar de
        // novo é o passo seguinte, não uma falha
        await navegar({ to: '/entrada' });
      }}
    />
  );
}
