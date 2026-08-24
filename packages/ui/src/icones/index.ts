/**
 * Todo ícone passa por aqui; nenhuma aplicação importa direto do Lucide (3.2).
 * Trocar o conjunto passa a ser um arquivo, e o inventário do que está em uso
 * fica visível num lugar só.
 *
 * A referência de desenho usa Iconsax; o conjunto adotado em código é o Lucide,
 * de traço equivalente, com tree-shaking real e manutenção ativa.
 *
 * O nome descreve o **desenho**, nunca o significado no produto: `IconePessoa`,
 * não `IconeCliente`. Quem sabe que aquela pessoa é um cliente é a aplicação —
 * `packages/ui` não conhece domínio (D8).
 */

export type { LucideIcon as Icone } from 'lucide-react';
export {
  AlertCircle as IconeAlerta,
  AlertTriangle as IconeAtencao,
  ArrowLeft as IconeVoltar,
  ArrowRight as IconeAvancar,
  Ban as IconeProibido,
  Calendar as IconeCalendario,
  CalendarX as IconeCalendarioVazio,
  Check as IconeConfirmar,
  CheckCircle2 as IconeSucesso,
  ChevronDown as IconeAbrir,
  ChevronLeft as IconeAnterior,
  ChevronRight as IconeProximo,
  ChevronUp as IconeFechar,
  Clock as IconeHorario,
  Copy as IconeCopiar,
  CreditCard as IconeCartao,
  Ellipsis as IconeReticencias,
  Eye as IconeVer,
  EyeOff as IconeOcultar,
  Info as IconeInformacao,
  LoaderCircle as IconeCarregando,
  LogOut as IconeSair,
  Menu as IconeMenu,
  Minus as IconeMenos,
  Pencil as IconeEditar,
  Plus as IconeMais,
  Search as IconeBuscar,
  Settings as IconeConfiguracoes,
  Store as IconeLoja,
  Trash2 as IconeRemover,
  User as IconePessoa,
  Users as IconePessoas,
  UserX as IconePessoaAusente,
  X as IconeCancelar,
} from 'lucide-react';
