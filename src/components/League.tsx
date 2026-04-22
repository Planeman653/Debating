import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Trophy, Medal, Crown } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function League() {
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('totalPoints', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });
    return () => unsub();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Global League</h2>
        <p className="text-slate-400">See how your squad scores stack up against the best.</p>
      </header>

      {/* Podium */}
      <div className="flex flex-col md:flex-row items-end justify-center gap-4 py-8">
        {[1, 0, 2].map((idx) => {
          const user = users[idx];
          if (!user) return null;
          const isWinner = idx === 0;
          return (
            <motion.div
              key={user.uid}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className={cn(
                "flex flex-col items-center flex-1 max-w-[200px]",
                idx === 0 ? "order-2" : idx === 1 ? "order-1" : "order-3"
              )}
            >
              <div className="relative mb-4">
                <div className={cn(
                  "w-20 h-20 rounded-full border-4 flex items-center justify-center overflow-hidden bg-slate-800 shadow-2xl shadow-indigo-500/10",
                  idx === 0 ? "border-amber-400 w-24 h-24" : idx === 1 ? "border-slate-400" : "border-amber-700"
                )}>
                  {idx === 0 && <Crown className="absolute -top-8 text-amber-400 w-10 h-10 drop-shadow-lg" />}
                  <span className="text-3xl font-bold">{user.displayName[0]}</span>
                </div>
                <div className={cn(
                  "absolute -bottom-2 translate-x-1/2 right-1/2 w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center font-bold text-xs",
                  idx === 0 ? "bg-amber-400 text-slate-900" : idx === 1 ? "bg-slate-400 text-slate-900" : "bg-amber-700 text-white"
                )}>
                  {idx + 1}
                </div>
              </div>
              <h4 className="font-bold text-center mb-1 truncate w-full">{user.displayName}</h4>
              <p className="text-indigo-400 font-mono font-bold">{user.totalPoints} PTS</p>
              <div className={cn(
                "w-full bg-slate-900 border-x border-t border-slate-800 rounded-t-2xl mt-4",
                idx === 0 ? "h-32" : idx === 1 ? "h-24" : "h-20"
              )} />
            </motion.div>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
         <table className="w-full text-left">
            <thead>
               <tr className="bg-slate-800/50 text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                  <th className="px-6 py-4">Rank</th>
                  <th className="px-6 py-4">Player</th>
                  <th className="px-6 py-4 text-right">Points</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
               {users.map((user, idx) => (
                 <tr key={user.uid} className="hover:bg-slate-950/50 transition-colors group">
                    <td className="px-6 py-4">
                       <span className={cn(
                         "font-mono font-bold",
                         idx < 3 ? "text-indigo-400" : "text-slate-500"
                       )}>
                          #{idx + 1}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                            idx < 3 ? "bg-indigo-600 shadow-lg shadow-indigo-600/20" : "bg-slate-800"
                          )}>
                             {user.displayName[0]}
                          </div>
                          <span className="font-semibold">{user.displayName}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <span className="font-mono font-bold text-indigo-400">{user.totalPoints}</span>
                    </td>
                 </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
}
