import { Aviso, Botao, Campo, Entrada } from '@agendamento/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { CascaDeAutenticacao } from '../componentes/CascaDeAutenticacao.tsx';
import { usePedirRecuperacao } from '../lib/sessao.ts';

export const Route = createFileRoute('/recuperacao')({ component: TelaDeRecuperacao });

function TelaDeRecuperacao() {
  const pedir = usePedirRecuperacao();
  const [enviado, definirEnviado] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  async function aoEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirErro(null);

    const dados = new FormData(evento.currentTarget);

    try {
      // Quem esconde a existência da conta é a resposta do servidor, que é a
      // mesma nos dois casos (1.1 do conteúdo). Falha de rede é outra coisa, e
      // engolir aqui deixaria a pessoa esperando um e-mail que nunca saiu
      await pedir.mutateAsync(String(dados.get('email') ?? ''));
      definirEnviado(true);
    } catch {
      definirErro('Não foi possível enviar agora. Tente de novo em instantes.');
    }
  }

  return (
    <CascaDeAutenticacao
      titulo="Recuperar acesso"
      apoio="Enviamos um link para você definir uma senha nova."
      rodape={
        <Link to="/entrada" className="underline">
          Voltar para a entrada
        </Link>
      }
    >
      {enviado ? (
        <Aviso titulo="Confira seu e-mail">
          Se houver uma conta com esse endereço, o link chega em instantes. Ele vale por uma hora.
        </Aviso>
      ) : (
        <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
          {erro === null ? null : (
            <Aviso tom="negativo" titulo="Não foi possível enviar">
              {erro}
            </Aviso>
          )}

          <Campo rotulo="E-mail">
            {(ligacao) => (
              <Entrada {...ligacao} name="email" type="email" autoComplete="email" required />
            )}
          </Campo>

          <Botao type="submit" larguraTotal carregando={pedir.isPending}>
            Enviar link
          </Botao>
        </form>
      )}
    </CascaDeAutenticacao>
  );
}
