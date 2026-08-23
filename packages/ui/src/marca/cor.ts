/**
 * Conversão de cor e contraste, sem dependência externa: o grafo de 4.2 do stack
 * dá a `packages/ui` apenas React e Tailwind, e a matemática aqui é fechada e
 * verificável contra valores de referência.
 */

export type Rgb = { r: number; g: number; b: number };

/** OKLCH mantém a luminosidade percebida coerente entre matizes (2.3). */
export type Oklch = { l: number; c: number; h: number };

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function ehHexValido(valor: string): boolean {
  return HEX.test(valor);
}

export function hexParaRgb(hex: string): Rgb {
  if (!ehHexValido(hex)) {
    throw new RangeError(`cor invalida: ${hex}`);
  }

  const cru = hex.slice(1);
  const cheio =
    cru.length === 3
      ? cru
          .split('')
          .map((d) => d + d)
          .join('')
      : cru;

  return {
    r: Number.parseInt(cheio.slice(0, 2), 16) / 255,
    g: Number.parseInt(cheio.slice(2, 4), 16) / 255,
    b: Number.parseInt(cheio.slice(4, 6), 16) / 255,
  };
}

function paraDoisDigitos(valor: number): string {
  return Math.round(Math.min(1, Math.max(0, valor)) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

export function rgbParaHex({ r, g, b }: Rgb): string {
  return `#${paraDoisDigitos(r)}${paraDoisDigitos(g)}${paraDoisDigitos(b)}`;
}

function paraLinear(canal: number): number {
  return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
}

function paraGama(canal: number): number {
  return canal <= 0.0031308 ? canal * 12.92 : 1.055 * canal ** (1 / 2.4) - 0.055;
}

export function rgbParaOklch({ r, g, b }: Rgb): Oklch {
  const lr = paraLinear(r);
  const lg = paraLinear(g);
  const lb = paraLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const eixoL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const eixoA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const eixoB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const croma = Math.sqrt(eixoA * eixoA + eixoB * eixoB);
  const matiz = croma < 1e-7 ? 0 : ((Math.atan2(eixoB, eixoA) * 180) / Math.PI + 360) % 360;

  return { l: eixoL, c: croma, h: matiz };
}

function oklchParaRgbCru({ l, c, h }: Oklch): Rgb {
  const radianos = (h * Math.PI) / 180;
  const eixoA = c * Math.cos(radianos);
  const eixoB = c * Math.sin(radianos);

  const cubL = (l + 0.3963377774 * eixoA + 0.2158037573 * eixoB) ** 3;
  const cubM = (l - 0.1055613458 * eixoA - 0.0638541728 * eixoB) ** 3;
  const cubS = (l - 0.0894841775 * eixoA - 1.291485548 * eixoB) ** 3;

  return {
    r: paraGama(4.0767416621 * cubL - 3.3077115913 * cubM + 0.2309699292 * cubS),
    g: paraGama(-1.2684380046 * cubL + 2.6097574011 * cubM - 0.3413193965 * cubS),
    b: paraGama(-0.0041960863 * cubL - 0.7034186147 * cubM + 1.707614701 * cubS),
  };
}

function dentroDoGamute({ r, g, b }: Rgb): boolean {
  const margem = 1e-4;

  return [r, g, b].every((canal) => canal >= -margem && canal <= 1 + margem);
}

/**
 * Reduz o croma até a cor caber em sRGB. Sem isso, uma matiz saturada em
 * luminosidade alta volta como componente fora de faixa, e o recorte simples
 * muda a matiz — o botão do tenant sairia de uma cor diferente da escolhida.
 */
export function oklchParaRgb(alvo: Oklch): Rgb {
  if (dentroDoGamute(oklchParaRgbCru(alvo))) {
    return oklchParaRgbCru(alvo);
  }

  let baixo = 0;
  let alto = alvo.c;

  for (let passo = 0; passo < 24; passo += 1) {
    const meio = (baixo + alto) / 2;

    if (dentroDoGamute(oklchParaRgbCru({ ...alvo, c: meio }))) {
      baixo = meio;
    } else {
      alto = meio;
    }
  }

  const { r, g, b } = oklchParaRgbCru({ ...alvo, c: baixo });

  return {
    r: Math.min(1, Math.max(0, r)),
    g: Math.min(1, Math.max(0, g)),
    b: Math.min(1, Math.max(0, b)),
  };
}

export function oklchParaHex(cor: Oklch): string {
  return rgbParaHex(oklchParaRgb(cor));
}

export function hexParaOklch(hex: string): Oklch {
  return rgbParaOklch(hexParaRgb(hex));
}

function luminanciaRelativa({ r, g, b }: Rgb): number {
  return 0.2126 * paraLinear(r) + 0.7152 * paraLinear(g) + 0.0722 * paraLinear(b);
}

/** Razão de contraste da WCAG: 4.5:1 em texto, 3:1 em controle e borda (4.5). */
export function contraste(umHex: string, outroHex: string): number {
  const um = luminanciaRelativa(hexParaRgb(umHex));
  const outro = luminanciaRelativa(hexParaRgb(outroHex));
  const claro = Math.max(um, outro);
  const escuro = Math.min(um, outro);

  return (claro + 0.05) / (escuro + 0.05);
}
