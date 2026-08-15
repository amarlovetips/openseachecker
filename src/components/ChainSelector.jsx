import React, { useState, useRef, useEffect } from 'react';
import { SUPPORTED_CHAINS } from '../constants/chains';
import { ChevronDown, Check, Globe, Search, Sparkles } from 'lucide-react';

export default function ChainSelector({ selectedChain, onSelectChain }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredChains = SUPPORTED_CHAINS.filter((c) => {
    const q = search.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      c.shortName.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q) ||
      String(c.chainId).includes(q) ||
      (c.category && c.category.toLowerCase().includes(q))
    );
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 transition-all text-sm font-medium text-slate-100 shadow-sm"
      >
        <span className="text-base">{selectedChain.icon}</span>
        <span className="hidden sm:inline font-semibold">{selectedChain.shortName}</span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
          {selectedChain.symbol}
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden py-1 backdrop-blur-xl">
          
          {/* Header & Search */}
          <div className="p-3 border-b border-slate-800 space-y-2 bg-slate-950/60">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1.5 text-white">
                <Globe size={13} className="text-cyan-400" /> OpenSea Supported Networks
              </span>
              <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800/50 font-mono font-bold">
                {SUPPORTED_CHAINS.length} Chains
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                autoFocus
                placeholder="Search Sei, Monad, Soneium, Unichain..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Chains List */}
          <div className="max-h-80 overflow-y-auto py-1 divide-y divide-slate-800/30">
            {filteredChains.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No matching blockchain network found.
              </div>
            ) : (
              filteredChains.map((chain) => {
                const isSelected = chain.id === selectedChain.id;
                return (
                  <button
                    key={chain.id}
                    onClick={() => {
                      onSelectChain(chain);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-left transition-colors ${
                      isSelected ? 'bg-cyan-950/50 text-cyan-300 font-semibold' : 'text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl shrink-0">{chain.icon}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white">{chain.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                          <span>Symbol: <strong className="text-slate-400">{chain.symbol}</strong></span>
                          <span>•</span>
                          <span>ID: {chain.chainId}</span>
                          {chain.category && (
                            <>
                              <span>•</span>
                              <span className="text-cyan-400/80">{chain.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check size={16} className="text-cyan-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

        </div>
      )}
    </div>
  );
}
