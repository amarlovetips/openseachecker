import React, { useState } from 'react';
import { X, Zap, ShieldAlert, Cpu } from 'lucide-react';
import { StorageService } from '../../services/storage';

export default function GasSettingsModal({ isOpen, onClose, selectedChain }) {
  const currentConfig = StorageService.getGasConfig();

  const [maxFeeGwei, setMaxFeeGwei] = useState(currentConfig.maxFeeGwei || '30');
  const [maxPriorityFeeGwei, setMaxPriorityFeeGwei] = useState(currentConfig.maxPriorityFeeGwei || '2.5');
  const [gasLimit, setGasLimit] = useState(currentConfig.gasLimit || '200000');
  const [autoSpeed, setAutoSpeed] = useState(currentConfig.autoSpeed || 'ultra');
  const [customRpc, setCustomRpc] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    const config = {
      maxFeeGwei,
      maxPriorityFeeGwei,
      gasLimit,
      autoSpeed,
    };
    StorageService.saveGasConfig(config);

    if (customRpc.trim()) {
      const rpcs = StorageService.getCustomRpcs();
      rpcs[selectedChain.id] = customRpc.trim();
      StorageService.saveCustomRpcs(rpcs);
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Zap className="text-amber-400" size={20} />
            <h3 className="font-bold text-white text-base">Gas & Ultra-RPC Execution Speed</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          
          {/* Preset Speed Mode */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Preset Execution Priority Mode
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'normal', name: 'Normal', maxFee: '20', priority: '1.5' },
                { id: 'high', name: 'Fast (10ms)', maxFee: '35', priority: '3.0' },
                { id: 'ultra', name: 'Ultra-1ms Block', maxFee: '60', priority: '5.0' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setAutoSpeed(mode.id);
                    setMaxFeeGwei(mode.maxFee);
                    setMaxPriorityFeeGwei(mode.priority);
                  }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                    autoSpeed === mode.id
                      ? 'bg-gradient-to-b from-cyan-950/80 to-slate-900 border-cyan-500/80 text-cyan-300 shadow-lg shadow-cyan-950/50'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <span className="text-xs font-bold">{mode.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">+{mode.priority} Gwei Tip</span>
                </button>
              ))}
            </div>
          </div>

          {/* Gwei Custom Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Max Fee (Gwei)</label>
              <input
                type="number"
                step="0.1"
                value={maxFeeGwei}
                onChange={(e) => setMaxFeeGwei(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Priority Tip (Gwei)</label>
              <input
                type="number"
                step="0.1"
                value={maxPriorityFeeGwei}
                onChange={(e) => setMaxPriorityFeeGwei(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Custom Node RPC Override */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Cpu size={14} className="text-cyan-400" />
                Custom Private Node RPC ({selectedChain.shortName})
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Optional Alchemy/Infura</span>
            </div>
            <input
              type="url"
              placeholder={`https://${selectedChain.id}-mainnet.g.alchemy.com/v2/YOUR_API_KEY`}
              value={customRpc}
              onChange={(e) => setCustomRpc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <span>Higher Priority Fee ensures your transactions enter the block first during high-traffic OpenSea drops.</span>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/50 transition-all"
            >
              {savedSuccess ? 'Saved Gas Settings ✓' : 'Save Gas & RPC Config'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
