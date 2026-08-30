import { aplicarErrosServidor } from '@agendamento/contratos';
import { Botao, Campo, Cartao, Entrada } from '@agendamento/ui';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { CHAVES_GLOBAIS } from '../lib/chaves.ts';
import { buscarSessao, useEntrar } from '../lib/sessao.ts';

export const Route = createFileRoute('/entrada')({
  // O retorno é anotado com `?` de propósito: sem isso o roteador entende que
  // `destino` está sempre presente e passa a exigir `search` em todo link para
  // esta rota. Ele guarda para onde voltar depois de entrar — quem clicou num
  // link profundo não pode cair na home e perder o que estava fazendo.
  validateSearch: (busca: Record<string, unknown>): { destino?: string } => ({
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

      {/* Não existe "criar conta": o tenant é provisionado pela plataforma, e
          proprietário e equipe entram por convite (2.2) */}
      <p className="text-center text-sm text-conteudo-suave">
        Esqueceu a senha?{' '}
        <Link to="/recuperacao" className="underline">
          Receber um link por e-mail
        </Link>
      </p>
    </main>
  );
}
