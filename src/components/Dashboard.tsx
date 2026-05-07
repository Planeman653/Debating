import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Round, SystemState, Debater } from '../types';
import { differenceInSeconds } from 'date-fns';
import { Timer, Trophy, AlertCircle, Lock, Clock, Users } from 'lucide-react';
import { isAutoLocked } from '../lib/utils';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface DashboardProps {
  user: any;
  systemState: SystemState | null;
}

export default function Dashboard({ systemState }: DashboardProps) {
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [allRounds, setAllRounds] = useState<Round[]>([]);
  const [debaters, setDebaters] = useState<Debater[]>([]);
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rounds'), (snapshot) => {
      const rounds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Round));
      setAllRounds(rounds);
      
      // Authoritative round from systemState if valid and not completed
      const stateRound = rounds.find(r => r.id === systemState?.currentRoundId);
      if (stateRound && (stateRound.status === 'active' || stateRound.status === 'upcoming')) {
        setCurrentRound(stateRound);
      } else {
        const activeOrUpcoming = rounds.filter(r => ['upcoming', 'active'].includes(r.status));
        const sorted = activeOrUpcoming.sort((a, b) => a.roundNumber - b.roundNumber);
        setCurrentRound(sorted[0] || null);
      }
    });
    return () => unsub();
  }, [systemState?.currentRoundId]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'debaters'), (snapshot) => {
      setDebaters(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Debater)));
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

  const lineup = currentRound?.selectedDebaterIds?.map(id => debaters.find(d => d.id === id)).filter(Boolean) as Debater[] || [];
  const governmentLineup = lineup.filter(d => d.team === 'A');
  const oppositionLineup = lineup.filter(d => d.team === 'B');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Debate Dashboard</h2>
        <p className="text-slate-400">Track current round status and upcoming deadlines.</p>
      </header>

      {currentRound ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 h-full flex flex-col justify-center">
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
            </div>
          </div>

          {/* Lineup Section */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 pt-4"
          >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-xl">
                      <Users className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h3 className="text-xl font-bold">Today's Starting Lineup</h3>
                </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {[
                    { title: 'Government (Team A)', members: governmentLineup, color: 'indigo', isBye: currentRound.byeTeam === 'A' },
                    { title: 'Opposition (Team B)', members: oppositionLineup, color: 'amber', isBye: currentRound.byeTeam === 'B' }
                 ].map((side) => (
                    <div key={side.title} className={cn("bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4", side.isBye && "opacity-60")}>
                       <div className="flex justify-between items-center">
                          <h4 className={cn("text-[10px] font-black uppercase tracking-[0.2em]", side.color === 'indigo' ? "text-indigo-400" : "text-amber-400")}>
                             {side.title}
                          </h4>
                          {side.isBye && (
                             <span className="text-[10px] font-black bg-slate-800 px-2 py-0.5 rounded text-slate-400">BYE</span>
                          )}
                       </div>
                       <div className="space-y-3">
                          {side.members.length > 0 ? (
                             side.members.map(member => (
                                <div key={member.id} className="flex items-center gap-3 group">
                                   <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 p-0.5 overflow-hidden">
                                      {member.imageUrl ? (
                                         <img src={member.imageUrl} className="w-full h-full object-cover rounded-full" />
                                      ) : (
                                         <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 rounded-full">
                                            {member.name[0]}
                                         </div>
                                      )}
                                   </div>
                                   <span className="font-bold text-slate-200 group-hover:text-white transition-colors">{member.name}</span>
                                </div>
                             ))
                          ) : (
                             <p className="text-[10px] text-slate-600 italic">
                                {side.isBye ? 'This team has a bye this round.' : 'No lineup selected yet.'}
                             </p>
                          )}
                       </div>
                    </div>
                 ))}
              </div>
            </motion.section>
        </>
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
