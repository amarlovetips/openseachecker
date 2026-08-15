import React from 'react';
import ChainSelector from './ChainSelector';
import { Rocket, Wallet, Image as ImageIcon, Settings, Zap, ShieldCheck } from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  selectedChain,
  onSelectChain,
  walletCount,
  onOpenGasSettings,
}) {
  const tabs = [
    { id: 'automint', label: 'Auto Mint Engine', icon: Rocket },
    { id: 'wallets', label: 'Multi-Wallet Hub', icon: Wallet, badge: walletCount },
    { id: 'nfts', label: 'NFT Portfolio', icon: ImageIcon },
    { id: 'settings', label: 'Settings & Phrase', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand / Logo */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Rocket className="text-cyan-400 animate-pulse" size={20} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  OpenSea <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">Auto-Mint</span>
                </h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                  1ms FAST
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block">Public Stage Multi-Wallet Sniper</p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-900/70 p-1 rounded-xl border border-slate-800/60">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-900/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-cyan-400'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Controls: Chain Selector + Gas Modal Trigger */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenGasSettings}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-all"
              title="Gas Settings & Ultra RPC"
            >
              <Zap size={14} className="text-amber-400" />
              <span className="hidden lg:inline text-[11px] font-mono">30 Gwei</span>
            </button>

            <ChainSelector selectedChain={selectedChain} onSelectChain={onSelectChain} />

            <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1.5 rounded-lg">
              <ShieldCheck size={13} />
              <span>HD Vault Active</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-900">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  isActive ? 'text-cyan-400 font-bold' : 'text-slate-400'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </header>
  );
}
