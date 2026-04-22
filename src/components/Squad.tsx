import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Debater, Team, SystemState, UserProfile } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { Trash2, Plus, Wallet, ShieldCheck, Lock, TriangleAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface SquadProps {
  user: any;
  systemState: SystemState | null;
  profile: UserProfile | null;
}

export default function Squad({ user, systemState, profile }: SquadProps) {
  const [team, setTeam] = useState<Team | null>(null);
  const [allDebaters, setAllDebaters] = useState<Debater[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubTeam = onSnapshot(doc(db, 'teams', user.uid), (docComp) => {
      if (docComp.exists()) {
        const data = docComp.data() as Team;
        // Migration check if old field exists
        if ('budgetSpent' in data) {
           const initial = systemState?.initialBudget || 50;
           setTeam({ ...data, walletBalance: initial - (data as any).budgetSpent });
        } else {
           setTeam(data);
        }
      } else {
        // Init team
        const newTeam: Team = {
          userId: user.uid,
          debaterIds: [],
          walletBalance: systemState?.initialBudget || 50,
          totalPoints: 0,
          updatedAt: new Date().toISOString()
        };
        setTeam(newTeam);
      }
      setLoading(false);
    });

    const unsubDebaters = onSnapshot(collection(db, 'debaters'), (snapshot) => {
      setAllDebaters(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Debater)));
    });

    return () => {
      unsubTeam();
      unsubDebaters();
    };
  }, [user.uid, systemState?.initialBudget]);

  const squadDebaters = allDebaters.filter(d => team?.debaterIds.includes(d.id));
  const currentWallet = team?.walletBalance ?? 50;

  const addToSquad = async (debater: Debater) => {
    if (systemState?.isLocked) return toast.error('Teams are currently locked!');
    if (!team) return;
    if (team.debaterIds.length >= 3) return toast.error('Your squad is full! (Max 3)');
    if (team.debaterIds.includes(debater.id)) return toast.error('Already in your squad!');
    
    if (currentWallet < debater.price) {
       return toast.error('Insufficient budget!');
    }

    try {
      const newIds = [...team.debaterIds, debater.id];
      const newBalance = currentWallet - debater.price;
      await setDoc(doc(db, 'teams', user.uid), {
        ...team,
        debaterIds: newIds,
        walletBalance: Number(newBalance.toFixed(1)),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success(`${debater.name} added to squad!`);
    } catch (err) {
      toast.error('Failed to update squad.');
    }
  };

  const removeFromSquad = async (debater: Debater) => {
    if (systemState?.isLocked) return toast.error('Teams are currently locked!');
    if (!team) return;
    
    try {
      const newIds = team.debaterIds.filter(id => id !== debater.id);
      const newBalance = currentWallet + debater.price;
      await updateDoc(doc(db, 'teams', user.uid), {
        debaterIds: newIds,
        walletBalance: Number(newBalance.toFixed(1)),
        updatedAt: new Date().toISOString()
      });
      toast.success(`${debater.name} removed from squad.`);
    } catch (err) {
      toast.error('Failed to update squad.');
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Squad</h2>
          <p className="text-slate-400">Manage your dream team of 3 debaters.</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 shadow-xl">
           <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-none mb-1">Remaining Budget</span>
              <div className="flex items-center gap-2">
                 <Wallet className="w-4 h-4 text-indigo-500" />
                 <span className="text-xl font-mono font-bold">{formatCurrency(currentWallet)}</span>
              </div>
           </div>
        </div>
      </header>

      {/* Squad Display */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
         <AnimatePresence mode="popLayout">
            {[0, 1, 2].map((idx) => {
               const debater = squadDebaters[idx];
               return (
                 <motion.div 
                   key={debater?.id || `empty-${idx}`}
                   layout
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.9 }}
                   className={cn(
                     "aspect-square sm:aspect-[4/5] rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center relative transition-all overflow-hidden",
                     debater 
                        ? "bg-slate-900 border-indigo-500/30 border-solid shadow-2xl shadow-indigo-500/10" 
                        : "bg-slate-900/20 border-slate-800 hover:border-slate-700"
                   )}
                 >
                    {debater ? (
                       <>
                          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-indigo-500/10 to-transparent" />
                          <div className="absolute top-3 left-3 md:top-4 md:left-4 z-20">
                             <span className={cn(
                                "text-[8px] md:text-[10px] font-black px-2 py-1 rounded bg-slate-950/80 border",
                                debater.team === 'A' ? "text-indigo-400 border-indigo-400/20" : "text-amber-400 border-amber-400/20"
                             )}>
                                TEAM {debater.team}
                             </span>
                          </div>
                          <div className="relative mt-4 md:mt-8 mb-2 md:mb-4">
                             <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-800 border-4 border-indigo-500/20 overflow-hidden shadow-2xl">
                                {debater.imageUrl ? (
                                   <img src={debater.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                   <div className="w-full h-full flex items-center justify-center text-2xl md:text-3xl font-bold text-indigo-500">
                                      {debater.name[0]}
                                   </div>
                                )}
                             </div>
                             <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-[8px] md:text-[10px] font-black px-2 py-1 rounded-full border-2 border-slate-900">
                                LVL 1
                             </div>
                          </div>
                          <h4 className="font-bold text-lg md:text-xl mb-1 px-4 text-center">{debater.name}</h4>
                          <span className="text-indigo-400 font-mono font-bold mb-3 md:mb-4 text-sm md:text-base">{formatCurrency(debater.price)}</span>
                          
                          <div className="grid grid-cols-2 gap-2 w-full px-4 md:px-6 mb-4 md:mb-6">
                             <div className="bg-slate-950/50 rounded-xl p-1.5 md:p-2 text-center border border-slate-800/50">
                                <span className="text-[8px] md:text-[10px] text-slate-500 font-bold block uppercase tracking-tighter">Points</span>
                                <span className="text-xs md:text-sm font-black">{debater.totalPoints}</span>
                             </div>
                             <div className="bg-slate-950/50 rounded-xl p-1.5 md:p-2 text-center border border-slate-800/50">
                                <span className="text-[8px] md:text-[10px] text-slate-500 font-bold block uppercase tracking-tighter">Last</span>
                                <span className="text-xs md:text-sm font-black text-indigo-400">{debater.lastRoundPoints}</span>
                             </div>
                          </div>

                          <button 
                            disabled={systemState?.isLocked}
                            onClick={() => removeFromSquad(debater)}
                            className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mb-4 md:mb-6"
                          >
                             <Trash2 className="w-3.5 h-3.5" />
                             Release
                          </button>
                       </>
                    ) : (
                       <div className="flex flex-col items-center gap-4 text-slate-600">
                          <div className="w-16 h-16 rounded-full border-4 border-slate-800 bg-slate-900/50 flex items-center justify-center">
                             <Plus className="w-8 h-8" />
                          </div>
                          <p className="text-xs font-bold uppercase tracking-widest">Empty Slot</p>
                       </div>
                    )}
                 </motion.div>
               );
            })}
         </AnimatePresence>
      </section>

      {systemState?.isLocked && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 text-amber-500 shadow-lg shadow-amber-500/5">
           <Lock className="w-6 h-6 shrink-0" />
           <div>
              <h5 className="font-black uppercase tracking-wider text-sm">Squad Locked</h5>
              <p className="text-xs opacity-80">The round is in progress. Transfers are disabled until the next round opens.</p>
           </div>
        </div>
      )}

      {/* Available for Draft */}
      {!systemState?.isLocked && (
        <section className="space-y-4">
           <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                 <ShieldCheck className="w-5 h-5 text-indigo-500" />
                 Draft New Talent
              </h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Budget: {formatCurrency(currentWallet)}</p>
           </div>
           
           <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden divide-y divide-slate-800">
              {allDebaters
                .filter(d => !team?.debaterIds.includes(d.id))
                .sort((a,b) => b.price - a.price)
                .map(d => (
                  <div key={d.id} className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors group">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700 relative">
                           {d.imageUrl ? <img src={d.imageUrl} className="w-full h-full object-cover" alt="" /> : <span className="text-sm font-bold">{d.name[0]}</span>}
                           <div className={cn(
                             "absolute bottom-0 right-0 w-3 h-3 border border-slate-900 rounded-full",
                             d.team === 'A' ? "bg-indigo-500" : "bg-amber-500"
                           )} />
                        </div>
                        <div>
                           <h5 className="font-bold text-sm group-hover:text-indigo-400 transition-colors uppercase flex items-center gap-2">
                             {d.name}
                             <span className={cn(
                               "text-[8px] font-black px-1 rounded",
                               d.team === 'A' ? "text-indigo-400 bg-indigo-400/10" : "text-amber-400 bg-amber-400/10"
                             )}>T{d.team}</span>
                           </h5>
                           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Points: {d.totalPoints}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-6">
                        <span className="font-mono font-bold text-indigo-400">{formatCurrency(d.price)}</span>
                        <button 
                          onClick={() => addToSquad(d)}
                          disabled={currentWallet < d.price || (team?.debaterIds.length || 0) >= 3}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
                        >
                           Draft
                        </button>
                     </div>
                  </div>
                ))}
           </div>
        </section>
      )}
    </div>
  );
}
