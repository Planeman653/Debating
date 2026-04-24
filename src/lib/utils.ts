import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value).replace('$', 'Ð '); // Debate tokens? Let's use Ð
}

export function calculateLevel(points: number) {
  if (points >= 500) return 5;
  if (points >= 250) return 4;
  if (points >= 125) return 3;
  if (points >= 50) return 2;
  return 1;
}
