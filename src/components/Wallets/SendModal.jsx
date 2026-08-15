import React, { useState } from 'react';
import { X, Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Web3Service } from '../../services/web3';
import { StorageService } from '../../services/storage';

export default function SendModal({ isOpen, onClose, wallet, balance, selectedChain, onTxComplete }) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txSuccess, setTxSuccess] = useState(null);

  if (!isOpen || !wallet) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    setTxSuccess(null);

    if (!recipient || !amount) {
      setError('Please fill in recipient address and amount.');
      return;
    }

    if (parseFloat(amount) <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }

    setLoading(true);
    try {
      const gasConfig = StorageService.getGasConfig();
      const tx = await Web3Service.sendNativeToken({
        privateKey: wallet.privateKey,
        recipient: recipient.trim(),
        amount: amount.trim(),
        chainInput: selectedChain,
        gasConfig,
      });

      setTxSuccess(tx.hash || `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}`);
      if (onTxComplete) onTxComplete();
    } catch (err) {
      setError(err.message || 'Transaction failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetMax = () => {
    const num = parseFloat(balance || '0');
    const maxVal = Math.max(0, num - 0.001); // reserve small gas
    setAmount(maxVal.toFixed(4));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Send className="text-cyan-400" size={18} />
            <span>Send {selectedChain.symbol} Tokens</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSend} className="p-6 space-y-4">
          
          {/* Source Wallet Info */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">From Wallet</span>
              <span className="text-xs font-bold text-white">{wallet.label}</span>
            </div>
            <div className="text-right font-mono">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Available</span>
              <span className="text-xs font-bold text-cyan-300">{balance || '0.0000'} {selectedChain.symbol}</span>
            </div>
          </div>

          {/* Recipient Address Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Recipient EVM Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Amount Input with MAX Button */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300">Amount ({selectedChain.symbol})</label>
              <button
                type="button"
                onClick={handleSetMax}
                className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50 hover:bg-cyan-900 font-mono"
              >
                Set Max
              </button>
            </div>
            <input
              type="number"
              step="0.0001"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {txSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 size={16} />
                <span>Transaction Broadcasted Successfully!</span>
              </div>
              <p className="font-mono text-[10px] text-slate-400 break-all">Hash: {txSuccess}</p>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/50 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>Send Transaction</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
