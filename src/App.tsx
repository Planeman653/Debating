/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Toaster, toast } from 'react-hot-toast';
import { LayoutDashboard, Users, Trophy, History, ShieldAlert, LogIn, LogOut, Vote } from 'lucide-react';
import { UserProfile, SystemState } from './types';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Pages
import Dashboard from './components/Dashboard';
import Squad from './components/Squad';
import Rankings from './components/Rankings';
import PastDebates from './components/PastDebates';
import League from './components/League';
import AdminPanel from './components/AdminPanel';
import Voting from './components/Voting';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [systemState, setSystemState] = useState<SystemState | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Initial profile check/create
        const profileRef = doc(db, 'users', u.uid);
        const profileDoc = await getDoc(profileRef);
        
        if (!profileDoc.exists()) {
          const isAdmin = u.email === 'sweatycoiner@gmail.com';
          const newProfile = {
            uid: u.uid,
            displayName: u.displayName || 'Anonymous',
            email: u.email || '',
            isAdmin: isAdmin,
            totalPoints: 0
          };
          await setDoc(profileRef, newProfile);
        }

        // Ensure admin collection entry exists for bootstrap
        if (u.email === 'sweatycoiner@gmail.com') {
          const adminRef = doc(db, 'admins', u.uid);
          const adminDoc = await getDoc(adminRef);
          if (!adminDoc.exists()) {
            await setDoc(adminRef, { email: u.email });
          }
        }

        // Real-time profile listener
        const unsubProfile = onSnapshot(profileRef, (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
          }
          setLoading(false);
        });

        return () => unsubProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setSystemState(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'state', 'lock'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemState(snapshot.data() as SystemState);
      } else if (user) {
        // Initial state for new installations
        setSystemState({ isLocked: false, currentRoundId: '', initialBudget: 50 });
      }
    });
    return () => unsub();
  }, [user]);

  const login = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      toast.success('Logged in successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to log in.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.1),transparent_50%)]" />
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic">
              DEBATE <span className="text-indigo-500">FR</span>
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px] md:text-xs">The Unofficial Fantasy League</p>
          </div>

          <p className="text-slate-400 max-w-sm mx-auto leading-relaxed text-sm md:text-base font-medium">
            Draft your squad, predict the winners, and climb the ranks in the world's first fantasy debating platform.
          </p>

          <div className="pt-4">
            <button
              onClick={login}
              className="group flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 shadow-xl shadow-indigo-600/20"
            >
              <LogIn className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              Enter the Arena
            </button>
          </div>
        </motion.div>

        <footer className="absolute bottom-8 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
           Built for the debating community
        </footer>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'squad', label: 'My Squad', icon: Users },
    { id: 'rankings', label: 'Rankings', icon: Trophy },
    { id: 'voting', label: 'Vote', icon: Vote },
    { id: 'history', label: 'History', icon: History },
    { id: 'league', label: 'League', icon: Users },
    ...(profile?.isAdmin ? [{ id: 'admin', label: 'Admin', icon: ShieldAlert }] : [])
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      <Toaster position="top-center" containerClassName="mt-14 md:mt-0" />
      
      <div className="flex flex-col md:flex-row min-h-screen">
        {/* Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 md:relative md:w-64 bg-slate-900/80 backdrop-blur-xl border-t md:border-t-0 md:border-r border-slate-800 z-50 pb-[safe-area-inset-bottom] md:pb-0">
          <div className="hidden md:flex p-8 items-center gap-3">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-white" />
             </div>
             <h1 className="text-xl font-black tracking-tighter uppercase">
               Debate<span className="text-indigo-500">FR</span>
             </h1>
          </div>
          
          <div className="flex md:flex-col justify-around md:justify-start p-2 md:p-4 gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-col md:flex-row items-center gap-1 md:gap-3 p-2 md:px-4 md:py-3.5 rounded-2xl transition-all duration-300 text-xs md:text-sm font-bold relative group",
                    isActive 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                      : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-200"
                  )}
                >
                  <tab.icon className={cn("w-5 h-5 transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
                  <span className="text-[9px] md:text-sm uppercase tracking-widest md:tracking-normal font-black md:font-bold">{tab.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute -top-1 md:top-auto md:left-0 md:w-1 md:h-1/2 bg-white md:bg-indigo-400 rounded-full hidden md:block"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden md:flex flex-col mt-auto p-6 border-t border-slate-800 gap-4">
             <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-2xl border border-slate-800">
                <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-indigo-500/20 shadow-inner" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold truncate leading-tight">{profile?.displayName}</span>
                  <span className="text-[10px] text-slate-500 truncate tracking-tighter">{user.email}</span>
                </div>
             </div>
             <button 
                onClick={() => auth.signOut()}
                className="flex items-center gap-2 text-slate-500 hover:text-red-400 transition-colors px-2 text-sm font-bold uppercase tracking-widest text-[10px]"
              >
               <LogOut className="w-4 h-4" />
               Sign Out
             </button>
          </div>
        </nav>

        <main className="flex-1 p-4 md:p-8 pb-32 md:pb-8 overflow-y-auto w-full">
          <div className="max-w-5xl mx-auto w-full">
             <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                   {activeTab === 'dashboard' && <Dashboard user={user} systemState={systemState} />}
                   {activeTab === 'squad' && <Squad user={user} systemState={systemState} profile={profile} />}
                   {activeTab === 'rankings' && <Rankings />}
                   {activeTab === 'voting' && <Voting user={user} systemState={systemState} />}
                   {activeTab === 'history' && <PastDebates />}
                   {activeTab === 'league' && <League />}
                   {activeTab === 'admin' && profile?.isAdmin && <AdminPanel />}
                </motion.div>
             </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
