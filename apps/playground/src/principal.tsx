import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Aplicacao } from './Aplicacao.tsx';
import './estilos.css';

const raiz = document.getElementById('raiz');

if (!raiz) {
  throw new Error('Elemento #raiz ausente em index.html');
}

createRoot(raiz).render(
  <StrictMode>
    <Aplicacao />
  </StrictMode>,
);
