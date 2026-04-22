import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Debater } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { Search, Trophy } from 'lucide-react';
import { motion } from 'motion/react';

export default function Rankings() {
  const [debaters, setDebaters] = useState<Debater[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'totalPoints' | 'price'>('totalPoints');
  
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'debaters'), (snapshot) => {
      setDebaters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debater)));
    });
    return () => unsub();
  }, []);

  const filtered = debaters
    .filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'price') return b.price - a.price;
      return b.totalPoints - a.totalPoints;
    });

  const getTeamStats = (team: 'A' | 'B') => {
     const members = debaters.filter(d => d.team === team);
     return {
        count: members.length,
        totalPoints: members.reduce((s, d) => s + d.totalPoints, 0),
        topDebater: members.sort((a, b) => b.totalPoints - a.totalPoints)[0]
     };
  };

  const statsA = getTeamStats('A');
  const statsB = getTeamStats('B');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Team Standings & Rankings</h2>
          <p className="text-slate-400">Fixed rosters: Government vs Opposition global performance.</p>
        </div>
      </header>

      {/* TEAM STANDINGS TOP */}
      <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-amber-500/5 opacity-50 pointer-events-none" />
         
         <div className="relative z-10 grid grid-cols-1 md:grid-cols-7 items-center gap-6 md:gap-8">
            {/* Team A Points */}
            <div className="md:col-span-3 text-center space-y-4">
               <span className="text-[9px] md:text-[10px] font-black tracking-[0.2em] uppercase text-indigo-400 bg-indigo-400/10 px-4 py-1.5 rounded-full border border-indigo-400/20">Government (Team A)</span>
               <div className="flex flex-col items-center">
                  <span className="text-5xl md:text-7xl font-mono font-black text-white tracking-widest">{statsA.totalPoints}</span>
                  <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase mt-1">Total Team Points</p>
               </div>
               <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                  <div className="text-left">
                     <p className="text-[10px] text-slate-500 font-bold uppercase">Members</p>
                     <p className="font-bold text-sm">{statsA.count}</p>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] text-slate-500 font-bold uppercase">Top Debater</p>
                     <p className="font-bold text-sm text-indigo-400 truncate max-w-[80px] md:max-w-none">{statsA.topDebater?.name || 'N/A'}</p>
                  </div>
               </div>
            </div>

            {/* VS CENTER */}
            <div className="md:col-span-1 flex flex-col items-center py-2 md:py-0">
               <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-slate-950 border-2 border-slate-800 flex items-center justify-center font-black italic text-slate-600 shadow-2xl rotate-12">
                  <span className="-rotate-12 text-sm md:text-base">VS</span>
               </div>
            </div>

            {/* Team B Points */}
            <div className="md:col-span-3 text-center space-y-4">
               <span className="text-[9px] md:text-[10px] font-black tracking-[0.2em] uppercase text-amber-400 bg-amber-400/10 px-4 py-1.5 rounded-full border border-amber-400/20">Opposition (Team B)</span>
               <div className="flex flex-col items-center">
                  <span className="text-5xl md:text-7xl font-mono font-black text-white tracking-widest">{statsB.totalPoints}</span>
                  <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase mt-1">Total Team Points</p>
               </div>
               <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                  <div className="text-left">
                     <p className="text-[10px] text-slate-500 font-bold uppercase">Members</p>
                     <p className="font-bold text-sm">{statsB.count}</p>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] text-slate-500 font-bold uppercase">Top Debater</p>
                     <p className="font-bold text-sm text-amber-400 truncate max-w-[80px] md:max-w-none">{statsB.topDebater?.name || 'N/A'}</p>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* DEBATER LEADERBOARD BELOW */}
      <section className="space-y-6">
         <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 pb-4 gap-4">
            <div className="flex items-center gap-3">
               <Trophy className="w-6 h-6 text-indigo-500" />
               <h3 className="text-xl font-bold tracking-tight">Debater Leaderboard</h3>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none transition-all w-32 md:w-48"
                  />
               </div>
               <button 
                 onClick={() => setSortBy(sortBy === 'totalPoints' ? 'price' : 'totalPoints')}
                 className="text-[10px] font-black text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-widest bg-slate-900/50 px-3 py-2 rounded-xl border border-slate-800"
               >
                  {sortBy === 'totalPoints' ? 'Points' : 'Price'}
               </button>
            </div>
         </div>

         <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-x-auto shadow-2xl">
            <table className="w-full text-left min-w-[600px]">
               <thead>
                  <tr className="bg-slate-800/50 text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                     <th className="px-6 py-4 w-20 text-center">Rank</th>
                     <th className="px-6 py-4">Debater</th>
                     <th className="px-6 py-4 text-right">Last Rd</th>
                     <th className="px-6 py-4 text-right">Market Value</th>
                     <th className="px-6 py-4 text-right">Total Points</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-800">
                  {filtered.map((d, idx) => {
                     return (
                        <tr 
                          key={d.id} 
                          className={cn(
                            "group transition-all hover:bg-slate-950/50",
                            d.team === 'A' ? "bg-indigo-600/5" : "bg-amber-600/5"
                          )}
                        >
                           <td className="px-6 py-4 text-center">
                              <span className={cn(
                                "font-mono font-bold",
                                idx === 0 ? "text-amber-400 text-lg" : idx < 3 ? "text-indigo-400" : "text-slate-500 text-xs"
                              )}>
                                 #{idx + 1}
                              </span>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                                    {d.imageUrl ? <img src={d.imageUrl} className="w-full h-full object-cover" alt="" /> : <span className="text-xs font-bold">{d.name[0]}</span>}
                                 </div>
                                 <div>
                                    <h4 className="font-bold text-sm tracking-tight">{d.name}</h4>
                                    <span className={cn(
                                       "text-[10px] font-black uppercase tracking-widest",
                                       d.team === 'A' ? "text-indigo-400" : "text-amber-400"
                                    )}>Team {d.team} ({d.team === 'A' ? 'Gov' : 'Opp'})</span>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <span className={cn(
                                 "text-xs font-bold",
                                 d.lastRoundPoints > 0 ? "text-emerald-500" : d.lastRoundPoints < 0 ? "text-red-500" : "text-slate-500"
                              )}>
                                 {d.lastRoundPoints > 0 && '+'}{d.lastRoundPoints}
                              </span>
                           </td>
                           <td className="px-6 py-4 text-right font-mono font-bold text-slate-300">
                              {formatCurrency(d.price)}
                           </td>
                           <td className="px-6 py-4 text-right">
                              <div className="inline-flex items-center justify-center bg-slate-950 border border-slate-800 rounded-lg px-3 py-1 text-sm font-mono font-black text-indigo-400 shadow-inner">
                                 {d.totalPoints}
                              </div>
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
         {filtered.length === 0 && (
            <div className="text-center py-20 bg-slate-900/50 border border-slate-800 rounded-[2.5rem] border-dashed">
               <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No debaters found</p>
            </div>
         )}
      </section>
    </div>
  );
}

// Additional icons
function Plus({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="M12 5v14"/></svg>
  );
}
