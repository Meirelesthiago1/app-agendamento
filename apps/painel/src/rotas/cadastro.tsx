import { aplicarErrosServidor } from '@agendamento/contratos';
import { Aviso, Botao, Campo, Cartao, Entrada } from '@agendamento/ui';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../lib/api.ts';

export const Route = createFileRoute('/cadastro')({ component: TelaDeCadastro });

function TelaDeCadastro() {
  const [erros, definirErros] = useState<Record<string, string>>({});
  const cadastrar = useMutation({
    mutationFn: (dados: { nome: string; email: string; senha: string }) =>
      api.cadastrar({ corpo: dados }),
  });

  async function aoEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirErros({});

    const dados = new FormData(evento.currentTarget);

    try {
      await cadastrar.mutateAsync({
        nome: String(dados.get('nome') ?? ''),
        email: String(dados.get('email') ?? ''),
        senha: String(dados.get('senha') ?? ''),
      });
    } catch (erro) {
      aplicarErrosServidor(erro, (campo, detalhe) =>
        definirErros((atuais) => ({ ...atuais, [campo]: detalhe.message })),
      );
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold text-conteudo">Criar conta</h1>

      {cadastrar.isSuccess ? (
        // A mesma resposta exista a conta ou não (1.1 do conteúdo)
        <Aviso tom="positivo" titulo="Confira seu e-mail">
          Se houver uma conta a criar com este endereço, enviamos as instruções.
        </Aviso>
      ) : (
        <Cartao>
          <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
            <Campo rotulo="Nome" erro={erros.nome}>
              {(ligacao) => <Entrada {...ligacao} name="nome" autoComplete="name" required />}
            </Campo>

            <Campo rotulo="E-mail" erro={erros.email}>
              {(ligacao) => (
                <Entrada {...ligacao} name="email" type="email" autoComplete="email" required />
              )}
            </Campo>

            <Campo rotulo="Senha" apoio="No mínimo oito caracteres" erro={erros.senha}>
              {(ligacao) => (
                <Entrada
                  {...ligacao}
                  name="senha"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              )}
            </Campo>

            <Botao type="submit" larguraTotal carregando={cadastrar.isPending}>
              Criar conta
            </Botao>
          </form>
        </Cartao>
      )}

      <p className="text-center text-sm text-conteudo-suave">
        <Link to="/entrada" search={{ destino: undefined }} className="underline">
          Já tenho conta
        </Link>
      </p>
    </main>
  );
}
