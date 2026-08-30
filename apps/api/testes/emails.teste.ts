import { describe, expect, test } from 'vitest';
import { emailDeConvite, emailDeRecuperacao, exigirAssuntoCurto } from '../src/emails/index.ts';

const LINK = 'https://app.agendamento.local/convite?token=abc123';

const CONVITE = {
  convidadoPor: 'Rui Barbosa',
  estabelecimento: 'Barbearia Corte Fino',
  papelPorExtenso: 'Administrador',
  telefonePublico: '(11) 98888-0001',
  corTema: '#1C2A3A',
  link: LINK,
};

/** As regras de 3.0, que valem para todo template. */
describe('regras de todos os templates', () => {
  test('o assunto cabe em 60 caracteres', async () => {
    const mensagens = [
      await emailDeConvite('alguem@teste.local', CONVITE),
      await emailDeRecuperacao('alguem@teste.local', { link: LINK }),
    ];

    for (const mensagem of mensagens) {
      expect(mensagem.assunto.length).toBeLessThanOrEqual(60);
    }
  });

  test('assunto longo demais é recusado na montagem, não em produção', () => {
    expect(() => exigirAssuntoCurto('x'.repeat(61))).toThrow(/limite/);
  });

  test('a informação decisiva vem antes do corte do celular', async () => {
    const convite = await emailDeConvite('alguem@teste.local', CONVITE);

    // O nome de quem convida é o que decide se a pessoa abre
    expect(convite.assunto.slice(0, 35)).toContain('Rui Barbosa');
  });

  test('o preheader é preenchido: vazio, o cliente exibe o começo do HTML', async () => {
    const mensagem = await emailDeRecuperacao('alguem@teste.local', { link: LINK });

    expect(mensagem.html).toContain('Link para redefinir sua senha.');
  });

  test('a alternativa em texto puro traz a URL, não o rótulo', async () => {
    const mensagem = await emailDeConvite('alguem@teste.local', CONVITE);

    expect(mensagem.texto).toContain(LINK);
    expect(mensagem.texto).not.toContain('<a ');
  });

  test('um CTA por e-mail: dois botões competem e nenhum é clicado', async () => {
    for (const mensagem of [
      await emailDeConvite('a@teste.local', CONVITE),
      await emailDeRecuperacao('a@teste.local', { link: LINK }),
    ]) {
      // O link cru embaixo repete o mesmo destino, para quem bloqueia botão
      const destinos = new Set([...mensagem.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]));

      expect(destinos.size).toBe(1);
    }
  });
});

describe('conteúdo de cada transacional', () => {
  test('convite: diz o papel, porque quem recebe precisa saber o que aceita', async () => {
    const mensagem = await emailDeConvite('novo@teste.local', CONVITE);

    expect(mensagem.texto).toContain('Administrador');
    expect(mensagem.texto).toContain('Barbearia Corte Fino');
    expect(mensagem.texto).toContain('sete dias');
  });

  test('convite: usa a cor da marca do tenant no botão', async () => {
    const daMarca = await emailDeConvite('novo@teste.local', { ...CONVITE, corTema: '#7C3AED' });
    const doPadrao = await emailDeConvite('novo@teste.local', CONVITE);

    // Cor embutida, porque cliente de e-mail não resolve custom property
    expect(daMarca.html).not.toBe(doPadrao.html);
    expect(daMarca.html.toLowerCase()).toContain('background-color');
  });

  test('recuperação: termina tranquilizando quem não pediu', async () => {
    const mensagem = await emailDeRecuperacao('rui@teste.local', { link: LINK });

    expect(mensagem.texto).toContain('sua senha continua a mesma');
    expect(mensagem.texto).toContain('uma hora');
  });
});

/** 1.1: nenhuma superfície revela se a conta existe. */
describe('o que o texto nunca revela', () => {
  test('nenhum transacional diz se a conta existe ou não', async () => {
    for (const mensagem of [await emailDeRecuperacao('a@teste.local', { link: LINK })]) {
      expect(mensagem.texto).not.toMatch(/conta (não )?existe|cadastrad[oa]|encontrada/i);
    }
  });

  test('sem exclamação: a voz é direta, sem interjeição', async () => {
    for (const mensagem of [
      await emailDeConvite('a@teste.local', CONVITE),
      await emailDeRecuperacao('a@teste.local', { link: LINK }),
    ]) {
      expect(mensagem.texto).not.toContain('!');
    }
  });
});
