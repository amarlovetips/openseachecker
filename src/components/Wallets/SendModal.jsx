import React, { useState } from 'react';
import { X, Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { ethers } from 'ethers';
import { Web3Service } from '../../services/web3';
import { StorageService } from '../../services/storage';
import { priceService } from '../../services/price';

export default function SendModal({ isOpen, onClose, wallet, balance, selectedChain, onTxComplete }) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txSuccess, setTxSuccess] = useState(null);

  if (!isOpen || !wallet) return null;

  const currentBalStr = String(balance || '0').trim();
  const currentBalNum = parseFloat(currentBalStr);

  const handleAmountChange = (e) => {
    let val = e.target.value.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
    setAmount(val);
    setError('');
  };

  const handleSetPresetPercentage = (percent) => {
    if (isNaN(currentBalNum) || currentBalNum <= 0) {
      setAmount('0');
      return;
    }

    if (percent === 100) {
      // 100% exact full 18-decimal balance without any truncation!
      setAmount(currentBalStr);
      setError('');
      return;
    }

    const calculated = (currentBalNum * (percent / 100));
    setAmount(parseFloat(calculated.toFixed(8)).toString());
    setError('');
  };

  const handleSetMaxGasSafe = () => {
    if (isNaN(currentBalNum) || currentBalNum <= 0) {
      setAmount('0');
      return;
    }
    try {
      const balanceWei = ethers.parseEther(currentBalStr);
      // Small gas reserve for native transfer (21,000 gas * gas price on L2)
      const reserveWei = ethers.parseUnits('0.000021', 'ether');
      if (balanceWei > reserveWei) {
        const sendableWei = balanceWei - reserveWei;
        setAmount(ethers.formatEther(sendableWei));
      } else {
        setAmount(currentBalStr);
      }
    } catch (e) {
      setAmount(currentBalStr);
    }
    setError('');
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    setTxSuccess(null);

    if (!recipient || !recipient.trim()) {
      setError('Please enter a valid recipient EVM address.');
      return;
    }

    if (!amount || !amount.trim() || parseFloat(amount) <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }

    try {
      const sendWei = ethers.parseEther(amount.trim());
      const balWei = ethers.parseEther(currentBalStr);
      if (sendWei > balWei) {
        setError(`Insufficient balance. You have ${currentBalStr} ${selectedChain.symbol}.`);
        return;
      }
    } catch (e) {
      setError('Invalid amount format or decimal precision.');
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

      setTxSuccess(tx.hash);
      if (onTxComplete) onTxComplete();
    } catch (err) {
      setError(err?.reason || err?.message || 'Transaction broadcast failed.');
    } finally {
      setLoading(false);
    }
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
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">From Wallet</span>
              <span className="text-xs font-bold text-white block truncate">{wallet.label}</span>
              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
              </span>
            </div>
            <div className="text-right font-mono shrink-0">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Available</span>
              <span className="text-xs font-bold text-cyan-300 block break-all" title={currentBalStr}>
                {currentBalStr} {selectedChain.symbol}
              </span>
              <span className="text-[10px] text-emerald-400 block mt-0.5">
                ≈ {priceService.formatUsd(currentBalStr, selectedChain.symbol)}
              </span>
            </div>
          </div>

          {/* Recipient Address Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Recipient EVM Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => { setRecipient(e.target.value); setError(''); }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Amount Input with Quick Presets */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-300">
                Amount ({selectedChain.symbol})
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSetPresetPercentage(25)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
                >
                  25%
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPresetPercentage(50)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPresetPercentage(75)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
                >
                  75%
                </button>
                <button
                  type="button"
                  onClick={handleSetMaxGasSafe}
                  className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 hover:bg-cyan-900 font-mono font-bold"
                  title="Max amount reserving tiny gas"
                >
                  Max (Safe)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPresetPercentage(100)}
                  className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900 font-mono font-bold"
                  title="100% Full 18-decimal Balance"
                >
                  100%
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.000000000000000000"
                value={amount}
                onChange={handleAmountChange}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs font-bold focus:outline-none focus:border-cyan-500 shadow-inner"
              />
              <div className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono font-semibold">
                {selectedChain.symbol}
              </div>
            </div>

            {/* Real-time USD Estimate */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
              <span>Estimated Value:</span>
              <span className="text-emerald-400 font-bold">
                ≈ {priceService.formatUsd(amount, selectedChain.symbol)}
              </span>
            </div>
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
