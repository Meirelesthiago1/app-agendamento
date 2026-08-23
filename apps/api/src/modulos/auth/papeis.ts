import type { Papel } from '@agendamento/dominio';

/** Os rótulos canônicos de 2.1 do conteúdo. */
const POR_EXTENSO: Record<Papel, string> = {
  PROPRIETARIO: 'Proprietário',
  ADMIN: 'Admin',
  FUNCIONARIO: 'Funcionário',
};

export function papelPorExtenso(papel: Papel): string {
  return POR_EXTENSO[papel];
}
