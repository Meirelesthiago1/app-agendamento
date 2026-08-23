import { Aviso } from '../primitivos/Aviso.tsx';
import { Botao } from '../primitivos/Botao.tsx';
import { Campo } from '../primitivos/Campo.tsx';
import { Entrada } from '../primitivos/Entrada.tsx';
import { Selo } from '../primitivos/Selo.tsx';
import { ehHexValido } from './cor.ts';
import { COR_PADRAO, derivarPaleta } from './derivar-paleta.ts';

export type PropsDoSeletorCorMarca = {
  valor: string;
  aoMudar: (cor: string) => void;
  rotulo?: string;
};

const AMOSTRAS = [
  ['acao', 'Ação'],
  ['acaoForte', 'Ação forte'],
  ['acaoSuave', 'Ação suave'],
  ['acaoConteudo', 'Conteúdo'],
] as const;

/**
 * O campo de `cor_tema` não é um seletor de cor cru (2.3). O gestor precisa ver
 * a rampa derivada, um botão de exemplo e o aviso de compressão **antes** de
 * salvar — do contrário descobre pela página pública que a marca dele saiu
 * diferente, e não tem como saber por quê.
 */
export function SeletorCorMarca({
  valor,
  aoMudar,
  rotulo = 'Cor da marca',
}: PropsDoSeletorCorMarca) {
  const formatoValido = ehHexValido(valor);
  const paleta = derivarPaleta(valor);

  return (
    <div className="flex flex-col gap-4">
      <Campo
        rotulo={rotulo}
        apoio="Usada na página pública do seu estabelecimento."
        erro={formatoValido ? undefined : `Use um valor como ${COR_PADRAO}`}
      >
        {(ligacao) => (
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={`${rotulo}, seletor visual`}
              value={formatoValido ? valor : paleta.acao}
              onChange={(evento) => aoMudar(evento.target.value.toUpperCase())}
              className="size-(--altura-controle) shrink-0 cursor-pointer rounded-md border border-borda-forte bg-superficie"
            />
            <Entrada
              {...ligacao}
              value={valor}
              onChange={(evento) => aoMudar(evento.target.value.toUpperCase())}
              className="numerais-tabulares uppercase"
              maxLength={7}
            />
          </div>
        )}
      </Campo>

      <div className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4">
        <div className="flex flex-wrap gap-3">
          {AMOSTRAS.map(([chave, nome]) => (
            <div key={chave} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-8 shrink-0 rounded-md border border-borda"
                style={{ background: paleta[chave] }}
              />
              <span className="flex flex-col">
                <span className="text-xs text-conteudo">{nome}</span>
                <code className="numerais-tabulares text-2xs text-conteudo-suave">
                  {paleta[chave]}
                </code>
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Botao style={{ background: paleta.acao, color: paleta.acaoConteudo }}>Confirmar</Botao>
          <Selo style={{ background: paleta.acaoSuave, color: paleta.acao }}>Selo de marca</Selo>
          <span className="numerais-tabulares text-xs text-conteudo-suave">
            texto {paleta.contrasteDoConteudo.toFixed(1)}:1 · botão{' '}
            {paleta.contrasteDaSuperficie.toFixed(1)}:1
          </span>
        </div>
      </div>

      {paleta.comprimida ? (
        <Aviso tom="atencao" titulo="A cor foi ajustada">
          A cor escolhida não funciona como fundo de botão — o texto ficaria ilegível ou o botão
          desapareceria sobre o fundo branco. O tom acima é o mais próximo dela que funciona.
        </Aviso>
      ) : null}
    </div>
  );
}
