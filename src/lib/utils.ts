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

export function isAutoLocked(rounds: { roundNumber: number; deadline: string; status: string }[], state: { isLocked: boolean, lockMode?: 'auto' | 'manual-locked' | 'manual-unlocked' } | null) {
  // Manual overrides first
  if (state?.lockMode === 'manual-locked') return true;
  if (state?.lockMode === 'manual-unlocked') return false;
  
  // 1. If any round is 'active', the market is always locked (debate is ongoing)
  if (rounds.some(r => r.status === 'active')) return true;

  // 2. Find the earliest 'upcoming' round by roundNumber to determine today's lock
  const upcomingSorted = rounds
    .filter(r => r.status === 'upcoming')
    .sort((a, b) => a.roundNumber - b.roundNumber);

  if (upcomingSorted.length === 0) return false;

  const nextRound = upcomingSorted[0];
  const deadline = new Date(nextRound.deadline).getTime();
  const now = new Date().getTime();
  const thirtyMinutes = 30 * 60 * 1000;
  const sixHours = 6 * 60 * 60 * 1000;

  // If the deadline is ancient (e.g. more than 6 hours ago) and not started, 
  // assume it's a stale date and don't auto-lock.
  if (now > (deadline + sixHours)) return false;

  // Lock if deadline is within 30 minutes (or has already passed)
  return now >= (deadline - thirtyMinutes);
}
