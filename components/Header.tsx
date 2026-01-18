
import React, { useState, useEffect } from 'react';
import { ViewState } from '../types';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Zap, Activity } from 'lucide-react';
import { checkOnlineStatus } from '../services/geminiService';

interface HeaderProps {
  viewState: ViewState;
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ viewState, onOpenSettings }) => {
  const [isOnline, setIsOnline] = useState(checkOnlineStatus());

  useEffect(() => {
    const handleStatus = () => {
      const newStatus = checkOnlineStatus();
      if (newStatus !== isOnline) {
        // Log system mode changes for debugging
        if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
          console.warn('UI MODE INDICATOR CHANGE', {
            source: 'Header',
            previousState: isOnline ? 'ONLINE' : 'OFFLINE',
            newState: newStatus ? 'ONLINE' : 'OFFLINE',
            trigger: 'Status check interval or browser event'
          });
        }
      }
      setIsOnline(newStatus);
    };
    
    // Log browser-level network events
    const handleBrowserOnline = () => {
      console.log('[Network Event] Browser detected online');
      handleStatus();
    };
    
    const handleBrowserOffline = () => {
      console.warn('[Network Event] Browser detected offline');
      handleStatus();
    };
    
    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);
    const interval = setInterval(handleStatus, 5000); // Proactive poll
    return () => {
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
      clearInterval(interval);
    };
  }, [isOnline]);

  const steps = [
    { label: 'Inventory', state: ViewState.DASHBOARD },
    { label: 'Synthesis', state: [ViewState.CUISINE_SELECTOR, ViewState.SYNTHESIS] },
    { label: 'Execution', state: ViewState.EXECUTION },
  ];

  return (
    <header className="fixed top-0 left-0 w-full z-[100] px-8 py-6 flex justify-between items-center pointer-events-none">
      <div className="flex items-center gap-3 pointer-events-auto">
        <div className="w-7 h-7 bg-[#0A0A0B] rounded-lg flex items-center justify-center border border-[#C5A028]/10 shadow-sm">
          <div className="w-1.5 h-1.5 bg-[#C5A028] rounded-full"></div>
        </div>
        <span className="font-bold tracking-tighter text-lg text-[#0A0A0B] select-none">CulinaryLens</span>
      </div>
      
      <nav className="flex items-center gap-8 px-8 py-2.5 bg-white/60 backdrop-blur-3xl rounded-full pointer-events-auto shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] border border-black/[0.03]">
        {steps.map((step, i) => {
          const isActive = Array.isArray(step.state) 
            ? step.state.includes(viewState)
            : step.state === viewState;
          
          return (
            <div key={i} className="relative group cursor-default">
              <span className={`text-[9px] uppercase tracking-[0.2em] font-bold transition-colors duration-500 ${isActive ? 'text-[#0A0A0B]' : 'text-black/30'}`}>
                {step.label}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="header-active-marker"
                  className="absolute -bottom-1.5 left-0 w-full h-[1px] bg-[#C5A028]"
                  transition={{ type: "spring", stiffness: 350, damping: 35 }}
                />
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 pointer-events-auto">
         <button 
           onClick={onOpenSettings}
           className={`p-2 rounded-full border transition-all duration-500 ${viewState === ViewState.SETTINGS ? 'bg-[#0A0A0B] text-white border-black' : 'bg-white text-black/30 border-black/[0.04] hover:text-black hover:border-black/10 shadow-sm'}`}
         >
            <SettingsIcon size={12} />
         </button>
         <div className={`px-4 py-1.5 backdrop-blur-md border rounded-full flex items-center gap-2.5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.02)] transition-all duration-700 ${isOnline ? 'bg-white/80 border-black/[0.05]' : 'bg-[#1A1A1D] border-white/10'}`}>
            {isOnline ? (
              <>
                <div className="w-1 h-1 bg-[#C5A028] rounded-full animate-pulse"></div>
                <span className="mono text-[8px] uppercase tracking-[0.15em] font-bold text-black/40 flex items-center gap-1.5">
                  <Zap size={7} /> Neural Link
                </span>
              </>
            ) : (
              <>
                <Activity size={7} className="text-[#C5A028] animate-pulse" />
                <span className="mono text-[8px] uppercase tracking-[0.15em] font-bold text-white/40 flex items-center gap-1.5">
                   Edge Mode
                </span>
              </>
            )}
         </div>
      </div>
    </header>
  );
};

export default Header;
