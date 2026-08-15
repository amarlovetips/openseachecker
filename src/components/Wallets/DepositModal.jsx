import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, QrCode, ArrowDownRight, ShieldCheck } from 'lucide-react';

export default function DepositModal({ isOpen, onClose, wallet, selectedChain }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !wallet) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <ArrowDownRight className="text-emerald-400" size={20} />
            <span>Deposit / Receive Funds</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center space-y-5">
          
          {/* Wallet Label & Network Pill */}
          <div className="text-center space-y-1">
            <h4 className="font-bold text-white text-sm">{wallet.label}</h4>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-400">
              <span>{selectedChain.icon}</span>
              <span>{selectedChain.name}</span>
              <span className="text-slate-500">({selectedChain.symbol})</span>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="p-4 bg-white rounded-2xl shadow-xl border border-slate-200">
            <QRCodeSVG
              value={wallet.address}
              size={180}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Address Display Box */}
          <div className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Wallet Public EVM Address</span>
            <div className="flex items-center justify-between gap-2 font-mono text-xs text-slate-200 break-all">
              <span>{wallet.address}</span>
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 shrink-0 transition-colors"
                title="Copy Address"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Info Note */}
          <div className="flex items-start gap-2 text-xs text-slate-400 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <span>Send only {selectedChain.symbol} or EVM tokens on {selectedChain.name} to this address. Funds will reflect automatically.</span>
          </div>

        </div>

      </div>
    </div>
  );
}
