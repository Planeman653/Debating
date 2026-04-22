import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot, query } from 'firebase/firestore';
import { Debater, SystemState } from '../types';
import { Vote, Star, CheckCircle2, Trophy, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

interface VotingProps {
  user: any;
  systemState: SystemState | null;
}

export default function Voting({ user, systemState }: VotingProps) {
  const [debaters, setDebaters] = useState<Debater[]>([]);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for debaters
    const unsubD = onSnapshot(collection(db, 'debaters'), (snap) => {
      setDebaters(snap.docs.map(d => ({ id: d.id, ...d.data() } as Debater)));
    });

    // Listen for my vote
    const unsubV = onSnapshot(doc(db, 'votes', user.uid), (snap) => {
      if (snap.exists()) setMyVote(snap.data().debaterId);
      else setMyVote(null);
    });

    // Listen for all votes to calculate results
    const unsubAllV = onSnapshot(collection(db, 'votes'), (snap) => {
      const counts: Record<string, number> = {};
      snap.docs.forEach(doc => {
        const { debaterId } = doc.data();
        counts[debaterId] = (counts[debaterId] || 0) + 1;
      });
      setVoteCounts(counts);
      setLoading(false);
    });

    return () => {
      unsubD();
      unsubV();
      unsubAllV();
    };
  }, [user.uid]);

  const castVote = async (debaterId: string) => {
    if (!systemState?.isVotingOpen) return toast.error('Voting is currently closed.');
    try {
      await setDoc(doc(db, 'votes', user.uid), {
        debaterId,
        voterName: user.displayName,
        timestamp: new Date().toISOString()
      });
      toast.success('Vote cast!');
    } catch (err) {
      toast.error('Failed to cast vote.');
    }
  };

  if (loading) return null;

  const isVotingOpen = systemState?.isVotingOpen;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
           <div className="bg-indigo-600 p-2 rounded-xl">
              <Vote className="w-6 h-6 text-white" />
           </div>
           <h2 className="text-3xl font-black tracking-tighter uppercase italic">Debater of the Day</h2>
        </div>
        <p className="text-slate-400">Cast your vote for the most impactful speaker of the current match.</p>
      </header>

      {!isVotingOpen && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
           <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
              <Trophy className="w-8 h-8 text-slate-600" />
           </div>
           <h3 className="text-xl font-bold">Voting is Closed</h3>
           <p className="text-slate-500 max-w-md mx-auto">Results are finalized or voting hasn't started yet for this round. Check back during the live session!</p>
        </div>
      )}

      {isVotingOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20 md:pb-0">
           {debaters.map((d) => {
              const hasVotedForThis = myVote === d.id;
              const votes = voteCounts[d.id] || 0;
              
              return (
                <motion.div
                  key={d.id}
                  whileHover={{ y: -4 }}
                  className={cn(
                    "relative bg-slate-900 border-2 rounded-[2.5rem] p-6 transition-all overflow-hidden group",
                    hasVotedForThis ? "border-indigo-500 shadow-2xl shadow-indigo-500/20" : "border-slate-800 hover:border-slate-700"
                  )}
                >
                   {hasVotedForThis && (
                     <div className="absolute top-0 right-0 p-4">
                        <CheckCircle2 className="w-6 h-6 text-indigo-500" />
                     </div>
                   )}

                   <div className="flex flex-col items-center text-center space-y-4 relative z-10">
                      <div className="w-20 h-20 rounded-full bg-slate-800 border-4 border-slate-950 overflow-hidden shadow-xl mb-2">
                         {d.imageUrl ? (
                           <img src={d.imageUrl} className="w-full h-full object-cover" alt="" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-slate-600">
                             {d.name[0]}
                           </div>
                         )}
                      </div>
                      
                      <div>
                         <h4 className="font-bold text-lg">{d.name}</h4>
                         <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                            d.team === 'A' ? "bg-indigo-500/10 text-indigo-400" : "bg-amber-500/10 text-amber-400"
                         )}>Team {d.team}</span>
                      </div>

                      <div className="flex flex-col items-center gap-1 w-full bg-slate-950/50 rounded-2xl py-3 border border-slate-800/50">
                         <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Current Votes</span>
                         <span className="text-2xl font-mono font-black text-indigo-400">{votes}</span>
                      </div>

                      <button
                        onClick={() => castVote(d.id)}
                        disabled={hasVotedForThis}
                        className={cn(
                          "w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg",
                          hasVotedForThis 
                            ? "bg-slate-800 text-slate-500 cursor-default" 
                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 active:scale-95"
                        )}
                      >
                         {hasVotedForThis ? 'Already Voted' : 'Cast Vote'}
                      </button>
                   </div>
                </motion.div>
              );
           })}
        </div>
      )}
    </div>
  );
}
