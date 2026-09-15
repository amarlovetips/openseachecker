import React, { useState } from 'react';
import { Copy, Check, ArrowDownRight, Send, ShieldCheck, Key, RefreshCw } from 'lucide-react';
import { WalletHdService } from '../../services/walletHd';
import { priceService } from '../../services/price';

export default function WalletCard({
  wallet,
  balance,
  selectedChain,
  onOpenDeposit,
  onOpenSend,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLowGas = parseFloat(balance || '0') < 0.001;

  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-md flex flex-col justify-between gap-3">
      
      {/* Wallet Top Info */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">{wallet.label}</span>
            {wallet.type === 'hd' ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 font-mono">
                HD #{wallet.index + 1}
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-800/50 font-mono flex items-center gap-1">
                <Key size={10} /> Imported
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-1 font-mono text-xs text-slate-400">
            <span>{WalletHdService.truncateAddress(wallet.address, 6)}</span>
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Copy Address"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        {/* Gas Balance Pill with USD Value */}
        <div className="text-right font-mono">
          <span className="text-[10px] text-slate-500 uppercase block font-sans font-semibold">Balance</span>
          <span className={`text-sm font-bold block ${isLowGas ? 'text-amber-400' : 'text-cyan-300'}`}>
            {balance || '0.0000'} {selectedChain.symbol}
          </span>
          <span className="text-[11px] text-slate-400 block">
            {priceService.formatUsd(balance, selectedChain.symbol)}
          </span>
        </div>
      </div>

      {/* Path / Status */}
      <div className="flex items-center justify-between text-[11px] font-mono border-t border-slate-800/80 pt-2 text-slate-500">
        <span>{wallet.path}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          isLowGas ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
        }`}>
          {isLowGas ? '⚠️ Low Gas' : '🟢 Ready'}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={() => onOpenDeposit(wallet)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all"
        >
          <ArrowDownRight size={14} className="text-emerald-400" />
          <span>Deposit</span>
        </button>

        <button
          onClick={() => onOpenSend(wallet)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/60 text-xs font-semibold transition-all"
        >
          <Send size={14} className="text-cyan-400" />
          <span>Send</span>
        </button>
      </div>

    </div>
  );
}
