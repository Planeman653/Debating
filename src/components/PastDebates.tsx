import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Round, Debater } from '../types';
import { Calendar, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function PastDebates() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [debaters, setDebaters] = useState<Record<string, Debater>>({});

  useEffect(() => {
    const q = query(collection(db, 'rounds'), orderBy('roundNumber', 'desc'));
    const unsubRounds = onSnapshot(q, (snapshot) => {
      setRounds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Round)));
    });

    const unsubDebaters = onSnapshot(collection(db, 'debaters'), (snapshot) => {
      const data: Record<string, Debater> = {};
      snapshot.docs.forEach(doc => {
        data[doc.id] = { id: doc.id, ...doc.data() } as Debater;
      });
      setDebaters(data);
    });

    return () => {
      unsubRounds();
      unsubDebaters();
    };
  }, []);

  const completedRounds = rounds.filter(r => r.status === 'completed');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Debate Archives</h2>
        <p className="text-slate-400">Review outcomes and performance from past rounds.</p>
      </header>

      {completedRounds.length > 0 ? (
        <div className="space-y-6">
          {completedRounds.map((round) => (
            <motion.div 
              key={round.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden"
            >
              <div className="bg-slate-800/50 p-6 border-b border-slate-800 flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold">
                       #{round.roundNumber}
                    </div>
                    <div>
                       <h3 className="font-bold text-lg">{round.topic}</h3>
                       <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">
                          Outcome: <span className={cn(
                            round.winnerSide === 'Government' ? 'text-indigo-400' : 
                            round.winnerSide === 'Opposition' ? 'text-amber-400' : 'text-slate-400'
                          )}>{round.winnerSide}</span>
                       </p>
                    </div>
                 </div>
                 <div className="text-right text-xs text-slate-500 font-bold uppercase">
                    {new Date(round.deadline).toLocaleDateString()}
                 </div>
              </div>

              <div className="p-6">
                 <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">Round Results</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(round.debaterScores || {}).map(([debaterId, score]) => {
                       const d = debaters[debaterId];
                       const s = score as number;
                       if (!d) return null;
                       return (
                          <div key={debaterId} className="bg-slate-950/50 border border-slate-800 p-3 rounded-2xl flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                                   {d.imageUrl ? <img src={d.imageUrl} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold flex items-center justify-center h-full">{d.name[0]}</span>}
                                </div>
                                <span className="text-sm font-bold truncate max-w-[100px]">{d.name}</span>
                             </div>
                             <span className={cn(
                                "font-mono font-bold",
                                s > 0 ? "text-emerald-500" : s < 0 ? "text-red-500" : "text-slate-500"
                             )}>
                                {s > 0 ? `+${s}` : s}
                             </span>
                          </div>
                       );
                    })}
                 </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-900/50 border border-slate-800 rounded-3xl border-dashed">
          <Calendar className="w-12 h-12 text-slate-700 mb-4 mx-auto" />
          <p className="text-slate-500">History will be written after the first round concludes.</p>
        </div>
      )}
    </div>
  );
}
