import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './estilos.css';
import { criarQueryClient } from './lib/consultas.ts';
import { routeTree } from './rotaArvore.gen.ts';

const cliente = criarQueryClient();

const roteador = createRouter({
  routeTree,
  // As guardas de rota consultam a sessão pelo cache, em vez de refazer a
  // requisição a cada navegação
  context: { cliente },
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof roteador;
  }
}

const raiz = document.getElementById('raiz');

if (!raiz) {
  throw new Error('Elemento #raiz ausente em index.html');
}

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <RouterProvider router={roteador} />
    </QueryClientProvider>
  </StrictMode>,
);
