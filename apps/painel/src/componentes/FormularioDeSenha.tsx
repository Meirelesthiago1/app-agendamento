import { aplicarErrosServidor } from '@agendamento/contratos';
import { Aviso, Botao, Campo, Entrada } from '@agendamento/ui';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { CascaDeAutenticacao } from './CascaDeAutenticacao.tsx';

export type PropsDoFormularioDeSenha = {
  /** Vem da URL. Vazio significa link cortado no caminho. */
  token: string;
  titulo: string;
  apoio: string;
  rotuloDaAcao: string;
  rodape: ReactNode;
  salvando: boolean;
  /** Lança em caso de falha, para o erro cair no aviso ou no campo. */
  aoDefinir: (senha: string) => Promise<void>;
};

/**
 * Aceitar convite e redefinir senha são a mesma tela com outro destino: token
 * na URL, senha, confirmação. O que não pode divergir é a conferência das duas
 * senhas e o tratamento de erro — em duas cópias, a correção de uma passaria
 * pela outra sem ninguém notar.
 */
export function FormularioDeSenha({
  token,
  titulo,
  apoio,
  rotuloDaAcao,
  rodape,
  salvando,
  aoDefinir,
}: PropsDoFormularioDeSenha) {
  const [erros, definirErros] = useState<Record<string, string>>({});
  const [erroGeral, definirErroGeral] = useState<string | null>(null);

  async function aoEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirErros({});
    definirErroGeral(null);

    const dados = new FormData(evento.currentTarget);
    const senha = String(dados.get('senha') ?? '');

    if (senha !== String(dados.get('confirmacao') ?? '')) {
      definirErros({ confirmacao: 'As duas senhas precisam ser iguais.' });
      return;
    }

    try {
      await aoDefinir(senha);
    } catch (erro) {
      const tratou = aplicarErrosServidor(erro, (campo, detalhe) =>
        definirErros((atuais) => ({ ...atuais, [campo]: detalhe.message })),
      );

      if (!tratou) {
        definirErroGeral(
          erro instanceof Error ? erro.message : 'Não foi possível definir a senha.',
        );
      }
    }
  }

  if (token === '') {
    return (
      <CascaDeAutenticacao
        titulo="Link incompleto"
        rodape={
          <Link to="/entrada" className="underline">
            Ir para a entrada
          </Link>
        }
      >
        <Aviso tom="negativo" titulo="Este endereço não traz um link válido">
          Abra o link exatamente como ele veio no e-mail, sem cortar nada.
        </Aviso>
      </CascaDeAutenticacao>
    );
  }

  return (
    <CascaDeAutenticacao titulo={titulo} apoio={apoio} rodape={rodape}>
      <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
        {erroGeral === null ? null : (
          <Aviso tom="negativo" titulo="Não foi possível continuar">
            {erroGeral}
          </Aviso>
        )}

        <Campo rotulo="Senha" apoio="Pelo menos oito caracteres" erro={erros.senha}>
          {(ligacao) => (
            <Entrada
              {...ligacao}
              name="senha"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          )}
        </Campo>

        <Campo rotulo="Repita a senha" erro={erros.confirmacao}>
          {(ligacao) => (
            <Entrada
              {...ligacao}
              name="confirmacao"
              type="password"
              autoComplete="new-password"
              required
            />
          )}
        </Campo>

        <Botao type="submit" larguraTotal carregando={salvando}>
          {rotuloDaAcao}
        </Botao>
      </form>
    </CascaDeAutenticacao>
  );
}
