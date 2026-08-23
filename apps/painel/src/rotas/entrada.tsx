import { aplicarErrosServidor } from '@agendamento/contratos';
import { Botao, Campo, Cartao, Entrada } from '@agendamento/ui';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { CHAVES_GLOBAIS } from '../lib/chaves.ts';
import { buscarSessao, useEntrar } from '../lib/sessao.ts';

export const Route = createFileRoute('/entrada')({
  validateSearch: (busca: Record<string, unknown>) => ({
    // Para onde voltar depois de entrar. Sem isto, quem clicou num link
    // profundo cai na home e perde o que estava fazendo.
    destino: typeof busca.destino === 'string' ? busca.destino : undefined,
  }),
  beforeLoad: async ({ context, search }) => {
    const sessao = await context.cliente.fetchQuery({
      queryKey: CHAVES_GLOBAIS.sessao,
      queryFn: buscarSessao,
    });

    if (sessao !== null) {
      throw redirect({ to: search.destino ?? '/agenda' });
    }
  },
  component: TelaDeEntrada,
});

function TelaDeEntrada() {
  const { destino } = Route.useSearch();
  const navegar = useNavigate();
  const entrar = useEntrar();
  const [erros, definirErros] = useState<Record<string, string>>({});
  const [erroGeral, definirErroGeral] = useState<string | null>(null);

  async function aoEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirErros({});
    definirErroGeral(null);

    const dados = new FormData(evento.currentTarget);

    try {
      await entrar.mutateAsync({
        email: String(dados.get('email') ?? ''),
        senha: String(dados.get('senha') ?? ''),
      });

      await navegar({ to: destino ?? '/agenda' });
    } catch (erro) {
      const tratou = aplicarErrosServidor(erro, (campo, detalhe) =>
        definirErros((atuais) => ({ ...atuais, [campo]: detalhe.message })),
      );

      if (!tratou) {
        definirErroGeral(erro instanceof Error ? erro.message : 'Não foi possível entrar.');
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold text-conteudo">Entrar</h1>

      <Cartao>
        <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
          <Campo rotulo="E-mail" erro={erros.email}>
            {(ligacao) => (
              <Entrada {...ligacao} name="email" type="email" autoComplete="email" required />
            )}
          </Campo>

          <Campo rotulo="Senha" erro={erros.senha ?? erroGeral ?? undefined}>
            {(ligacao) => (
              <Entrada
                {...ligacao}
                name="senha"
                type="password"
                autoComplete="current-password"
                required
              />
            )}
          </Campo>

          <Botao type="submit" larguraTotal carregando={entrar.isPending}>
            Entrar
          </Botao>
        </form>
      </Cartao>

      <p className="text-center text-sm text-conteudo-suave">
        <Link to="/cadastro" className="underline">
          Criar uma conta
        </Link>
      </p>
    </main>
  );
}
