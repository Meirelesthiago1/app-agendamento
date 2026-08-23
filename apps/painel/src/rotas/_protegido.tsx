import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { Layout } from '../componentes/Layout.tsx';
import { CHAVES_GLOBAIS } from '../lib/chaves.ts';
import { ajustarEstabelecimento, buscarSessao } from '../lib/sessao.ts';

/**
 * A guarda de rota. Roda antes de qualquer tela protegida montar, e leva junto
 * de onde a pessoa veio — entrar precisa devolvê-la ao lugar, não à home.
 *
 * Isto **não** é a autorização: quem autoriza é o servidor, em toda requisição.
 * A guarda existe para não mostrar uma casca vazia a quem não vai conseguir
 * carregar nada dentro dela.
 */
export const Route = createFileRoute('/_protegido')({
  beforeLoad: async ({ context, location }) => {
    const sessao = await context.cliente.fetchQuery({
      queryKey: CHAVES_GLOBAIS.sessao,
      queryFn: buscarSessao,
    });

    if (sessao === null) {
      throw redirect({ to: '/entrada', search: { destino: location.href } });
    }

    ajustarEstabelecimento(sessao);

    return { sessao };
  },
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});
