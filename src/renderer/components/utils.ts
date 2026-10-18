/**
 * utils.ts — Utilidades de clases CSS
 *
 * `cn()` combina clsx (clases condicionales) con tailwind-merge (resuelve
 * conflictos entre clases Tailwind quedándose con la última declarada).
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
