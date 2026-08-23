import tailwind from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // Antes do plugin do React: ele precisa gerar a árvore antes da transformação
    tanstackRouter({
      routesDirectory: './src/rotas',
      generatedRouteTree: './src/rotaArvore.gen.ts',
    }),
    react(),
    tailwind(),
  ],
  server: {
    port: 5173,
    // A API responde em outra origem; sem isto o cookie de sessão não viaja
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (caminho) => caminho.replace(/^\/api/, ''),
      },
    },
  },
});
