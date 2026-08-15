import React, { useState, useEffect } from 'react';
import { Timer, Zap, Flame, Clock } from 'lucide-react';

export default function CountdownTimer({ targetTimestamp, onCountdownComplete, isLive, stageTitle = 'Public Mint' }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, ms: 0 });
  const [hasFinished, setHasFinished] = useState(false);

  useEffect(() => {
    if (!targetTimestamp) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = targetTimestamp - now;

      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, ms: 0 });
        setHasFinished(true);
        if (onCountdownComplete) onCountdownComplete();
      } else {
        setHasFinished(false);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        const ms = diff % 1000;
        setTimeLeft({ days, hours, minutes, seconds, ms });
      }
    }, 20); // 50fps high precision update loop

    return () => clearInterval(interval);
  }, [targetTimestamp, onCountdownComplete]);

  if (isLive || hasFinished) {
    return (
      <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/60 text-emerald-300 shadow-xl shadow-emerald-950/40 animate-pulse">
        <div className="flex items-center gap-2.5">
          <div className="h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
          <div>
            <h4 className="text-sm font-extrabold uppercase tracking-wide text-emerald-200">
              🔥 {stageTitle} IS LIVE NOW!
            </h4>
            <p className="text-[11px] text-emerald-400 font-mono">1ms Ultra-Fast Multi-Wallet Auto-Mint Ready</p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-900/80 border border-emerald-600 text-white font-bold font-mono">
          STAGE ACTIVE
        </span>
      </div>
    );
  }

  const formatDigit = (num, digits = 2) => String(num).padStart(digits, '0');

  return (
    <div className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-cyan-500/50 shadow-2xl shadow-cyan-950/50">
      
      {/* Title Header */}
      <div className="flex items-center justify-between w-full border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
          <Clock size={15} className="animate-spin text-cyan-400" style={{ animationDuration: '4s' }} />
          <span>{stageTitle} Countdown (1ms Trigger Armed)</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono font-bold">
          LIVE TICKER
        </span>
      </div>

      {/* Digits Grid */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 font-mono text-xl sm:text-3xl font-extrabold text-white">
        
        {/* Days (if > 0) */}
        {timeLeft.days > 0 && (
          <>
            <div className="flex flex-col items-center">
              <span className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-cyan-300 shadow-inner">
                {formatDigit(timeLeft.days)}
              </span>
              <span className="text-[9px] text-slate-400 font-sans font-bold mt-1">DAYS</span>
            </div>
            <span className="text-slate-600 mb-4">:</span>
          </>
        )}

        {/* Hours */}
        <div className="flex flex-col items-center">
          <span className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-cyan-300 shadow-inner">
            {formatDigit(timeLeft.hours)}
          </span>
          <span className="text-[9px] text-slate-400 font-sans font-bold mt-1">HOURS</span>
        </div>
        <span className="text-slate-600 mb-4">:</span>

        {/* Minutes */}
        <div className="flex flex-col items-center">
          <span className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-cyan-300 shadow-inner">
            {formatDigit(timeLeft.minutes)}
          </span>
          <span className="text-[9px] text-slate-400 font-sans font-bold mt-1">MINS</span>
        </div>
        <span className="text-slate-600 mb-4">:</span>

        {/* Seconds */}
        <div className="flex flex-col items-center">
          <span className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-cyan-300 shadow-inner">
            {formatDigit(timeLeft.seconds)}
          </span>
          <span className="text-[9px] text-slate-400 font-sans font-bold mt-1">SECS</span>
        </div>
        <span className="text-slate-600 mb-4">:</span>

        {/* Milliseconds */}
        <div className="flex flex-col items-center">
          <span className="bg-slate-950 px-2.5 py-1.5 rounded-xl border border-indigo-500/50 text-amber-300 min-w-[58px] text-center shadow-inner">
            {formatDigit(timeLeft.ms, 3)}
          </span>
          <span className="text-[9px] text-amber-400 font-sans font-bold mt-1">MS</span>
        </div>
      </div>

    </div>
  );
}
