import { Aviso, Botao } from '@agendamento/ui';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';

export type ContextoDoRoteador = {
  cliente: QueryClient;
};

/**
 * O tratamento de erro global (7.1 do stack): tudo que escapa de uma rota cai
 * aqui, e vira um aviso — nunca uma tela em branco, que é o que acontece quando
 * um erro não tratado derruba a árvore do React.
 */
function ErroGlobal({ error }: { error: Error }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <Aviso tom="negativo" titulo="Não foi possível carregar esta tela">
        {error.message}
      </Aviso>

      <Botao variante="contorno" onClick={() => window.location.reload()}>
        Tentar de novo
      </Botao>
    </div>
  );
}

function NaoEncontrada() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <Aviso titulo="Página não encontrada">O endereço que você abriu não existe.</Aviso>

      <Botao variante="contorno" onClick={() => window.location.assign('/')}>
        Voltar ao início
      </Botao>
    </div>
  );
}

export const Route = createRootRouteWithContext<ContextoDoRoteador>()({
  component: Outlet,
  errorComponent: ErroGlobal,
  notFoundComponent: NaoEncontrada,
});
