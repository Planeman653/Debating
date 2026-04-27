import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, 
  query, orderBy, getDocs, writeBatch, getDoc, increment
} from 'firebase/firestore';
import { Debater, Round, SystemState, Team, UserProfile } from '../types';
import { Plus, Trash2, Save, Send, Lock, Unlock, TrendingUp, UserPlus, CalendarPlus, Calendar, Star, Vote, Users, Shield, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn, isAutoLocked } from '../lib/utils';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

export default function AdminPanel() {
  const [debaters, setDebaters] = useState<Debater[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [state, setState] = useState<SystemState | null>(null);
  const [activeSection, setActiveSection] = useState<'debaters' | 'rounds' | 'results' | 'voting' | 'users'>('debaters');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsubD = onSnapshot(collection(db, 'debaters'), (s) => setDebaters(s.docs.map(d => ({id: d.id, ...d.data()} as Debater))));
    const unsubR = onSnapshot(query(collection(db, 'rounds'), orderBy('roundNumber', 'desc')), (s) => setRounds(s.docs.map(d => ({id: d.id, ...d.data()} as Round))));
    const unsubU = onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map(d => ({...d.data()} as UserProfile))));
    const unsubT = onSnapshot(collection(db, 'teams'), (s) => setTeams(s.docs.map(d => ({...d.data()} as Team))));
    const unsubS = onSnapshot(doc(db, 'state', 'lock'), (s) => {
      if (s.exists()) setState(s.data() as SystemState);
      else setState({ isLocked: false, currentRoundId: '', initialBudget: 50 });
    });
    return () => { unsubD(); unsubR(); unsubU(); unsubT(); unsubS(); };
  }, []);

  const addDebater = async () => {
    try {
      setIsProcessing(true);
      const id = Math.random().toString(36).substring(7);
      await setDoc(doc(db, 'debaters', id), {
        name: 'New Debater',
        team: 'A',
        price: 10,
        totalPoints: 0,
        lastRoundPoints: 0,
        bio: ''
      });
      toast.success('Debater added');
    } catch (err) {
      toast.error('Permission denied or network error');
    } finally {
      setIsProcessing(false);
    }
  };

  const addRound = async () => {
    try {
      setIsProcessing(true);
      const id = Math.random().toString(36).substring(7);
      const lastRound = rounds[0]?.roundNumber || 0;
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + 24);
      
      await setDoc(doc(db, 'rounds', id), {
        roundNumber: lastRound + 1,
        topic: 'Is AI good for humanity?',
        deadline: deadline.toISOString(),
        status: 'upcoming'
      });
      toast.success('Round added');
    } catch (err) {
      toast.error('Permission denied or network error');
    } finally {
      setIsProcessing(false);
    }
  };

  const setLockMode = async (mode: 'auto' | 'manual-locked' | 'manual-unlocked') => {
    if (!state) return;
    try {
      await setDoc(doc(db, 'state', 'lock'), { 
        ...state, 
        lockMode: mode,
        isLocked: mode === 'manual-locked'
      }, { merge: true });
      toast.success(`Lock mode: ${mode.replace('-', ' ')}`);
    } catch (err) {
      toast.error('Unauthorized action');
    }
  };

   const pushResults = async (round: Round, scores: Record<string, number>) => {
    try {
      setIsProcessing(true);
      const batch = writeBatch(db);
      
      // Update round status
      batch.update(doc(db, 'rounds', round.id), { 
        status: 'completed',
        debaterScores: scores
      });

      // Update debater total stats and prices
      for (const [id, score] of Object.entries(scores)) {
        const d = debaters.find(deb => deb.id === id);
        if (d) {
          const nextPrice = Math.max(1, d.price + (score * 0.01));
          batch.update(doc(db, 'debaters', id), {
            totalPoints: increment(score),
            lastRoundPoints: score,
            price: Number(nextPrice.toFixed(1))
          });
        }
      }

      // Update user scores based on their team performance
      const teamsSnap = await getDocs(collection(db, 'teams'));
      const activeTeams = teamsSnap.docs.map(d => ({ uid: d.id, ...d.data() } as Team & { uid: string }));
      
      for (const team of activeTeams) {
        let teamRoundPoints = 0;
        team.debaterIds.forEach(id => {
          teamRoundPoints += (scores[id] || 0);
        });

        if (teamRoundPoints !== 0) {
          const userRef = doc(db, 'users', team.uid);
          batch.update(userRef, {
            totalPoints: increment(teamRoundPoints)
          });
        }
      }

      // Unlock global state
      batch.set(doc(db, 'state', 'lock'), { 
        isLocked: false, 
        currentRoundId: '',
        lockMode: 'auto'
      }, { merge: true });

      await batch.commit();
      toast.success('Results pushed and teams unlocked!');
    } catch (err: any) {
      console.error(err);
      const msg = err.message?.includes('permission') ? 'Permission denied.' : 'Failed to push results.';
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const correctResults = async (round: Round, newScores: Record<string, number>) => {
    try {
      setIsProcessing(true);
      const batch = writeBatch(db);
      const oldScores = round.debaterScores || {};

      // 1. Update round scores
      batch.update(doc(db, 'rounds', round.id), { 
        debaterScores: newScores
      });

      // 2. Diff debater scores
      for (const d of debaters) {
        const oldScore = oldScores[d.id] || 0;
        const newScore = newScores[d.id] || 0;
        const diff = newScore - oldScore;

        if (diff !== 0) {
          const nextPrice = Math.max(1, d.price + (diff * 0.01));
          batch.update(doc(db, 'debaters', d.id), {
            totalPoints: increment(diff),
            lastRoundPoints: newScore, // Update lastRoundPoints to reflected newly corrected score
            price: Number(nextPrice.toFixed(1))
          });
        }
      }

      // 3. Diff user scores
      const teamsSnap = await getDocs(collection(db, 'teams'));
      const activeTeams = teamsSnap.docs.map(d => ({ uid: d.id, ...d.data() } as Team & { uid: string }));

      for (const team of activeTeams) {
        let teamDiff = 0;
        team.debaterIds.forEach(id => {
          const oldS = oldScores[id] || 0;
          const newS = newScores[id] || 0;
          teamDiff += (newS - oldS);
        });

        if (teamDiff !== 0) {
          batch.update(doc(db, 'users', team.uid), {
            totalPoints: increment(teamDiff)
          });
        }
      }

      await batch.commit();
      toast.success('Scores corrected and totals updated!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to correct results.');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleVoting = async () => {
    if (!state) return;
    try {
      await setDoc(doc(db, 'state', 'lock'), { ...state, isVotingOpen: !state.isVotingOpen }, { merge: true });
      toast.success(state.isVotingOpen ? 'Voting Closed' : 'Voting Opened');
    } catch (err) {
      toast.error('Unauthorized action');
    }
  };

  const resetVotes = async () => {
    if (!window.confirm('Delete ALL current votes? This cannot be undone.')) return;
    try {
      setIsProcessing(true);
      const snap = await getDocs(collection(db, 'votes'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast.success('Votes cleared');
    } catch (err) {
      toast.error('Failed to clear votes');
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this account? This will remove their profile and squad.')) return;
    try {
      setIsProcessing(true);
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', userId));
      batch.delete(doc(db, 'teams', userId));
      // Also check if admin
      batch.delete(doc(db, 'admins', userId));
      
      await batch.commit();
      toast.success('Account deleted successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete account');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetTeam = async (userId: string) => {
    if (!window.confirm('Clear this user\'s squad? Their budget will remain as currently set in the editor.')) return;
    try {
      setIsProcessing(true);
      await updateDoc(doc(db, 'teams', userId), {
        debaterIds: [],
        updatedAt: new Date().toISOString()
      });
      toast.success('Squad cleared');
    } catch (err) {
      console.error(err);
      toast.error('Failed to reset squad');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateUser = async (user: UserProfile, walletBalance: number) => {
    try {
      setIsProcessing(true);
      const batch = writeBatch(db);
      
      // Update User Profile
      batch.update(doc(db, 'users', user.uid), {
        totalPoints: user.totalPoints,
        displayName: user.displayName,
        isAdmin: user.isAdmin
      });

      // Sync with Admins collection for security rules
      const adminRef = doc(db, 'admins', user.uid);
      if (user.isAdmin) {
        batch.set(adminRef, { email: user.email, addedAt: new Date().toISOString() }, { merge: true });
      } else {
        // Only delete if it's not the bootstrap admin
        if (user.email !== 'sweatycoiner@gmail.com') {
          batch.delete(adminRef);
        }
      }

      // Sync with Team points & walletBalance
      const teamRef = doc(db, 'teams', user.uid);
      batch.set(teamRef, {
        totalPoints: user.totalPoints,
        walletBalance: walletBalance,
        userId: user.uid,
        displayName: user.displayName,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await batch.commit();
      toast.success('User updated and synced!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update user');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-center bg-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden gap-4">
        <div className="relative z-10 text-center sm:text-left">
           <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter">ADMIN COMMAND</h2>
           <p className="opacity-80 font-bold uppercase tracking-widest text-[10px] md:text-xs text-center sm:text-left">Authority Panel</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
          <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-white/10 relative z-10 w-full sm:w-auto">
            {[
              { id: 'auto', icon: Clock, label: 'Auto' },
              { id: 'manual-locked', icon: Lock, label: 'Lock' },
              { id: 'manual-unlocked', icon: Unlock, label: 'Open' }
            ].map((mode) => {
              const isActive = (state?.lockMode || 'auto') === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setLockMode(mode.id as any)}
                  className={cn(
                    "flex flex-1 sm:flex-none items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all cursor-pointer justify-center whitespace-nowrap",
                    isActive ? "bg-white text-indigo-600 shadow-lg" : "text-white/60 hover:text-white"
                  )}
                >
                  <mode.icon className="w-3.5 h-3.5" />
                  {mode.label}
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 bg-slate-900/30 px-4 py-2 rounded-xl border border-white/5">
             <div className={cn(
               "w-2 h-2 rounded-full animate-pulse",
               isAutoLocked(rounds, state) ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
             )} />
             <span className="text-[10px] font-black uppercase tracking-widest opacity-70">
                Effective: {isAutoLocked(rounds, state) ? 'Locked' : 'Open'}
             </span>
          </div>

          <button 
            type="button"
            onClick={toggleVoting}
            className={cn(
              "relative z-10 flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-tighter transition-all shadow-xl cursor-pointer justify-center",
              state?.isVotingOpen ? "bg-indigo-400 hover:bg-indigo-500" : "bg-slate-800 hover:bg-slate-700"
            )}
          >
            <Star className={cn("w-5 h-5", state?.isVotingOpen ? "fill-white" : "")} />
            <span className="text-sm">{state?.isVotingOpen ? 'Stop Voting' : 'Start Voting'}</span>
          </button>
        </div>
      </header>

      <div className="flex gap-2 md:gap-4 border-b border-slate-800 overflow-x-auto pb-px no-scrollbar">
         {(['debaters', 'rounds', 'users', 'voting'] as const).map(tab => (
           <button 
             key={tab}
             type="button"
             onClick={() => setActiveSection(tab)}
             className={cn(
                "px-4 md:px-6 py-4 text-[10px] md:text-sm font-black uppercase tracking-widest transition-all relative border-b-2 cursor-pointer whitespace-nowrap",
                activeSection === tab ? "text-indigo-500 border-indigo-500" : "text-slate-500 border-transparent hover:text-slate-300"
             )}
           >
             {tab}
           </button>
         ))}
      </div>

      <div className="min-h-[400px]">
         {activeSection === 'users' && (
           <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {users.map(u => (
                    <AdminUserCard 
                      key={u.uid} 
                      user={u} 
                      team={teams.find(t => t.userId === u.uid)}
                      onUpdate={updateUser} 
                      onResetTeam={resetTeam}
                      onDelete={deleteUser} 
                      isProcessing={isProcessing} 
                    />
                 ))}
              </div>
           </div>
         )}
         {activeSection === 'voting' && (
           <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4">
                 <div className="bg-indigo-500/10 p-4 rounded-2xl">
                    <Vote className="w-8 h-8 text-indigo-500" />
                 </div>
                 <div>
                    <h3 className="text-xl font-bold">Voting Management</h3>
                    <p className="text-slate-500 text-sm">Clear the current "Debater of the Day" votes to start a fresh session.</p>
                 </div>
                 <button
                   onClick={resetVotes}
                   disabled={isProcessing}
                   className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                 >
                   Clear All Votes
                 </button>
              </div>
           </div>
         )}
         {activeSection === 'debaters' && (
           <div className="space-y-4">
              <button 
                type="button"
                disabled={isProcessing}
                onClick={addDebater} 
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 p-4 rounded-2xl text-sm font-bold w-full justify-center disabled:opacity-50 cursor-pointer"
              >
                 <UserPlus className="w-5 h-5" /> {isProcessing ? 'Processing...' : 'Add Debater'}
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {debaters.map(d => (
                   <AdminDebaterCard key={d.id} debater={d} />
                 ))}
              </div>
           </div>
         )}

         {activeSection === 'rounds' && (
           <div className="space-y-4">
              <button 
                type="button"
                disabled={isProcessing}
                onClick={addRound} 
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 p-4 rounded-2xl text-sm font-bold w-full justify-center disabled:opacity-50 cursor-pointer"
              >
                 <CalendarPlus className="w-5 h-5" /> {isProcessing ? 'Processing...' : 'Add Round'}
              </button>
              <div className="space-y-4">
                 {rounds.map(r => (
                   <AdminRoundCard key={r.id} round={r} onPush={pushResults} onCorrect={correctResults} debaters={debaters} isProcessing={isProcessing} />
                 ))}
              </div>
           </div>
         )}
      </div>
    </div>
  );
}

function AdminDebaterCard({ debater }: { debater: Debater, key?: string }) {
  const [data, setData] = useState(debater);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Sync if prop changes (essential for stable editing)
  useEffect(() => {
    setData(debater);
  }, [debater.id]);

  const save = async () => {
    try {
      setIsSaving(true);
      const { id, ...updateData } = data;
      
      // Basic validation check before sending
      if (!updateData.name || updateData.name.trim().length === 0) {
        throw new Error('Name is required');
      }
      if (updateData.price < 0) {
        throw new Error('Price cannot be negative');
      }

      // Clean undefined values from updateData
      const cleanData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined)
      );

      await updateDoc(doc(db, 'debaters', debater.id), cleanData);
      toast.success('Updated');
    } catch (err: any) {
      console.error(err);
      const msg = err.message?.includes('permission') 
        ? 'Permission denied. Are you an admin?' 
        : (err.message || 'Failed to update debater');
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const del = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }
    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'debaters', debater.id));
      toast.success('Deleted');
    } catch (err) {
       console.error(err);
       toast.error('Failed to delete debater');
       setShowConfirm(false);
    } finally {
       setIsDeleting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-4">
       <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest px-1">Name</label>
                <input className="bg-slate-950 p-3 rounded-xl flex-1 border border-slate-800 w-full text-sm font-bold" value={data.name} onChange={e => setData({...data, name: e.target.value})} />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest px-1">Affiliation</label>
                <select 
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-bold cursor-pointer w-full"
                  value={data.team}
                  onChange={e => setData({...data, team: e.target.value as 'A' | 'B'})}
                >
                  <option value="A">Team A</option>
                  <option value="B">Team B</option>
                </select>
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest px-1">Market Price</label>
                <input type="number" step="0.1" className="bg-slate-950 p-3 rounded-xl flex-1 border border-slate-800 w-full font-mono text-sm" value={data.price} onChange={e => setData({...data, price: Number(e.target.value)})} />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest px-1">Total Score</label>
                <input type="number" className="bg-slate-950 p-3 rounded-xl flex-1 border border-slate-800 w-full font-mono text-sm text-indigo-400" value={data.totalPoints} onChange={e => setData({...data, totalPoints: Number(e.target.value)})} />
             </div>
          </div>
       </div>

       <div className="flex gap-2 pt-2">
          <button 
            type="button" 
            onClick={save} 
            disabled={isSaving || isDeleting}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 p-3.5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/10 active:scale-95"
          >
            <Save className="w-4 h-4" /> {isSaving ? 'Updating...' : 'Save Changes'}
          </button>
          <button 
            type="button" 
            onClick={del} 
            disabled={isSaving || isDeleting}
            onMouseLeave={() => setShowConfirm(false)}
            className={cn(
              "p-3.5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 shadow-lg",
              showConfirm 
                ? "bg-red-600 text-white flex-1 shadow-red-600/20" 
                : "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white shadow-red-500/5"
            )}
          >
            <Trash2 className="w-4 h-4" />
            {showConfirm && "Confirm Action"}
          </button>
       </div>
    </div>
  );
}

function AdminRoundCard({ round, onPush, onCorrect, debaters, isProcessing }: { round: Round, onPush: (r: Round, s: Record<string, number>) => void, onCorrect: (r: Round, s: Record<string, number>) => void, debaters: Debater[], isProcessing: boolean, key?: string }) {
   const [scores, setScores] = useState<Record<string, number>>(round.debaterScores || {});
   const [topic, setTopic] = useState(round.topic);
   const [deadline, setDeadline] = useState(round.deadline);
   const [isUpdating, setIsUpdating] = useState(false);

   const save = async () => {
      try {
        setIsUpdating(true);
        await updateDoc(doc(db, 'rounds', round.id), { topic, deadline });
        toast.success('Round updated');
      } catch (err) {
        console.error(err);
        toast.error('Failed to update round');
      } finally {
        setIsUpdating(false);
      }
   };

   const deleteRound = async () => {
      try {
         if(!confirm('Are you sure you want to delete this round?')) return;
         await deleteDoc(doc(db, 'rounds', round.id));
         toast.success('Round deleted');
      } catch (err) {
         console.error(err);
         toast.error('Failed to delete round');
      }
   };

   return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
         <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
               <span className="bg-indigo-600 text-[10px] font-black px-2 py-1 rounded">ROUND {round.roundNumber}</span>
               <button type="button" onClick={deleteRound} className="text-red-500 hover:text-red-400 cursor-pointer p-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
            <span className={cn(
               "text-[10px] font-black uppercase px-2 py-1 rounded border",
               round.status === 'completed' ? "border-emerald-500 text-emerald-500" : "border-amber-500 text-amber-500"
            )}>{round.status}</span>
         </div>
         
         <div className="space-y-4">
            <input className="bg-slate-950 p-3 rounded-xl w-full border border-slate-800 font-bold" value={topic} onChange={e => setTopic(e.target.value)} />
            <div className="relative group/picker">
               <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 text-slate-500">
                  <Calendar className="w-4 h-4" />
               </div>
               <DatePicker
                  selected={new Date(deadline)}
                  onChange={(date) => date && setDeadline(date.toISOString())}
                  showTimeSelect
                  dateFormat="MMMM d, yyyy h:mm aa"
                  className="bg-slate-950 p-3 pl-10 rounded-xl w-full border border-slate-800 text-sm focus:border-indigo-500 transition-colors outline-hidden cursor-pointer"
                  calendarClassName="dark-calendar shadow-2xl border-slate-800"
                  wrapperClassName="w-full"
               />
            </div>
         </div>

         <div className="bg-slate-950 p-6 rounded-2xl space-y-4">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
               {round.status === 'completed' ? 'Correct Round Scores' : 'Record Round Scores'}
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
               {debaters.map(d => (
                 <div key={d.id} className="flex flex-col gap-1">
                    <label className="text-[10px] truncate">{d.name}</label>
                    <input 
                      type="number" 
                      className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs"
                      value={scores[d.id] || 0}
                      onChange={e => setScores({...scores, [d.id]: Number(e.target.value)})}
                    />
                 </div>
               ))}
            </div>
            
            {round.status !== 'completed' ? (
              <button 
                type="button"
                disabled={isProcessing}
                onClick={() => onPush(round, scores)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-all"
              >
                <Send className="w-4 h-4" /> {isProcessing ? 'Pushing...' : 'Finalize Results & Unlock'}
              </button>
            ) : (
              <button 
                type="button"
                disabled={isProcessing}
                onClick={() => onCorrect(round, scores)}
                className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 font-bold p-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-all border border-indigo-500/30"
              >
                <TrendingUp className="w-4 h-4" /> {isProcessing ? 'Recalculating...' : 'Update Scores & Adjust Totals'}
              </button>
            )}
         </div>

         <div className="flex justify-between items-center">
            <button 
               type="button" 
               onClick={save} 
               disabled={isUpdating}
               className="text-xs text-indigo-400 font-bold underline cursor-pointer hover:text-indigo-300 disabled:opacity-50"
            >
               {isUpdating ? 'Updating...' : 'Update Details'}
            </button>
         </div>
      </div>
   );
}

interface AdminUserCardProps {
  user: UserProfile;
  team?: Team;
  onUpdate: (u: UserProfile, budget: number) => void;
  onResetTeam: (id: string) => void;
  onDelete: (id: string) => void;
  isProcessing: boolean;
}

const AdminUserCard: React.FC<AdminUserCardProps> = ({ user, team, onUpdate, onResetTeam, onDelete, isProcessing }) => {
  const [data, setData] = useState(user);
  const [budget, setBudget] = useState(team?.walletBalance || 0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    setData(user);
  }, [user.uid]);

  useEffect(() => {
    if (team) setBudget(team.walletBalance);
  }, [team?.walletBalance]);

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h4 className="font-bold text-lg flex items-center gap-2">
            {data.displayName}
            {data.isAdmin && <Shield className="w-4 h-4 text-amber-500" />}
          </h4>
          <p className="text-xs text-slate-500 font-mono italic">{data.email}</p>
          <p className="text-[10px] text-slate-600 font-mono">UID: {data.uid}</p>
        </div>
        <button 
          onClick={() => {
            if (showConfirm) onDelete(user.uid);
            else setShowConfirm(true);
          }}
          onMouseLeave={() => setShowConfirm(false)}
          className={cn(
            "p-3 rounded-2xl transition-all",
            showConfirm ? "bg-red-600 text-white" : "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
          )}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest px-1">Total Points</label>
          <input 
            type="number" 
            className="bg-slate-950 p-3 rounded-xl w-full border border-slate-800 font-mono text-sm text-indigo-400" 
            value={data.totalPoints} 
            onChange={e => setData({...data, totalPoints: Number(e.target.value)})} 
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest px-1">Budget ($)</label>
          <input 
            type="number" 
            className="bg-slate-950 p-3 rounded-xl w-full border border-slate-800 font-mono text-sm text-emerald-400" 
            value={budget} 
            onChange={e => setBudget(Number(e.target.value))} 
          />
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center gap-4">
         <div className="flex items-center gap-2 flex-1">
            <input 
               type="checkbox" 
               id={`admin-${user.uid}`}
               checked={data.isAdmin} 
               onChange={e => setData({...data, isAdmin: e.target.checked})}
               className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor={`admin-${user.uid}`} className="text-xs font-bold text-slate-400 cursor-pointer">Admin Permissions</label>
         </div>
         <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={() => {
                if (showResetConfirm) {
                  onResetTeam(user.uid);
                  setShowResetConfirm(false);
                } else {
                  setShowResetConfirm(true);
                }
              }}
              onMouseLeave={() => setShowResetConfirm(false)}
              disabled={isProcessing}
              className={cn(
                "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 border",
                showResetConfirm 
                  ? "bg-red-500 border-red-500 text-white" 
                  : "bg-transparent border-slate-800 text-slate-400 hover:text-white"
              )}
            >
              {showResetConfirm ? "Confirm Clear" : "Clear Squad"}
            </button>
            <button 
              onClick={() => onUpdate(data, budget)}
              disabled={isProcessing}
              className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Save
            </button>
         </div>
      </div>
    </div>
  );
}
