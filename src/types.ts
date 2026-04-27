export interface Debater {
  id: string;
  name: string;
  team: 'A' | 'B';
  price: number;
  totalPoints: number;
  lastRoundPoints: number;
  bio?: string;
  imageUrl?: string;
}

export interface Round {
  id: string;
  roundNumber: number;
  topic: string;
  deadline: string; // ISO String
  status: 'upcoming' | 'active' | 'completed';
  winnerSide?: 'Government' | 'Opposition' | 'Draw';
  debaterScores?: Record<string, number>; // debaterId -> points
}

export interface Team {
  userId: string;
  debaterIds: string[];
  walletBalance: number;
  totalPoints: number;
  updatedAt: string;
}

export interface SystemState {
  isLocked: boolean; // Backwards compatible / legacy
  lockMode?: 'auto' | 'manual-locked' | 'manual-unlocked';
  currentRoundId: string;
  initialBudget: number;
  isVotingOpen?: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  totalPoints: number;
}
