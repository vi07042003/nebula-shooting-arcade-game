import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ShootingGame from './components/ShootingGame';
import ShootingStars from './components/ShootingStars';
import axios from 'axios';
import { Trophy, Play, Home, RefreshCcw, Settings, X, LogOut, ChevronRight, Keyboard, Layers, Lock, Unlock, Skull, Link, Zap, Shield, Timer, Sliders, Check, Edit2, Loader2 } from 'lucide-react';

const API_URL = 'http://localhost:8000';


const ModalWrapper = ({ isOpen, onClose, title, children, accentColor = "primary" }) => {
  if (!isOpen) return null;
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className={`glass-card p-12 max-w-xl w-full relative border-${accentColor}/20 shadow-[0_0_100px_rgba(0,242,255,0.1)] text-left`}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-gray-500 hover:text-white transition-colors"><X size={32} /></button>
        <h2 className={`text-4xl font-black mb-10 text-${accentColor} uppercase italic tracking-tighter leading-none`}>{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  );
};

function App() {
  const [gameState, setGameState] = useState('LANDING'); 
  const [currentLevel, setCurrentLevel] = useState(1);
  const [unlockedLevels, setUnlockedLevels] = useState(parseInt(localStorage.getItem('nebula_unlocked')) || 1);
  const [finalScore, setFinalScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [username, setUsername] = useState(localStorage.getItem('nebula_pilot') || 'Pilot_' + Math.floor(Math.random() * 1000));
  const [pilotId, setPilotId] = useState(localStorage.getItem('nebula_pilot_id') || 'id_' + Math.random().toString(36).substr(2, 9) + Date.now());
  const [showSettings, setShowSettings] = useState(false);
  const [showPowerUpEdit, setShowPowerUpEdit] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [activeControl, setActiveControl] = useState(null);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [tempUsername, setTempUsername] = useState(username);
  const profileDrawerRef = useRef(null);
  
  const [enabledPowerUps, setEnabledPowerUps] = useState(JSON.parse(localStorage.getItem('nebula_powerups')) || ['shield', 'multishot', 'rapidfire', 'slowmo']);
  const [tempPowerUps, setTempPowerUps] = useState([]);

  const [controls, setControls] = useState(JSON.parse(localStorage.getItem('nebula_controls')) || {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'Space'
  });

  useEffect(() => {
    localStorage.setItem('nebula_pilot', username);
    localStorage.setItem('nebula_pilot_id', pilotId);
    fetchLeaderboard();
  }, [username, pilotId]);

  useEffect(() => {
    localStorage.setItem('nebula_controls', JSON.stringify(controls));
  }, [controls]);

  useEffect(() => {
    localStorage.setItem('nebula_unlocked', unlockedLevels.toString());
  }, [unlockedLevels]);

  useEffect(() => {
    localStorage.setItem('nebula_powerups', JSON.stringify(enabledPowerUps));
  }, [enabledPowerUps]);

  useEffect(() => {
    if (!activeControl) return;
    const handleKey = (e) => {
        e.preventDefault();
        updateControl(activeControl, e.code);
        setActiveControl(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeControl]);

  useEffect(() => {
    if (!showProfileDrawer) return;
    const handleClickOutside = (e) => {
      if (profileDrawerRef.current && !profileDrawerRef.current.contains(e.target)) {
        setShowProfileDrawer(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDrawer]);

  const fetchLeaderboard = async () => {
    setIsLoadingLeaderboard(true);
    try {
      const response = await axios.get(`${API_URL}/leaderboard`);
      setLeaderboard(response.data);
    } catch (err) {
      console.error("Error fetching leaderboard", err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const handleGameOver = async (score, won = false) => {
    setFinalScore(score);
    if (won) {
      if (currentLevel === unlockedLevels && unlockedLevels < 20) setUnlockedLevels(prev => prev + 1);
      setGameState('LEVEL_COMPLETE');
    } else setGameState('GAMEOVER');
    try {
      await axios.post(`${API_URL}/score`, { pilot_id: pilotId, username, score });
      fetchLeaderboard();
    } catch (err) {
      console.error("Error saving score", err);
    }
  };

  const startLevel = (lvl) => { setCurrentLevel(lvl); setGameState('PLAYING'); };
  const updateControl = (action, key) => { setControls(prev => ({ ...prev, [action]: key })); };
  const isBossLevel = (lvl) => lvl % 5 === 0;

  const openPowerUpEditor = () => {
    setTempPowerUps([...enabledPowerUps]);
    setShowPowerUpEdit(true);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#050505] text-white font-sans">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full" />
      </div>

      {gameState !== 'PLAYING' && <ShootingStars />}

      <AnimatePresence mode="wait">
        {gameState === 'LANDING' && (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6">
            <div ref={profileDrawerRef} className="absolute top-8 left-8 flex flex-col gap-2 z-50">
              <button 
                onClick={() => {
                  setTempUsername(username);
                  setShowProfileDrawer(!showProfileDrawer);
                }}
                className="flex items-center gap-4 glass-card px-6 py-3 group hover:bg-white/5 transition-colors text-left"
              >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold tracking-tighter text-black">{(username[0] || 'P').toUpperCase()}</div>
                  <div className="flex items-center gap-2">
                      <span className="font-mono text-primary text-xl font-black brightness-125">{username || 'Unknown'}</span>
                      <Edit2 size={16} className="text-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
              </button>
              
              <AnimatePresence>
                {showProfileDrawer && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="glass-card p-6 w-80 shadow-[0_0_30px_rgba(0,242,255,0.15)] flex flex-col gap-6"
                  >
                     <div className="space-y-4">
                         <div className="flex flex-col gap-2 border-b border-white/10 pb-4">
                            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-500">Pilot Handle</label>
                            <input 
                              value={tempUsername} 
                              onChange={(e) => setTempUsername(e.target.value)} 
                              className="bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none rounded-lg px-4 py-2 font-mono text-primary text-lg font-black w-full" 
                              autoFocus 
                            />
                            <div className="flex gap-2 mt-2">
                                <button 
                                  onClick={async () => {
                                    setUsername(tempUsername);
                                    try {
                                      await axios.post(`${API_URL}/update-username`, { pilot_id: pilotId, username: tempUsername });
                                      fetchLeaderboard();
                                    } catch (err) {
                                      console.error("Error updating username", err);
                                    }
                                    setShowProfileDrawer(false);
                                  }}
                                  className="flex-1 bg-primary/20 hover:bg-primary/40 text-primary text-[10px] font-black uppercase tracking-widest py-2 rounded-md transition-colors border border-primary/20"
                                >
                                  Apply
                                </button>
                                <button 
                                  onClick={() => {
                                    setTempUsername(username);
                                    setShowProfileDrawer(false);
                                  }}
                                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] font-black uppercase tracking-widest py-2 rounded-md transition-colors border border-white/5"
                                >
                                  Cancel
                                </button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="bg-white/5 rounded-xl p-4 flex flex-col gap-1 items-center justify-center border border-white/5">
                                <span className="text-3xl font-black text-primary">{unlockedLevels}</span>
                                <span className="text-[8px] uppercase tracking-widest font-black text-gray-500">Sectors</span>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4 flex flex-col gap-1 items-center justify-center border border-white/5">
                                <span className="text-3xl font-black text-accent">{leaderboard.find(l => l.username === username)?.score || 0}</span>
                                <span className="text-[8px] uppercase tracking-widest font-black text-gray-500">Best Score</span>
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-xl p-4 flex flex-col gap-1 items-center justify-center border border-white/5 w-full">
                            <span className="text-lg font-black text-[#aaff00]">{enabledPowerUps.length} / 5</span>
                            <span className="text-[8px] uppercase tracking-widest font-black text-gray-500">Active Modifiers</span>
                        </div>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="absolute top-8 right-8 flex gap-4">
              <button title="Simulation Config" onClick={openPowerUpEditor} className="p-4 glass-card hover:bg-white/10 transition-all border-white/5 text-accent"><Zap size={28} /></button>
              <button title="Tactical Settings" onClick={() => setShowSettings(true)} className="p-4 glass-card hover:bg-white/10 transition-all border-white/5"><Settings size={28} /></button>
              <button title="Power Down" onClick={() => setShowQuitConfirm(true)} className="p-4 glass-card hover:bg-red-500/20 text-red-500 transition-all border-red-500/10 hover:border-red-500/50"><LogOut size={28} /></button>
            </div>

            <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8 text-left">
                <motion.div 
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.2 } }
                  }}
                  className="space-y-4"
                >
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, x: -50 },
                      visible: { opacity: 0.8, x: 0, transition: { duration: 0.8, ease: "easeOut" } }
                    }}
                    className="space-y-2"
                  >
                    <span className="text-secondary font-black tracking-[0.6em] text-xs uppercase decoration-secondary decoration-2 underline-offset-8 underline block">Intergalactic Command</span>
                  </motion.div>

                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 30 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } }
                    }}
                  >
                    <h1 className="text-9xl font-black tracking-tighter leading-none mt-4">
                      <motion.span 
                        className="block"
                        variants={{
                          hidden: { opacity: 0, x: -20 },
                          visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: "easeOut" } }
                        }}
                      >NEBULA</motion.span> 
                      <motion.span 
                        className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-secondary animate-pulse-slow block"
                        variants={{
                          hidden: { opacity: 0, scale: 0.8 },
                          visible: { opacity: 1, scale: 1, transition: { duration: 1.0, ease: "easeOut" } }
                        }}
                      >STRIKE</motion.span>
                    </h1>
                  </motion.div>

                  <motion.p 
                    variants={{
                      hidden: { opacity: 0, filter: 'blur(10px)' },
                      visible: { opacity: 1, filter: 'blur(0px)', transition: { duration: 1.0, ease: "easeOut" } }
                    }}
                    className="text-2xl text-gray-400 font-medium leading-relaxed max-w-lg mt-6"
                  >
                    Engage in the ultimate space-war simulation. Secure sectors and destroy Flagships.
                  </motion.p>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0, duration: 0.8, ease: "easeOut" }}
                  className="flex gap-6 pt-4"
                >
                  <button onClick={() => startLevel(unlockedLevels)} className="btn-primary group flex items-center gap-4 text-2xl px-12 py-6 rounded-[2rem] shadow-[0_20px_50px_rgba(0,242,255,0.3)]"><Play className="group-hover:scale-125 transition-transform" /> CONTINUE MISSION</button>
                  <button onClick={() => setGameState('STAGES')} className="glass-card flex items-center gap-4 text-2xl px-12 py-6 rounded-[2rem] hover:bg-white/10 transition-all font-black border-white/10"><Layers size={28} /> SECTORS</button>
                </motion.div>
              </div>

              <div className="space-y-8">
                <div className="glass-card p-8 border-l-[6px] border-l-primary shadow-2xl">
                  <h3 className="text-xl font-black flex items-center gap-3 mb-6 tracking-widest text-primary italic uppercase underline decoration-primary/20"><Trophy size={24} className="text-yellow-400" /> Pilots leaderboard</h3>
                  <div className="space-y-3 min-h-[100px] flex flex-col justify-center">
                  {isLoadingLeaderboard ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <Loader2 className="text-primary animate-spin" size={32} />
                      <span className="text-[10px] uppercase tracking-[0.3em] font-black text-primary/40 animate-pulse">Retrieving Data...</span>
                    </div>
                  ) : (
                    leaderboard.slice(0, 3).map((s, i) => (
                      <div key={i} className="flex justify-between items-center py-3 border-b border-white/5 text-lg">
                        <span className="text-gray-300 font-bold tracking-tight">#{i+1} {s.username}</span>
                        <span className="font-mono text-primary brightness-150 font-black">{s.score}</span>
                      </div>
                    ))
                  )}
                  </div>
                  <button onClick={() => setGameState('LEADERBOARD')} className="w-full mt-6 text-xs tracking-[0.4em] text-primary/40 hover:text-primary uppercase transition-all font-black">Open Tactics Archive</button>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="glass-card p-8 flex flex-col items-center justify-center gap-2 group hover:border-primary/50 transition-colors">
                    <span className="text-5xl font-black text-primary group-hover:scale-110 transition-transform">{unlockedLevels}/20</span>
                    <span className="text-xs text-gray-500 uppercase font-bold tracking-widest">Sectors Secured</span>
                  </div>
                  <div className="glass-card p-8 flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full border-4 border-green-500 flex items-center justify-center text-green-500 text-xs font-black animate-pulse">SYNC</div>
                    <span className="text-xs text-gray-500 uppercase font-bold tracking-widest">Live Uplink</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'STAGES' && (
          <motion.div 
            key="stages" 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => { if (e.target === e.currentTarget) setGameState('LANDING'); }}
            className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8 bg-black/40 backdrop-blur-sm cursor-pointer"
          >
            <div 
              className="glass-card p-16 max-w-5xl w-full border-t-4 border-t-primary/30 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-12 text-left">
                <div className="space-y-1">
                    <h2 className="text-6xl font-black italic tracking-tighter leading-none uppercase">Sector <span className="text-primary">Map</span></h2>
                    <p className="text-gray-500 uppercase tracking-[0.5em] text-[10px] font-black">Select Your Battle Quadrant</p>
                </div>
                <button onClick={() => setGameState('LANDING')} className="bg-white/5 p-6 rounded-3xl hover:bg-white/10 transition-all border border-white/5"><Home size={32} /></button>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-5 gap-6">
                {Array.from({ length: 20 }, (_, i) => i + 1).map(lvl => (
                  <button key={lvl} disabled={lvl > unlockedLevels} onClick={() => startLevel(lvl)}
                    className={`h-28 rounded-[2rem] transition-all flex flex-col items-center justify-center border-2 group relative overflow-hidden ${
                      lvl < unlockedLevels ? 'bg-primary/5 border-primary/20 text-primary' : 
                      lvl === unlockedLevels ? `bg-primary border-primary text-black font-black scale-105 shadow-[0_20px_50px_rgba(0,242,255,0.4)] z-20` : 
                      'bg-white/2 border-white/2 text-white/10'
                    }`}
                  >
                    {lvl > unlockedLevels ? (
                        <div className="flex flex-col items-center gap-1">
                            {isBossLevel(lvl) ? <Skull size={40} className="text-red-900/40" /> : <Lock size={40} className="text-white/80 shadow-[0_0_10px_rgba(255,255,255,0.2)]" />}
                            <span className="text-[8px] uppercase tracking-[0.3em] font-black opacity-20">{isBossLevel(lvl) ? 'Devil Chained' : 'Locked'}</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1">
                            {isBossLevel(lvl) ? (
                                <><Skull size={48} className={lvl === unlockedLevels ? 'text-black animate-pulse' : 'text-red-500'} /><span className="text-[10px] uppercase tracking-tighter font-black opacity-60">FLAGSHIP</span></>
                            ) : (
                                <><span className="text-4xl font-black italic -mb-1">{lvl}</span><span className="text-[10px] uppercase tracking-tighter font-black opacity-60">SECTOR</span></>
                            )}
                        </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'PLAYING' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50">
            <ShootingGame level={currentLevel} onGameOver={handleGameOver} onQuit={() => setGameState('STAGES')} onOpenSettings={() => setShowSettings(true)} controls={controls} enabledPowerUps={enabledPowerUps} />
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div key="gameover" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center min-h-screen relative z-10 p-6 bg-red-950/20">
            <div className="glass-card p-16 max-w-xl w-full border-t-[12px] border-t-red-600 shadow-[0_0_100px_rgba(220,38,38,0.2)]">
              <div className="flex flex-col items-center gap-6 mb-12 text-center">
                  <div className="w-24 h-24 rounded-full bg-red-600/10 border-4 border-red-600 flex items-center justify-center animate-bounce mx-auto"><X size={64} className="text-red-600" /></div>
                  <h2 className="text-7xl font-black text-red-600 mb-2 italic tracking-tighter uppercase leading-none mt-4">Simulation <br/> Failure</h2>
              </div>
              <div className="space-y-4">
                <button onClick={() => setGameState('PLAYING')} className="btn-primary w-full flex items-center justify-center gap-4 py-6 rounded-3xl text-2xl font-black shadow-xl"><RefreshCcw size={28} /> RE-ENGAGE</button>
                <button onClick={() => setGameState('STAGES')} className="w-full glass-card py-5 flex items-center justify-center gap-3 hover:bg-white/10 uppercase font-black text-xs tracking-[0.4em] transition-all border-white/5"><Layers size={20} /> MISSION MAP</button>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'LEVEL_COMPLETE' && (
          <motion.div key="win" initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center min-h-screen relative z-10 p-6 bg-green-950/20">
            <div className="glass-card p-16 max-w-xl w-full border-t-[12px] border-t-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)] text-left">
              <div className="flex flex-col items-center gap-6 mb-12 text-center">
                  <div className="w-24 h-24 rounded-full bg-green-500/10 border-4 border-green-500 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)] mx-auto"><Unlock size={64} className="text-green-500" /></div>
                  <h2 className="text-7xl font-black text-green-500 mb-2 italic tracking-tighter uppercase leading-none mt-4">Sector <br/> SECURED</h2>
              </div>
              <div className="space-y-6">
                <button onClick={() => (currentLevel < 20 ? startLevel(currentLevel+1) : setGameState('STAGES'))} className="btn-primary w-full flex items-center justify-center gap-4 py-8 rounded-[2.5rem] text-3xl font-black shadow-2xl hover:scale-105 transition-all"><ChevronRight size={36} /> NEXT QUADRANT</button>
                <button onClick={() => setGameState('STAGES')} className="w-full glass-card py-5 flex items-center justify-center gap-3 hover:bg-white/10 uppercase font-black text-xs tracking-[0.4em] border-white/5 transition-all"><Layers size={20} /> RETURN TO HQ</button>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'LEADERBOARD' && (
          <motion.div 
            key="leaderboard" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setGameState('LANDING'); }}
            className="flex flex-col items-center justify-center min-h-screen p-8 relative z-10 bg-black/40 backdrop-blur-sm cursor-pointer"
          >
            <div 
              className="glass-card p-12 max-w-4xl w-full border-t-4 border-t-primary text-left cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-12">
                <h2 className="text-6xl font-black italic uppercase tracking-tighter leading-none">Combat <span className="text-primary">Archives</span></h2>
                <button onClick={() => setGameState('LANDING')} className="bg-white/5 p-6 rounded-full hover:bg-white/10"><Home size={32} /></button>
              </div>
              <div className="space-y-3 mb-10 max-h-[50vh] overflow-y-auto pr-6 custom-scrollbar min-h-[200px]">
                {isLoadingLeaderboard ? (
                   <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
                      <Loader2 className="text-primary animate-spin" size={48} />
                      <p className="text-primary font-black uppercase tracking-[0.5em] italic animate-pulse">Syncing with Central Matrix</p>
                   </div>
                ) : (
                  leaderboard.sort((a,b)=>b.score-a.score).map((item, idx)=>(
                    <div key={idx} className="flex justify-between items-center p-6 rounded-3xl bg-white/5 border border-white/5 border-l-4 border-l-primary/40 hover:bg-white/10 transition-colors text-left">
                      <div className="flex items-center gap-4">
                          <span className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shadow-xl ${idx<3?'bg-primary text-black':'bg-white/5 text-gray-500'}`}>{idx+1}</span>
                          <span className="text-2xl font-black tracking-tight">{item.username}</span>
                      </div>
                      <span className="text-3xl font-mono font-black text-primary italic drop-shadow-[0_0_15px_rgba(0,242,255,0.4)]">{item.score}</span>
                    </div>
                  ))
                )}
              </div>
              <button onClick={() => setGameState('LANDING')} className="w-full btn-primary py-6 text-xl font-black uppercase rounded-3xl">Back to CommandCenter</button>
            </div>
          </motion.div>
        )}

        {gameState === 'TERMINATED' && (
          <motion.div key="terminated" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-screen p-8 relative z-50 bg-black text-center">
            <h2 className="text-4xl font-black text-gray-700 tracking-[0.5em] uppercase mb-4">Simulation Offline</h2>
            <p className="text-sm font-bold text-gray-800 tracking-widest uppercase">System powered down. You may close this tab.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <ModalWrapper isOpen={showSettings} onClose={() => { setShowSettings(false); setActiveControl(null); }} title={<>Simulation <br/>Settings</>}>
          <div className="space-y-6">
            <p className="text-gray-500 uppercase text-xs font-bold tracking-[0.2em] mb-4">Click a module to remap neural link</p>
            {Object.entries(controls).map(([action, key]) => (
              <div key={action} className="flex justify-between items-center font-mono group">
                <span className="text-gray-400 capitalize text-lg font-bold group-hover:text-primary transition-colors">{action}</span>
                <button 
                  onClick={() => setActiveControl(action)} 
                  className={`border-2 px-8 py-4 rounded-2xl transition-all font-black uppercase text-sm w-44 text-center ${
                    activeControl === action ? 'bg-primary text-black border-primary scale-110 shadow-[0_0_20px_rgba(0,242,255,0.4)]' : 'bg-white/5 border-white/10 text-accent hover:border-accent hover:text-white'
                  }`}
                >
                  {activeControl === action ? 'PRESS KEY' : key.replace('Key', '')}
                </button>
              </div>
            ))}
          </div>
      </ModalWrapper>

      <ModalWrapper isOpen={showPowerUpEdit} onClose={() => setShowPowerUpEdit(false)} title="Combat Modifiers" accentColor="accent">
           <div className="flex justify-between items-center mb-8">
               <p className="text-gray-500 uppercase text-xs tracking-widest font-bold">Deployable Tech Configurations</p>
               <div className={`px-4 py-2 rounded-full text-xs font-black tracking-widest ${tempPowerUps.length > 5 ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-white/5 text-accent border border-white/5'}`}>{tempPowerUps.length} / 5 SELECTED</div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {[
                { id: 'shield', name: 'Nano-Shield', icon: <Shield />, desc: 'Structural hull restoration' },
                { id: 'multishot', name: 'Tri-Core Firing', icon: <Layers />, desc: '3-way projectile spread' },
                { id: 'rapidfire', name: 'Overclock Drive', icon: <Zap />, desc: 'Extreme fire rate boost' },
                { id: 'slowmo', name: 'Temporal Warp', icon: <Timer />, desc: 'Slow all enemy particles' },
                { id: 'laser', name: 'Laser Beam', icon: <Zap />, desc: 'High-damage continuous beam' },
                { id: 'missiles', name: 'Missiles', icon: <Check />, desc: 'Damage everything on screen' },
                { id: 'sidecannons', name: 'Side Cannons', icon: <Layers />, desc: 'Fires in multiple directions' },
                { id: 'extralife', name: 'Extra Health', icon: <Shield />, desc: 'Restores hull completely' },
                { id: 'drone', name: 'Companion Drone', icon: <Play />, desc: 'Companion ship firepower' },
                { id: 'speedboost', name: 'Speed Boost', icon: <Zap />, desc: 'Increases maneuverability' }
              ].map(p => {
                const isSelected = tempPowerUps.includes(p.id);
                const isDisabled = !isSelected && tempPowerUps.length >= 5;
                return (
                <button key={p.id} 
                  disabled={isDisabled}
                  onClick={() => setTempPowerUps(prev => isSelected ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                  className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all text-left ${
                    isSelected ? 'border-accent bg-accent/5 text-white shadow-[0_0_15px_rgba(255,0,242,0.15)]' : 
                    isDisabled ? 'border-white/5 bg-black/50 text-gray-700 scale-95 opacity-30 cursor-not-allowed' : 
                    'border-white/5 bg-white/2 text-gray-500 scale-95 opacity-50 hover:bg-white/5'
                  }`}
                >
                  <div className={`p-4 rounded-2xl ${tempPowerUps.includes(p.id) ? 'bg-accent text-black' : 'bg-white/5'}`}>{p.icon}</div>
                  <div>
                    <div className="font-black uppercase tracking-tight text-lg">{p.name}</div>
                    <div className="text-[10px] opacity-60 uppercase font-bold">{p.desc}</div>
                  </div>
                </button>
              )})}
           </div>
           <div className="flex gap-4 mt-10">
              <button onClick={() => { setEnabledPowerUps([...tempPowerUps]); setShowPowerUpEdit(false); }} className="flex-1 btn-primary py-5 rounded-2xl flex items-center justify-center gap-3 text-xl font-black uppercase tracking-widest bg-accent border-accent shadow-[0_0_20px_rgba(255,0,242,0.3)]"><Check /> Apply</button>
              <button onClick={() => setShowPowerUpEdit(false)} className="flex-1 glass-card py-5 rounded-2xl font-black uppercase text-xs tracking-widest border-white/5 hover:text-white transition-colors">Cancel</button>
           </div>
      </ModalWrapper>

      <ModalWrapper isOpen={showQuitConfirm} onClose={() => setShowQuitConfirm(false)} title="Power Down?">
           <p className="text-gray-400 mb-8 text-lg font-bold">Are you sure you want to terminate the simulation?</p>
           <div className="flex gap-4 mt-6">
              <button onClick={() => { setGameState('TERMINATED'); setShowQuitConfirm(false); }} className="flex-1 btn-primary py-5 rounded-2xl flex items-center justify-center gap-3 text-xl font-black uppercase tracking-widest bg-red-600 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)]">Confirm</button>
              <button onClick={() => setShowQuitConfirm(false)} className="flex-1 glass-card py-5 rounded-2xl font-black uppercase text-xs tracking-widest border-white/5 hover:text-white transition-colors">Cancel</button>
           </div>
      </ModalWrapper>
    </div>
  );
}

export default App;
