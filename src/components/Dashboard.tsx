import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Round, SystemState } from '../types';
import { differenceInSeconds } from 'date-fns';
import { Timer, Trophy, AlertCircle, Lock, Clock } from 'lucide-react';
import { isAutoLocked } from '../lib/utils';
import { motion } from 'motion/react';

interface DashboardProps {
  user: any;
  systemState: SystemState | null;
}

export default function Dashboard({ systemState }: DashboardProps) {
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [allRounds, setAllRounds] = useState<Round[]>([]);
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rounds'), (snapshot) => {
      const rounds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Round));
      setAllRounds(rounds);
      
      const activeOrUpcoming = rounds.filter(r => ['upcoming', 'active'].includes(r.status));
      const sorted = activeOrUpcoming.sort((a, b) => a.roundNumber - b.roundNumber);
      setCurrentRound(sorted[0] || null);
    });
    return () => unsub();
  }, []);

  const isLocked = isAutoLocked(allRounds, systemState);

  const nextRoundForLock = allRounds
    .filter(r => r.status === 'upcoming')
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0];
  
  const lockTime = nextRoundForLock ? new Date(nextRoundForLock.deadline).getTime() - (30 * 60 * 1000) : null;
  const isPendingLock = lockTime && !isLocked && (lockTime > Date.now());

  useEffect(() => {
    if (!currentRound) return;

    const timer = setInterval(() => {
      const now = new Date();
      const deadline = new Date(currentRound.deadline);
      const diff = differenceInSeconds(deadline, now);

      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        clearInterval(timer);
      } else {
        setTimeLeft({
          d: Math.floor(diff / (3600 * 24)),
          h: Math.floor((diff % (3600 * 24)) / 3600),
          m: Math.floor((diff % 3600) / 60),
          s: diff % 60
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentRound]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Debate Dashboard</h2>
        <p className="text-slate-400">Track current round status and upcoming deadlines.</p>
      </header>

      {currentRound ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
          {/* Countdown Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-600/10 border border-indigo-500/20 rounded-3xl p-6 md:p-8 flex flex-col items-center justify-center text-center relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Timer className="w-24 md:w-32 h-24 md:h-32 rotate-12" />
            </div>
            
            <span className="text-indigo-400 font-bold mb-2 uppercase tracking-widest text-[10px] md:text-xs">Round {currentRound.roundNumber} Deadline</span>
            <h3 className="text-lg md:text-xl font-bold mb-6 px-2">{currentRound.topic}</h3>

            <div className="flex gap-2 md:gap-4">
              {[
                { label: 'Days', val: timeLeft?.d ?? 0 },
                { label: 'Hours', val: timeLeft?.h ?? 0 },
                { label: 'Mins', val: timeLeft?.m ?? 0 },
                { label: 'Secs', val: timeLeft?.s ?? 0 },
              ].map((t) => (
                <div key={t.label} className="flex flex-col items-center">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl w-14 md:w-16 h-14 md:h-16 flex items-center justify-center text-xl md:text-2xl font-black text-indigo-400 shadow-inner">
                    {t.val.toString().padStart(2, '0')}
                  </div>
                  <span className="text-[8px] md:text-[10px] mt-2 text-slate-500 uppercase font-bold tracking-tighter">{t.label}</span>
                </div>
              ))}
            </div>

            {isLocked && (
              <div className="mt-8 flex items-center gap-2 text-amber-500 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20 text-xs font-bold uppercase tracking-wider">
                <Lock className="w-4 h-4" />
                {systemState?.lockMode === 'manual-locked' ? "SQUADS MANUALLY LOCKED" : "SQUADS AUTO-LOCKED (-30m)"}
              </div>
            )}
            
            {isPendingLock && (
              <div className="mt-8 flex items-center gap-2 text-emerald-400 bg-emerald-400/5 px-4 py-2 rounded-full border border-emerald-400/10 text-[10px] font-bold uppercase tracking-widest">
                <Clock className="w-3.5 h-3.5" />
                Squads lock 30m before round
              </div>
            )}
          </motion.div>

          {/* Stats/Quick Info */}
          <div className="space-y-6">
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <div className="flex items-center gap-4 mb-4">
                   <div className="p-3 bg-indigo-500/10 rounded-2xl">
                      <Trophy className="w-6 h-6 text-indigo-500" />
                   </div>
                   <div>
                      <h4 className="font-bold">Active Round</h4>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">{currentRound.status}</p>
                   </div>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Topic</span>
                      <span className="font-medium text-right ml-4">{currentRound.topic}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Round</span>
                      <span className="font-medium">#{currentRound.roundNumber}</span>
                   </div>
                </div>
             </div>

             <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-indigo-500/20 rounded-3xl p-6">
                <h4 className="font-bold mb-2">Did you know?</h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                   Debater prices fluctuate based on their performance in the previous round. Sell high and buy low to increase your total budget!
                </p>
             </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-900/50 border border-slate-800 rounded-3xl border-dashed">
          <Trophy className="w-12 h-12 text-slate-700 mb-4" />
          <p className="text-slate-500 font-medium">No active rounds at the moment.</p>
          <p className="text-sm text-slate-600 mt-1">Check back soon for the next debate match!</p>
        </div>
      )}
    </div>
  );
}
