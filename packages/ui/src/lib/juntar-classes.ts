import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `juntarClasses`, não `cn` (4.1). O `twMerge` resolve conflito entre
 * utilitárias — a última vence — para que compor um componente por fora não
 * dependa da ordem em que as classes entraram na string.
 */
export function juntarClasses(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}
