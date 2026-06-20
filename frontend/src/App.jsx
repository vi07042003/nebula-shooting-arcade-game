import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ShootingGame from './components/ShootingGame';
import ShootingStars from './components/ShootingStars';
import axios from 'axios';
import { Trophy, Play, Home, RefreshCcw, Settings, X, LogOut, ChevronRight, Keyboard, Layers, Lock, Unlock, Skull, Link, Zap, Shield, Timer, Sliders, Check, Edit2, Loader2, MessageSquare, Send, RotateCcw, Cpu, Activity, Radio, BarChart2, ChevronDown, ChevronUp, ShoppingBag, Coins } from 'lucide-react';


const API_URL = 'http://localhost:8000';

// ──────────────────────────────────────────────
const AuraChatWidget = ({ pilotId, gameState, currentLevel, unlockedLevels, enabledPowerUps }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  
  const [messages, setMessages] = useState([
    { role: 'aura', text: 'Neural link established. I am AURA — your tactical AI navigator. Ask me anything about Nebula Strike strategies, power-ups, or sector tactics, Pilot.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usage, setUsage] = useState({
    active_model: 'Gemini 2.0 Flash',
    limits: {
      rpm_limit: 15,
      rpm_current: 0,
      tpm_limit: 1000000,
      tpm_current: 0,
      rpd_limit: 1500,
      rpd_current: 0
    }
  });

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const widgetRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && widgetRef.current && !widgetRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Fetch sessions and usage stats on open
  useEffect(() => {
    if (pilotId && isOpen) {
        fetchSessions();
        fetchUsage();
    }
  }, [pilotId, isOpen]);

  const fetchUsage = async () => {
    try {
      const res = await axios.get(`${API_URL}/ai/usage`);
      setUsage(res.data);
    } catch (e) {
      console.error("Failed to load usage stats", e);
    }
  };

  const fetchSessions = async () => {
      try {
          const res = await axios.get(`${API_URL}/ai/sessions/${pilotId}`);
          setSessions(res.data.sessions);
          if (res.data.sessions.length > 0 && !currentSessionId) {
              loadChat(res.data.sessions[0].session_id);
          } else if (res.data.sessions.length === 0 && !currentSessionId) {
              startNewChat();
          }
      } catch (e) {
          console.error("Failed to load sessions", e);
      }
  };

  const loadChat = async (sessionId) => {
      setCurrentSessionId(sessionId);
      setIsSidebarOpen(false);
      try {
          const res = await axios.get(`${API_URL}/ai/chat/${sessionId}`);
          if (res.data.messages.length > 0) {
              setMessages(res.data.messages);
          } else {
              setMessages([{ role: 'aura', text: 'Tactical session resumed. How can I assist, Pilot?' }]);
          }
      } catch (e) {
          setMessages([{ role: 'aura', text: 'Error loading session data.' }]);
      }
  };

  const startNewChat = async () => {
      try {
          const res = await axios.post(`${API_URL}/ai/chat/new`, { pilot_id: pilotId });
          setCurrentSessionId(res.data.session_id);
          setMessages([{ role: 'aura', text: 'New tactical session initialized. Standing by for queries.' }]);
          setIsSidebarOpen(false);
          fetchSessions();
      } catch (e) {
          console.error("Failed to create chat", e);
      }
  };

  const deleteChat = async (e, sessionId) => {
      e.stopPropagation();
      try {
          await axios.delete(`${API_URL}/ai/chat/${sessionId}`);
          setSessions(prev => prev.filter(s => s.session_id !== sessionId));
          if (currentSessionId === sessionId) {
              setCurrentSessionId(null);
              setMessages([{ role: 'aura', text: 'Session deleted.' }]);
              startNewChat();
          }
      } catch (e) {
          console.error("Failed to delete chat", e);
      }
  };

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading || !currentSessionId) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setIsLoading(true);
    try {
      const res = await axios.post(`${API_URL}/ai/chat`, {
        pilot_id: pilotId,
        session_id: currentSessionId,
        message: text,
        game_state: gameState,
        current_level: currentLevel,
        unlocked_levels: unlockedLevels,
        powerups: enabledPowerUps
      });
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.reply }]);
      if (res.data.usage) {
        setUsage(res.data.usage);
      } else {
        fetchUsage();
      }
      fetchSessions();
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Neural link interference detected. Please check backend connection and retry.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div ref={widgetRef}>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-8 right-8 z-[500] w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,242,255,0.4)] transition-all hover:scale-110 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #00f2ff, #7000ff)' }}
        title="Chat with AURA"
      >
        <AnimatePresence mode="wait">
          {isOpen
            ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X size={26} /></motion.div>
            : <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><MessageSquare size={26} /></motion.div>
          }
        </AnimatePresence>
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: '#00f2ff' }} />
      </button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-28 right-8 z-[499] w-[420px] flex flex-col rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,242,255,0.25)] border border-primary/20 bg-[#060608]/95 backdrop-blur-2xl"
            style={{ maxHeight: '80vh' }}
          >
            {/* Sidebar for History */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div initial={{ x: -420 }} animate={{ x: 0 }} exit={{ x: -420 }} className="absolute inset-0 z-50 bg-[#060608]/98 backdrop-blur-3xl flex flex-col border-r border-white/5">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <span className="font-black text-sm tracking-widest uppercase text-primary">Chat History</span>
                            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/10 rounded-xl"><X size={16} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            <button onClick={startNewChat} className="w-full text-left p-3 rounded-xl border border-primary/20 hover:bg-primary/10 text-primary font-bold text-sm flex items-center gap-2 mb-4"><MessageSquare size={16}/> New Session</button>
                            {sessions.map(s => (
                                <div key={s.session_id} onClick={() => loadChat(s.session_id)} className={`w-full p-3 rounded-xl flex justify-between items-center cursor-pointer transition-colors ${currentSessionId === s.session_id ? 'bg-primary/20 border-primary/40' : 'bg-white/5 hover:bg-white/10'} border border-transparent`}>
                                    <span className="text-sm truncate pr-2" style={{ maxWidth: '250px' }}>{s.title}</span>
                                    <button onClick={(e) => deleteChat(e, s.session_id)} className="text-red-500 hover:text-red-400 p-1"><X size={14}/></button>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex flex-col border-b border-white/10" style={{ background: 'linear-gradient(135deg, rgba(0,242,255,0.08), rgba(112,0,255,0.08))' }}>
              <div className="flex items-center gap-3 px-5 py-4">
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl mr-1">
                    <Layers size={18} />
                </button>
                <div className="relative">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center border border-primary/40 bg-primary/10 shadow-[0_0_15px_rgba(0,242,255,0.2)]">
                    <Cpu size={18} className="text-primary animate-pulse" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-black" />
                </div>
                <div className="flex-1">
                  <div className="font-black text-white text-sm tracking-wider flex items-center gap-2">
                    AURA 
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono font-bold uppercase tracking-widest">v2.1</span>
                  </div>
                  <div className="text-[10px] text-white/40 font-mono uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-ping" />
                    Neural Link Active
                  </div>
                </div>
                
                {/* Diagnostics Toggle */}
                <button 
                  onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-mono uppercase tracking-widest transition-all ${
                    isDiagnosticsOpen 
                      ? 'bg-primary/20 border-primary/40 text-primary shadow-[0_0_10px_rgba(0,242,255,0.15)]' 
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Activity size={10} />
                  Telemetry
                  {isDiagnosticsOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>
              </div>

              {/* Diagnostics Collapsible Telemetry Panel */}
              <AnimatePresence>
                {isDiagnosticsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-white/5 bg-black/40 px-5 font-mono text-[10px] text-white/70"
                  >
                    <div className="py-4 space-y-3">
                      <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
                        <span className="text-white/40 uppercase tracking-widest">Processor Model:</span>
                        <span className={`font-bold ${usage.active_model.includes('Gemini') ? 'text-primary' : 'text-purple-400'}`}>
                          {usage.active_model}
                        </span>
                      </div>

                      {/* RPM progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-white/50">
                          <span>Request Velocity (RPM)</span>
                          <span className={usage.limits.rpm_current >= 12 ? 'text-red-400 font-bold' : 'text-primary'}>
                            {usage.limits.rpm_current} / {usage.limits.rpm_limit}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 rounded-full ${usage.limits.rpm_current >= 12 ? 'bg-red-500' : 'bg-primary'}`}
                            style={{ width: `${(usage.limits.rpm_current / usage.limits.rpm_limit) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* TPM progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-white/50">
                          <span>Token Volume (TPM)</span>
                          <span>
                            {usage.limits.tpm_current.toLocaleString()} / {usage.limits.tpm_limit >= 1000000 ? '1M' : usage.limits.tpm_limit.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min((usage.limits.tpm_current / usage.limits.tpm_limit) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* RPD progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-white/50">
                          <span>Daily Allocation (RPD)</span>
                          <span>
                            {usage.limits.rpd_current} / {usage.limits.rpd_limit}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-accent rounded-full transition-all duration-300"
                            style={{ width: `${(usage.limits.rpd_current / usage.limits.rpd_limit) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Last request details */}
                      {usage.current_request && usage.current_request.total_tokens > 0 && (
                        <div className="bg-white/5 p-2 rounded-xl grid grid-cols-3 gap-1 text-center border border-white/5 mt-1">
                          <div className="flex flex-col">
                            <span className="text-white/30 text-[8px] uppercase">Input</span>
                            <span className="text-primary font-bold">{usage.current_request.prompt_tokens}t</span>
                          </div>
                          <div className="flex flex-col border-x border-white/5">
                            <span className="text-white/30 text-[8px] uppercase">Output</span>
                            <span className="text-accent font-bold">{usage.current_request.candidates_tokens}t</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-white/30 text-[8px] uppercase">Total</span>
                            <span className="text-white font-bold">{usage.current_request.total_tokens}t</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" style={{ minHeight: '300px' }}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${ msg.role === 'user' ? 'justify-end' : 'justify-start' } gap-2`}
                >
                  {(msg.role === 'assistant' || msg.role === 'aura' || msg.role === 'model') && (
                    <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-1 bg-primary/10 border border-primary/30">
                      <Cpu size={12} className="text-primary animate-pulse" />
                    </div>
                  )}
                  <div
                    className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                    style={{
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg, #7000ff, #00f2ff)'
                        : 'rgba(255,255,255,0.05)',
                      borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      border: (msg.role === 'user') ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: msg.role === 'user' ? '0 10px 20px rgba(112,0,255,0.2)' : 'none',
                      color: 'rgba(255,255,255,0.9)',
                    }}
                  >
                    {msg.text || msg.content}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-primary/10 border border-primary/30">
                    <Cpu size={12} className="text-primary animate-spin" />
                  </div>
                  <div className="flex gap-1.5 px-4 py-3 rounded-2xl bg-white/5 border border-white/10">
                    {[0, 0.2, 0.4].map((d, i) => (
                      <motion.div key={i} animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, delay: d, repeat: Infinity }} className="w-2 h-2 rounded-full bg-primary" />
                    ))}
                  </div>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10 flex gap-2 bg-black/20">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask AURA for tactical advice..."
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50 focus:bg-white/8 transition-all"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #00f2ff, #7000ff)' }}
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


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

const PLANES_CONFIG = {
  interceptor: {
    id: 'interceptor',
    name: 'Interceptor Alpha',
    cost: 0,
    imageSrc: '/player.png',
    rotation: 0,
    width: 90,
    height: 90,
    speed: 1.0,
    health: 1.0,
    damage: 1.0,
    firerate: 1.0,
    fuel: 1.0,
    desc: 'Standard issue galactic fighter. Balanced, reliable, and versatile.',
    colorClass: 'text-primary',
    bgGlow: 'shadow-[0_0_30px_rgba(0,242,255,0.2)]'
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom Shadow',
    cost: 2500,
    imageSrc: '/player_phantom.png',
    rotation: Math.PI / 2, // Rotate 90deg clockwise to point up
    width: 80,
    height: 80,
    speed: 1.4,
    health: 0.8,
    damage: 1.1,
    firerate: 1.25,
    fuel: 0.9,
    desc: 'Sleek scout ship utilizing gravitational slipstream tech. Exceptional speed and firing rates, but delicate hull plating.',
    colorClass: 'text-accent',
    bgGlow: 'shadow-[0_0_30px_rgba(112,0,255,0.2)]'
  },
  phoenix: {
    id: 'phoenix',
    name: 'Phoenix Devastator',
    cost: 6000,
    imageSrc: '/player_phoenix.png',
    rotation: 0,
    width: 105,
    height: 105,
    speed: 0.8,
    health: 1.5,
    damage: 1.4,
    firerate: 0.8,
    fuel: 1.25,
    desc: 'Heavy dreadnought powered by a plasma core. Slow speed, but boasts heavily reinforced hull armor and devastating weapon output.',
    colorClass: 'text-red-500',
    bgGlow: 'shadow-[0_0_30px_rgba(239,68,68,0.2)]'
  },
  monarch: {
    id: 'monarch',
    name: 'Void Monarch',
    cost: 12000,
    imageSrc: '/player_monarch.png',
    rotation: 0,
    width: 95,
    height: 95,
    speed: 1.2,
    health: 1.2,
    damage: 1.3,
    firerate: 1.15,
    fuel: 0.95,
    desc: 'Elite vanguard craft utilizing dark matter energy. Outstanding tactical capabilities across all systems.',
    colorClass: 'text-yellow-400',
    bgGlow: 'shadow-[0_0_30px_rgba(234,179,8,0.2)]'
  }
};

const UPGRADE_COSTS = [500, 1000, 2000, 4000, 8000];
const UPGRADES_CONFIG = [
  {
    key: 'health',
    name: 'Hull Plating Armor',
    desc: 'Increases structural integrity. Allows the ship to survive more direct hits.',
    icon: <Shield className="text-purple-400" size={24} />
  },
  {
    key: 'speed',
    name: 'Gravitational Thrusters',
    desc: 'Enhances sub-light engine velocity and maneuverability.',
    icon: <Zap className="text-cyan-400" size={24} />
  },
  {
    key: 'damage',
    name: 'Plasma Overclocking',
    desc: 'Increases primary weapon projectile energy damage.',
    icon: <Skull className="text-red-400" size={24} />
  },
  {
    key: 'firerate',
    name: 'Weapon Cooling Coils',
    desc: 'Increases the cyclic rate of fire by cooling firing chambers faster.',
    icon: <Timer className="text-yellow-400" size={24} />
  },
  {
    key: 'fuel',
    name: 'Fuel Cell Efficiencies',
    desc: 'Reduces the rate of fuel consumption during maneuvers.',
    icon: <Layers className="text-[#aaff00]" size={24} />
  }
];

function App() {
  const [gameState, setGameState] = useState('LANDING'); 
  const [currentLevel, setCurrentLevel] = useState(1);
  const [unlockedLevels, setUnlockedLevels] = useState(parseInt(localStorage.getItem('nebula_unlocked')) || 1);
  const [finalScore, setFinalScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [username, setUsername] = useState(localStorage.getItem('nebula_pilot') || 'Pilot_' + Math.floor(Math.random() * 1000));
  const [pilotId, setPilotId] = useState(localStorage.getItem('nebula_pilot_id') || 'id_' + Math.random().toString(36).substr(2, 9) + Date.now());
  
  // Coin and Hangar state
  const [coins, setCoins] = useState(() => parseInt(localStorage.getItem('nebula_coins')) || 0);
  const [purchasedPlanes, setPurchasedPlanes] = useState(() => {
    const saved = localStorage.getItem('nebula_purchased_planes');
    return saved ? JSON.parse(saved) : ['interceptor'];
  });
  const [selectedPlane, setSelectedPlane] = useState(() => localStorage.getItem('nebula_selected_plane') || 'interceptor');
  const [upgrades, setUpgrades] = useState(() => {
    const saved = localStorage.getItem('nebula_upgrades');
    return saved ? JSON.parse(saved) : { health: 0, speed: 0, damage: 0, firerate: 0, fuel: 0 };
  });
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [coinBreakdown, setCoinBreakdown] = useState({ base: 0, boss: 0, performance: 0, total: 0 });
  const [shopTab, setShopTab] = useState('ships');
  const [previewShipId, setPreviewShipId] = useState(() => localStorage.getItem('nebula_selected_plane') || 'interceptor');

  const [showSettings, setShowSettings] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [currentDemoSlide, setCurrentDemoSlide] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showPowerUpEdit, setShowPowerUpEdit] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [activeControl, setActiveControl] = useState(null);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [tempUsername, setTempUsername] = useState(username);
  const profileDrawerRef = useRef(null);
  const [playMode, setPlayMode] = useState(localStorage.getItem('nebula_playmode') || 'manual');

  useEffect(() => {
    localStorage.setItem('nebula_playmode', playMode);
  }, [playMode]);
  
  const [enabledPowerUps, setEnabledPowerUps] = useState(JSON.parse(localStorage.getItem('nebula_powerups')) || ['shield', 'multishot', 'rapidfire', 'slowmo']);
  const [tempPowerUps, setTempPowerUps] = useState([]);

  const [tempControls, setTempControls] = useState({});
  const [controls, setControls] = useState(JSON.parse(localStorage.getItem('nebula_controls')) || {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'Space'
  });

  const [gestureSettings, setGestureSettings] = useState(() => {
    const saved = localStorage.getItem('nebula_gesture_settings');
    return saved ? JSON.parse(saved) : {
      detectionConfidence: 0.5,
      trackingConfidence: 0.5,
      fistThreshold: 0.65,
      mirrorFeed: true,
      modelComplexity: 1
    };
  });
  const [tempGestureSettings, setTempGestureSettings] = useState({ ...gestureSettings });

  useEffect(() => {
    localStorage.setItem('nebula_gesture_settings', JSON.stringify(gestureSettings));
  }, [gestureSettings]);

  useEffect(() => {
    localStorage.setItem('nebula_coins', coins.toString());
  }, [coins]);

  useEffect(() => {
    localStorage.setItem('nebula_purchased_planes', JSON.stringify(purchasedPlanes));
  }, [purchasedPlanes]);

  useEffect(() => {
    localStorage.setItem('nebula_selected_plane', selectedPlane);
  }, [selectedPlane]);

  useEffect(() => {
    localStorage.setItem('nebula_upgrades', JSON.stringify(upgrades));
  }, [upgrades]);

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
    if (isDemoMode) {
      setIsDemoMode(false);
      setGameState('LANDING');
      return;
    }
    
    let baseReward = 0;
    let bossReward = 0;
    let perfReward = 0;
    let totalReward = 0;

    if (won) {
      baseReward = currentLevel * 150;
      if (currentLevel % 5 === 0) {
        bossReward = currentLevel * 250;
      }
      perfReward = Math.floor(score / 50);
      totalReward = baseReward + bossReward + perfReward;
    } else {
      perfReward = Math.floor(score / 150);
      totalReward = perfReward;
    }

    setEarnedCoins(totalReward);
    setCoinBreakdown({
      base: baseReward,
      boss: bossReward,
      performance: perfReward,
      total: totalReward
    });

    setCoins(prev => prev + totalReward);
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
  const updateControl = (action, key) => { setTempControls(prev => ({ ...prev, [action]: key })); };
  const isBossLevel = (lvl) => lvl % 5 === 0;

  const openSettings = () => {
    setTempControls({ ...controls });
    setTempGestureSettings({ ...gestureSettings });
    setShowSettings(true);
  };

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

      {/* AURA Chat Widget — visible on all screens */}
      <AuraChatWidget 
          pilotId={pilotId} 
          gameState={gameState} 
          currentLevel={currentLevel} 
          unlockedLevels={unlockedLevels} 
          enabledPowerUps={enabledPowerUps} 
      />

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

            <div className="absolute top-8 right-8 flex gap-3 items-center">
              {/* Coins display */}
              <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-[1.5rem] px-5 py-2.5 text-yellow-400 font-mono font-black text-lg shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                <Coins size={18} className="text-yellow-400 animate-pulse" />
                <span>{coins.toLocaleString()}</span>
              </div>
              
              <button title="Space Hangar & Shop" onClick={() => setGameState('SHOP')} className="px-5 py-3 glass-card hover:bg-white/10 transition-all border-yellow-500/20 text-yellow-400 flex items-center gap-2.5 shadow-[0_0_15px_rgba(234,179,8,0.08)] hover:scale-105 active:scale-95">
                <ShoppingBag size={18} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Shop</span>
              </button>

              <button title="Training Simulation" onClick={() => { setShowDemo(true); setCurrentDemoSlide(0); }} className="px-5 py-3 glass-card hover:bg-white/10 transition-all border-primary/20 text-primary flex items-center gap-2.5 shadow-[0_0_15px_rgba(0,242,255,0.08)]">
                <Play size={18} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Demo</span>
              </button>
              <button title="Simulation Config" onClick={openPowerUpEditor} className="px-5 py-3 glass-card hover:bg-white/10 transition-all border-accent/20 text-accent flex items-center gap-2.5">
                <Zap size={18} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Power-Ups</span>
              </button>
              <button title="Tactical Settings" onClick={openSettings} className="px-5 py-3 glass-card hover:bg-white/10 transition-all border-white/5 text-gray-300 flex items-center gap-2.5">
                <Settings size={18} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Settings</span>
              </button>
              <button title="Power Down" onClick={() => setShowQuitConfirm(true)} className="px-5 py-3 glass-card hover:bg-red-500/20 text-red-500 transition-all border-red-500/10 hover:border-red-500/50 flex items-center gap-2.5">
                <LogOut size={18} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Quit</span>
              </button>
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
                  transition={{ delay: 0.9, duration: 0.8, ease: "easeOut" }}
                  className="flex flex-col gap-3 pt-4 text-left"
                >
                  <label className="text-[10px] uppercase tracking-[0.3em] font-black text-gray-500">Neural Control Interface</label>
                  <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-[1.5rem] w-fit">
                    <button 
                      onClick={() => setPlayMode('manual')}
                      className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                        playMode === 'manual' 
                          ? 'bg-primary text-black shadow-[0_0_20px_rgba(0,242,255,0.3)] font-bold' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      Keyboard
                    </button>
                    <button 
                      onClick={() => setPlayMode('gesture')}
                      className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
                        playMode === 'gesture' 
                          ? 'bg-accent text-black shadow-[0_0_20px_rgba(255,0,242,0.3)] font-bold' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      Hand Gestures
                    </button>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1, duration: 0.8, ease: "easeOut" }}
                  className="flex gap-6 pt-2"
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
            <ShootingGame
              level={currentLevel}
              onGameOver={handleGameOver}
              onQuit={() => { setIsDemoMode(false); setGameState(isDemoMode ? 'LANDING' : 'STAGES'); }}
              onOpenSettings={openSettings}
              controls={controls}
              enabledPowerUps={enabledPowerUps}
              isDemoMode={isDemoMode}
              playMode={playMode}
              gestureSettings={gestureSettings}
              
              selectedPlane={selectedPlane}
              planeImageSrc={PLANES_CONFIG[selectedPlane].imageSrc}
              planeRotation={PLANES_CONFIG[selectedPlane].rotation}
              planeWidth={PLANES_CONFIG[selectedPlane].width}
              planeHeight={PLANES_CONFIG[selectedPlane].height}
              speedMultiplier={PLANES_CONFIG[selectedPlane].speed * (1 + upgrades.speed * 0.1)}
              maxHealth={Math.round(PLANES_CONFIG[selectedPlane].health * (100 + upgrades.health * 15))}
              damageMultiplier={PLANES_CONFIG[selectedPlane].damage * (1 + upgrades.damage * 0.2)}
              fireRateMultiplier={PLANES_CONFIG[selectedPlane].firerate * (1 - upgrades.firerate * 0.08)}
              fuelUsageMultiplier={PLANES_CONFIG[selectedPlane].fuel * (1 - upgrades.fuel * 0.08)}
              pilotHighScore={leaderboard.find(e => e.pilot_id === pilotId)?.score || 0}
            />
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div key="gameover" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center min-h-screen relative z-10 p-6 bg-red-950/20">
            <div className="glass-card p-16 max-w-xl w-full border-t-[12px] border-t-red-600 shadow-[0_0_100px_rgba(220,38,38,0.2)]">
              <div className="flex flex-col items-center gap-6 mb-8 text-center">
                  <div className="w-24 h-24 rounded-full bg-red-600/10 border-4 border-red-600 flex items-center justify-center animate-bounce mx-auto"><X size={64} className="text-red-600" /></div>
                  <h2 className="text-7xl font-black text-red-600 mb-2 italic tracking-tighter uppercase leading-none mt-4">Simulation <br/> Failure</h2>
              </div>
              
              <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 mb-8 flex flex-col gap-3 font-mono text-left">
                <h3 className="text-lg font-black text-red-500 uppercase tracking-widest border-b border-white/15 pb-2 mb-2 flex items-center gap-2">
                  <Coins className="text-yellow-400 animate-pulse" size={20} /> CONSOLATION CREDITS
                </h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Combat Performance:</span>
                  <span className="text-white font-bold">+{coinBreakdown.performance} Credits</span>
                </div>
                <div className="border-t border-white/10 pt-3 mt-1 flex justify-between text-xl font-black text-yellow-400">
                  <span>TOTAL EARNED:</span>
                  <span className="flex items-center gap-1.5">
                    <Coins size={22} />
                    +{coinBreakdown.total}
                  </span>
                </div>
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
              <div className="flex flex-col items-center gap-6 mb-8 text-center">
                  <div className="w-24 h-24 rounded-full bg-green-500/10 border-4 border-green-500 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)] mx-auto"><Unlock size={64} className="text-green-500" /></div>
                  <h2 className="text-7xl font-black text-green-500 mb-2 italic tracking-tighter uppercase leading-none mt-4">Sector <br/> SECURED</h2>
              </div>
              
              <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 mb-8 flex flex-col gap-3 font-mono">
                <h3 className="text-lg font-black text-primary uppercase tracking-widest border-b border-white/15 pb-2 mb-2 flex items-center gap-2">
                  <Coins className="text-yellow-400 animate-pulse" size={20} /> MISSION REWARDS
                </h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Sector Completion:</span>
                  <span className="text-white font-bold">+{coinBreakdown.base} Credits</span>
                </div>
                {coinBreakdown.boss > 0 && (
                  <div className="flex justify-between text-sm text-red-400">
                    <span>Flagship Defeated Bonus:</span>
                    <span className="font-bold">+{coinBreakdown.boss} Credits</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Combat Performance:</span>
                  <span className="text-white font-bold">+{coinBreakdown.performance} Credits</span>
                </div>
                <div className="border-t border-white/10 pt-3 mt-1 flex justify-between text-xl font-black text-yellow-400">
                  <span>TOTAL EARNED:</span>
                  <span className="flex items-center gap-1.5">
                    <Coins size={22} className="animate-bounce" />
                    +{coinBreakdown.total}
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <button onClick={() => (currentLevel < 20 ? startLevel(currentLevel+1) : setGameState('STAGES'))} className="btn-primary w-full flex items-center justify-center gap-4 py-8 rounded-[2.5rem] text-3xl font-black shadow-2xl hover:scale-105 transition-all"><ChevronRight size={36} /> NEXT QUADRANT</button>
                <button onClick={() => setGameState('STAGES')} className="w-full glass-card py-5 flex items-center justify-center gap-3 hover:bg-white/10 uppercase font-black text-xs tracking-[0.4em] border-white/5 transition-all"><Layers size={20} /> RETURN TO HQ</button>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'SHOP' && (
          <motion.div 
            key="shop" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setGameState('LANDING'); }}
            className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8 relative z-10 bg-black/60 backdrop-blur-sm overflow-hidden cursor-pointer"
          >
            <div 
              className="glass-card p-6 md:p-8 max-w-5xl w-full max-h-[85vh] flex flex-col border-t-4 border-t-yellow-500 text-left overflow-hidden shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4 flex-shrink-0">
                <div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">Galactic <span className="text-yellow-400">Hangar & Shop</span></h2>
                  <p className="text-gray-500 uppercase tracking-[0.4em] text-[9px] font-black mt-2">Upgrade ship sub-systems and acquire advanced starfighters</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-[1.5rem] px-5 py-2.5 text-yellow-400 font-mono font-black text-lg shadow-[0_0_20px_rgba(234,179,8,0.15)]">
                    <Coins size={20} className="text-yellow-400 animate-pulse" />
                    <span>{coins.toLocaleString()}</span>
                  </div>
                  <button onClick={() => setGameState('LANDING')} className="bg-white/5 p-4 rounded-2xl hover:bg-white/10 transition-all border border-white/5"><Home size={22} /></button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-[1.5rem] w-fit mb-6 flex-shrink-0">
                <button 
                  onClick={() => setShopTab('ships')}
                  className={`px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                    shopTab === 'ships' 
                      ? 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)] font-bold' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Starfighters
                </button>
                <button 
                  onClick={() => setShopTab('upgrades')}
                  className={`px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                    shopTab === 'upgrades' 
                      ? 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)] font-bold' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  System Upgrades
                </button>
              </div>

              {/* Scrollable Content Container */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 mb-6">
                {shopTab === 'ships' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {/* Ship Grid */}
                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.values(PLANES_CONFIG).map(ship => {
                        const isOwned = purchasedPlanes.includes(ship.id);
                        const isEquipped = selectedPlane === ship.id;
                        const isCurrentPreview = previewShipId === ship.id;
                        return (
                          <button
                            key={ship.id}
                            onClick={() => setPreviewShipId(ship.id)}
                            className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all text-left ${
                              isCurrentPreview
                                ? 'border-yellow-400 bg-yellow-400/5 shadow-[0_0_15px_rgba(234,179,8,0.15)]'
                                : 'border-white/5 bg-white/2 hover:bg-white/5'
                            }`}
                          >
                            <div className={`w-16 h-16 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center p-2 relative overflow-hidden shrink-0`}>
                              <div className={`absolute inset-2 rounded-full filter blur-md opacity-25 ${ship.colorClass === 'text-primary' ? 'bg-primary' : ship.colorClass === 'text-accent' ? 'bg-purple-600' : ship.colorClass === 'text-red-500' ? 'bg-red-600' : 'bg-yellow-500'}`} />
                              <img
                                src={`${ship.imageSrc}?v=3`}
                                alt={ship.name}
                                className="w-10 h-10 object-contain relative z-10"
                                style={{ transform: ship.rotation ? `rotate(${ship.rotation}rad)` : 'none' }}
                              />
                            </div>
                            <div className="flex-1">
                              <div className="font-black uppercase tracking-tight text-md">{ship.name}</div>
                              <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mt-1">
                                {isEquipped ? (
                                  <span className="text-green-400 flex items-center gap-1"><Check size={12}/> Equipped</span>
                                ) : isOwned ? (
                                  <span className="text-gray-400">Owned</span>
                                ) : (
                                  <span className="text-yellow-400 font-mono">{ship.cost.toLocaleString()} Credits</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
 
                    {/* Ship Detail Preview */}
                    {(() => {
                      const previewShip = PLANES_CONFIG[previewShipId];
                      const isOwned = purchasedPlanes.includes(previewShipId);
                      const isEquipped = selectedPlane === previewShipId;
                      return (
                        <div className="bg-white/5 border border-white/5 rounded-[2rem] p-6 flex flex-col justify-between items-center text-center">
                          <div className="w-full flex flex-col items-center">
                            <span className={`text-[10px] uppercase tracking-[0.3em] font-black ${previewShip.colorClass} mb-1`}>Class Starfighter</span>
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">{previewShip.name}</h3>
                            
                            <div className="relative my-4 w-full h-36 flex items-center justify-center gap-6">
                              <div className={`absolute inset-x-8 inset-y-2 rounded-full filter blur-2xl opacity-25 ${previewShip.colorClass === 'text-primary' ? 'bg-primary' : previewShip.colorClass === 'text-accent' ? 'bg-purple-600' : previewShip.colorClass === 'text-red-500' ? 'bg-red-600' : 'bg-yellow-500'}`} />
                              <motion.div 
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                className="relative z-10"
                              >
                                <img 
                                  src={`${previewShip.imageSrc}?v=3`}
                                  alt={previewShip.name} 
                                  className="w-20 h-20 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                                  style={{ transform: previewShip.rotation ? `rotate(${previewShip.rotation}rad)` : 'none' }}
                                />
                              </motion.div>
                            </div>

                            <p className="text-gray-400 text-[10px] leading-relaxed max-w-sm mb-4 uppercase text-center font-medium">{previewShip.desc}</p>
                            
                            {/* Stat bars */}
                            <div className="w-full space-y-3 mb-6">
                              <div>
                                <div className="flex justify-between text-[9px] font-mono mb-1 text-gray-400">
                                  <span>Engine Velocity</span>
                                  <span className="font-bold text-white">{(previewShip.speed * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${(previewShip.speed / 2.0) * 100}%` }} />
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between text-[9px] font-mono mb-1 text-gray-400">
                                  <span>Hull Armor</span>
                                  <span className="font-bold text-white">{(previewShip.health * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(previewShip.health / 2.0) * 100}%` }} />
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between text-[9px] font-mono mb-1 text-gray-400">
                                  <span>Plasma Firepower</span>
                                  <span className="font-bold text-white">{(previewShip.damage * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${(previewShip.damage / 2.0) * 100}%` }} />
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between text-[9px] font-mono mb-1 text-gray-400">
                                  <span>Firing Cooldown</span>
                                  <span className="font-bold text-white">{(previewShip.firerate * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(previewShip.firerate / 2.0) * 100}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="w-full">
                            {isOwned ? (
                              isEquipped ? (
                                <button disabled className="w-full py-3 rounded-xl border border-green-500/20 bg-green-500/10 text-green-400 font-black text-[10px] tracking-widest uppercase flex items-center justify-center gap-2">
                                  <Check size={14} /> ACTIVE STARFIGHTER
                                </button>
                              ) : (
                                <button 
                                  onClick={() => setSelectedPlane(previewShipId)} 
                                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black text-[10px] tracking-widest uppercase border border-white/10 transition-colors"
                                >
                                  EQUIP STARFIGHTER
                                </button>
                              )
                            ) : (
                              <button 
                                onClick={() => {
                                  if (coins >= previewShip.cost) {
                                    setCoins(prev => prev - previewShip.cost);
                                    setPurchasedPlanes(prev => [...prev, previewShipId]);
                                    setSelectedPlane(previewShipId);
                                  }
                                }}
                                disabled={coins < previewShip.cost}
                                className={`w-full py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-colors flex items-center justify-center gap-2 ${
                                  coins >= previewShip.cost 
                                    ? 'bg-yellow-400 hover:bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.25)]' 
                                    : 'bg-white/5 border border-white/5 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                <Coins size={14} /> ACQUIRE STARFIGHTER · {previewShip.cost}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {UPGRADES_CONFIG.map(upg => {
                      const currentLvl = upgrades[upg.key] || 0;
                      const isMaxed = currentLvl >= 5;
                      const nextCost = UPGRADE_COSTS[currentLvl];
                      const canAfford = coins >= nextCost;
                      return (
                        <div key={upg.key} className="glass-card p-6 border-l-4 border-l-yellow-500/40 flex justify-between items-center bg-white/2">
                          <div className="flex gap-4 items-start flex-1 mr-4">
                            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center">
                              {upg.icon}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-black uppercase tracking-tight text-lg text-white">{upg.name}</h4>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5 leading-relaxed">{upg.desc}</p>
                              
                              <div className="flex gap-1.5 mt-3">
                                {Array.from({ length: 5 }).map((_, idx) => (
                                  <div 
                                    key={idx} 
                                    className={`w-6 h-3.5 rounded-md transition-all ${
                                      idx < currentLvl 
                                        ? 'bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.5)] border border-yellow-300/20' 
                                        : 'bg-white/5 border border-white/5'
                                    }`} 
                                  />
                                ))}
                                <span className="text-[10px] font-black font-mono ml-2 text-yellow-400/80 mt-0.5">LVL {currentLvl}/5</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end justify-center min-w-[120px]">
                            {isMaxed ? (
                              <span className="text-[10px] font-black uppercase text-green-400 border border-green-500/20 bg-green-500/10 px-4 py-2.5 rounded-xl tracking-wider">MAX LEVEL</span>
                            ) : (
                              <button
                                onClick={() => {
                                  if (canAfford) {
                                    setCoins(prev => prev - nextCost);
                                    setUpgrades(prev => ({
                                      ...prev,
                                      [upg.key]: currentLvl + 1
                                    }));
                                  }
                                }}
                                disabled={!canAfford}
                                className={`px-5 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-colors flex flex-col items-center gap-0.5 ${
                                  canAfford
                                    ? 'bg-yellow-400 hover:bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                                    : 'bg-white/5 border border-white/5 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                <span>UPGRADE</span>
                                <span className="text-[9px] font-mono opacity-80">{nextCost} CR</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-white/10 flex justify-end flex-shrink-0">
                <button onClick={() => setGameState('LANDING')} className="btn-primary py-3.5 px-8 text-xs font-black uppercase rounded-xl flex items-center gap-2"><Check size={16} /> Back to CommandCenter</button>
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
            <div className="border-b border-white/10 pb-6 mb-4">
              <label className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-500 block mb-3">Neural Playback Interface</label>
              <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl w-full">
                <button 
                  onClick={() => setPlayMode('manual')}
                  className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                    playMode === 'manual' 
                      ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,242,255,0.25)]' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Keyboard
                </button>
                <button 
                  onClick={() => setPlayMode('gesture')}
                  className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                    playMode === 'gesture' 
                      ? 'bg-accent text-black shadow-[0_0_15px_rgba(255,0,242,0.25)]' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Hand Gestures
                </button>
              </div>
            </div>
            {playMode === 'manual' ? (
              <>
                <p className="text-gray-500 uppercase text-xs font-bold tracking-[0.2em] mb-4">Click a module to remap neural link</p>
                {Object.entries(tempControls).map(([action, key]) => (
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
              </>
            ) : (
              <div className="space-y-6">
                <p className="text-gray-500 uppercase text-xs font-bold tracking-[0.2em] mb-4">Neural Hand Gesture Calibrations</p>
                
                {/* Detection Confidence */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-gray-400 font-bold">Detection Confidence</span>
                    <span className="text-accent">{Math.round(tempGestureSettings.detectionConfidence * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1.0" 
                    step="0.05"
                    value={tempGestureSettings.detectionConfidence}
                    onChange={(e) => setTempGestureSettings(prev => ({ ...prev, detectionConfidence: parseFloat(e.target.value) }))}
                    className="w-full accent-accent bg-white/10 h-2 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-500">Minimum confidence value for hand detection to be considered successful.</span>
                </div>

                {/* Tracking Confidence */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-gray-400 font-bold">Tracking Confidence</span>
                    <span className="text-accent">{Math.round(tempGestureSettings.trackingConfidence * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1.0" 
                    step="0.05"
                    value={tempGestureSettings.trackingConfidence}
                    onChange={(e) => setTempGestureSettings(prev => ({ ...prev, trackingConfidence: parseFloat(e.target.value) }))}
                    className="w-full accent-accent bg-white/10 h-2 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-500">Minimum confidence value for hand tracking to prevent jitter.</span>
                </div>

                {/* Fist Closure Sensitivity */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-gray-400 font-bold">Fist Closure Threshold</span>
                    <span className="text-accent">{Math.round(tempGestureSettings.fistThreshold * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.4" 
                    max="0.9" 
                    step="0.05"
                    value={tempGestureSettings.fistThreshold}
                    onChange={(e) => setTempGestureSettings(prev => ({ ...prev, fistThreshold: parseFloat(e.target.value) }))}
                    className="w-full accent-accent bg-white/10 h-2 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-500">Lower threshold requires a tighter fist to trigger Teleport Charging.</span>
                </div>

                {/* Mirror Feed & Model Complexity */}
                <div className="flex justify-between items-center py-2 border-t border-white/5">
                  <span className="text-gray-400 text-sm font-bold">Mirror Camera Feed</span>
                  <button 
                    onClick={() => setTempGestureSettings(prev => ({ ...prev, mirrorFeed: !prev.mirrorFeed }))}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      tempGestureSettings.mirrorFeed ? 'bg-accent text-black shadow-[0_0_15px_rgba(255,0,242,0.25)]' : 'bg-white/5 text-gray-400 border border-white/10'
                    }`}
                  >
                    {tempGestureSettings.mirrorFeed ? 'Mirrored' : 'Normal'}
                  </button>
                </div>

                <div className="flex justify-between items-center py-2 border-t border-white/5">
                  <span className="text-gray-400 text-sm font-bold">Model Complexity</span>
                  <div className="flex bg-white/5 border border-white/10 p-0.5 rounded-xl">
                    <button 
                      onClick={() => setTempGestureSettings(prev => ({ ...prev, modelComplexity: 0 }))}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        tempGestureSettings.modelComplexity === 0 ? 'bg-accent text-black' : 'text-gray-400'
                      }`}
                    >
                      Fast
                    </button>
                    <button 
                      onClick={() => setTempGestureSettings(prev => ({ ...prev, modelComplexity: 1 }))}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        tempGestureSettings.modelComplexity === 1 ? 'bg-accent text-black' : 'text-gray-400'
                      }`}
                    >
                      High Q
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {(() => {
              const controlsChanged = JSON.stringify(tempControls) !== JSON.stringify(controls);
              const gestureSettingsChanged = JSON.stringify(tempGestureSettings) !== JSON.stringify(gestureSettings);
              const hasChanges = controlsChanged || gestureSettingsChanged;
              return (
                <div className="flex gap-4 mt-10">
                    <button 
                      disabled={!hasChanges}
                      onClick={() => {
                        setControls({ ...tempControls });
                        setGestureSettings({ ...tempGestureSettings });
                        setShowSettings(false);
                      }}
                      className={`flex-1 text-lg font-black uppercase tracking-widest py-4 rounded-2xl transition-all border flex items-center justify-center gap-2 ${
                        hasChanges 
                          ? 'bg-primary text-black border-primary shadow-[0_0_30px_rgba(0,242,255,0.5)] animate-pulse scale-105' 
                          : 'bg-primary/20 text-primary border-primary/20 opacity-50 cursor-default'
                      }`}
                    >
                      <Check size={20} /> Apply
                    </button>
                    <button 
                      onClick={() => {
                        setShowSettings(false);
                        setActiveControl(null);
                      }}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 text-lg font-black uppercase tracking-widest py-4 rounded-2xl transition-colors border border-white/5"
                    >
                      Cancel
                    </button>
                </div>
              );
            })()}
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
           {(() => {
             const hasChanges = JSON.stringify([...tempPowerUps].sort()) !== JSON.stringify([...enabledPowerUps].sort());
             return (
               <div className="flex gap-4 mt-10">
                  <button 
                    onClick={() => { setEnabledPowerUps([...tempPowerUps]); setShowPowerUpEdit(false); }} 
                    className={`flex-1 py-5 rounded-2xl flex items-center justify-center gap-3 text-xl font-black uppercase tracking-widest transition-all border ${
                      hasChanges 
                        ? 'bg-accent border-accent text-white shadow-[0_0_30px_rgba(255,0,242,0.5)] animate-pulse scale-105' 
                        : 'bg-accent/20 border-accent/20 text-accent opacity-50 cursor-default'
                    }`}
                  >
                    <Check /> Apply
                  </button>
                  <button onClick={() => setShowPowerUpEdit(false)} className="flex-1 glass-card py-5 rounded-2xl font-black uppercase text-xs tracking-widest border-white/5 hover:text-white transition-colors">Cancel</button>
               </div>
             );
           })()}
      </ModalWrapper>

      <ModalWrapper isOpen={showDemo} onClose={() => setShowDemo(false)} title="Training Uplink">
          <div className="relative overflow-hidden min-h-[400px] flex flex-col">
              <AnimatePresence mode="wait">
                  <motion.div 
                    key={currentDemoSlide}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex-1 space-y-8 py-6"
                  >
                      {(() => {
                          const slides = [
                              {
                                  title: "Nebula Mission",
                                  desc: "Pilot, your mission is to secure the outer sectors. Engage enemy forces and survive the onslaught of the Nebula fleet.",
                                  icon: <Play size={80} className="text-primary animate-pulse" />,
                                  color: "primary"
                              },
                              {
                                  title: "Neural Control",
                                  desc: "Direct neural link established. Use WASD to maneuver your craft and SPACE to unleash primary weapons. Precision is key.",
                                  icon: <Keyboard size={80} className="text-accent" />,
                                  color: "accent"
                              },
                              {
                                  title: "Combat Mods",
                                  desc: "Collect power-ups to enhance your hull, fire rate, and weapon systems. Adapt your loadout to dominate the battlefield.",
                                  icon: <Zap size={80} className="text-yellow-400" />,
                                  color: "yellow-400"
                              },
                              {
                                  title: "Flagship Protocol",
                                  desc: "Clear sectors to reach the flagship. Defeating bosses unlocks new quadrants and advanced simulation technology.",
                                  icon: <Skull size={80} className="text-red-500" />,
                                  color: "red-500"
                              }
                          ];
                          const slide = slides[currentDemoSlide];
                          return (
                              <div className="flex flex-col items-center text-center space-y-6">
                                  <div className={`w-32 h-32 rounded-3xl bg-${slide.color}/10 border-2 border-${slide.color}/20 flex items-center justify-center shadow-[0_0_30px_rgba(0,242,255,0.1)]`}>
                                      {slide.icon}
                                  </div>
                                  <div className="space-y-4">
                                      <h3 className={`text-4xl font-black italic uppercase tracking-tighter text-${slide.color}`}>{slide.title}</h3>
                                      <p className="text-gray-400 text-lg leading-relaxed max-w-sm">{slide.desc}</p>
                                  </div>
                              </div>
                          );
                      })()}
                  </motion.div>
              </AnimatePresence>

              <div className="flex justify-between items-center mt-auto pt-8 border-t border-white/5">
                  <div className="flex gap-2">
                      {[0, 1, 2, 3].map(i => (
                          <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentDemoSlide ? 'w-8 bg-primary' : 'w-2 bg-white/10'}`} />
                      ))}
                  </div>
                  <div className="flex gap-4">
                      {currentDemoSlide > 0 && (
                          <button onClick={() => setCurrentDemoSlide(prev => prev - 1)} className="px-6 py-2 glass-card hover:bg-white/5 text-gray-500 uppercase text-[10px] font-black tracking-widest transition-colors">Previous</button>
                      )}
                      <button 
                        onClick={() => {
                            if (currentDemoSlide < 3) {
                              setCurrentDemoSlide(prev => prev + 1);
                            } else {
                              setShowDemo(false);
                              setIsDemoMode(true);
                              setCurrentLevel(1);
                              setGameState('PLAYING');
                            }
                        }} 
                        className="btn-primary px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em]"
                      >
                        {currentDemoSlide < 3 ? 'Next Data' : '🚀 Launch Demo'}
                      </button>
                  </div>
              </div>
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
