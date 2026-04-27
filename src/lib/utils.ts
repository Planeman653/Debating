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

export function isAutoLocked(rounds: { deadline: string; status: string }[], state: { isLocked: boolean, lockMode?: 'auto' | 'manual-locked' | 'manual-unlocked' } | null) {
  // Manual overrides first
  if (state?.lockMode === 'manual-locked') return true;
  if (state?.lockMode === 'manual-unlocked') return false;
  
  // If no advanced lockMode, fallback to legacy isLocked (which basically acts as a manual toggle)
  if (state && !state.lockMode && state.isLocked) return true;

  // Now check auto-lock if mode is 'auto' (or no mode but state exists)
  // Usually default to auto unless manual-unlocked is set
  const upcomingRounds = rounds.filter(r => r.status === 'upcoming');
  if (upcomingRounds.length === 0) return false;

  const nextRound = upcomingRounds.sort((a, b) => 
    new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  )[0];

  const deadline = new Date(nextRound.deadline).getTime();
  const now = new Date().getTime();
  const thirtyMinutes = 30 * 60 * 1000;

  return (deadline - thirtyMinutes) <= now;
}
