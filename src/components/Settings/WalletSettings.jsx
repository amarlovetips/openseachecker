import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storage';
import { WalletHdService } from '../../services/walletHd';
import { Key, Eye, EyeOff, ShieldCheck, Plus, Trash2, CheckCircle2, AlertCircle, Sparkles, Sliders, Layers, FileText } from 'lucide-react';

export default function WalletSettings({ onWalletsUpdated }) {
  const [mnemonic, setMnemonic] = useState('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [derivedCount, setDerivedCount] = useState(5);
  
  // Custom single key / batch keys import
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [batchKeysInput, setBatchKeysInput] = useState('');
  const [customKeys, setCustomKeys] = useState([]);
  
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    setMnemonic(StorageService.getMnemonic());
    setDerivedCount(StorageService.getDerivedCount());
    setCustomKeys(StorageService.getCustomPrivateKeys());
  };

  const handleSaveMnemonic = (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (mnemonic.trim() && !WalletHdService.isValidMnemonic(mnemonic)) {
      setErrorMsg('Invalid 12 or 24 word Secret Recovery Phrase (Mnemonic).');
      return;
    }

    StorageService.saveMnemonic(mnemonic.trim());
    StorageService.saveDerivedCount(derivedCount);

    setSuccessMsg(`✅ Saved! ${mnemonic.trim() ? `${derivedCount} HD Wallets derived` : 'Wallet configuration updated'}.`);
    if (onWalletsUpdated) onWalletsUpdated();

    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAddCustomKey = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!WalletHdService.isValidPrivateKey(customKeyInput)) {
      setErrorMsg('Invalid 64-character EVM Private Key (must be valid 0x hex).');
      return;
    }

    const cleanKey = customKeyInput.trim().startsWith('0x') ? customKeyInput.trim() : `0x${customKeyInput.trim()}`;
    const newEntry = {
      key: cleanKey,
      label: customLabelInput.trim() || `Imported Wallet #${customKeys.length + 1}`,
    };

    const updated = [...customKeys, newEntry];
    setCustomKeys(updated);
    StorageService.saveCustomPrivateKeys(updated);
    setCustomKeyInput('');
    setCustomLabelInput('');
    setSuccessMsg('✅ Custom Private Key imported successfully!');
    if (onWalletsUpdated) onWalletsUpdated();

    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleBatchImport = (e) => {
    e.preventDefault();
    if (!batchKeysInput.trim()) return;

    setErrorMsg('');
    const lines = batchKeysInput.split(/[\n,;]+/);
    const validNewKeys = [];

    lines.forEach((line) => {
      const clean = line.trim();
      if (clean) {
        const pk = clean.startsWith('0x') ? clean : `0x${clean}`;
        if (WalletHdService.isValidPrivateKey(pk)) {
          validNewKeys.push({
            key: pk,
            label: `Imported Wallet #${customKeys.length + validNewKeys.length + 1}`,
          });
        }
      }
    });

    if (validNewKeys.length === 0) {
      setErrorMsg('No valid EVM private keys found in batch input.');
      return;
    }

    const updated = [...customKeys, ...validNewKeys];
    setCustomKeys(updated);
    StorageService.saveCustomPrivateKeys(updated);
    setBatchKeysInput('');
    setSuccessMsg(`✅ Batch imported ${validNewKeys.length} private keys!`);
    if (onWalletsUpdated) onWalletsUpdated();

    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleRemoveCustomKey = (index) => {
    const updated = customKeys.filter((_, i) => i !== index);
    setCustomKeys(updated);
    StorageService.saveCustomPrivateKeys(updated);
    if (onWalletsUpdated) onWalletsUpdated();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Settings Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Key size={20} className="text-cyan-400" />
            Wallet Settings & Key Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Enter Secret Recovery Phrase (Mnemonic) to generate HD multi-wallets or import private keys manually.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          <ShieldCheck size={16} />
          <span>Local Client Encrypted</span>
        </div>
      </div>

      {/* Secret Recovery Phrase Box */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        
        <form onSubmit={handleSaveMnemonic} className="space-y-5">
          
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-cyan-400" />
                Secret Recovery Phrase (12 / 24 Word Mnemonic)
              </label>

              <button
                type="button"
                onClick={() => setShowMnemonic(!showMnemonic)}
                className="text-[11px] text-cyan-400 hover:underline font-mono flex items-center gap-1"
              >
                {showMnemonic ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showMnemonic ? 'Hide Seed Phrase' : 'Reveal Seed Phrase'}</span>
              </button>
            </div>

            <textarea
              rows={3}
              placeholder="Paste your 12 or 24 word mnemonic phrase here (e.g. apple banana orange...)"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              className={`w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 transition-colors shadow-inner`}
              style={{ WebkitTextSecurity: showMnemonic ? 'none' : 'disc' }}
            />
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Generates HD multi-wallets at derivation path: <code className="text-slate-400">m/44'/60'/0'/0/i</code>
            </p>
          </div>

          {/* Derivation Count */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sliders size={14} className="text-cyan-400" />
                  How Many HD Wallets to Auto-Generate?
                </h4>
                <p className="text-[11px] text-slate-400">Enter custom count or select preset</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={derivedCount}
                  onChange={(e) => setDerivedCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-20 px-2.5 py-1 rounded-lg bg-slate-900 border border-cyan-800 font-mono text-cyan-300 text-sm font-bold text-center focus:outline-none"
                />
                <span className="text-xs text-slate-400 font-semibold">Wallets</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">Quick Count:</span>
              {[1, 5, 10, 20, 50, 100].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setDerivedCount(num)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                    derivedCount === num ? 'bg-cyan-600 text-white font-bold' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs font-mono">
              {successMsg && <span className="text-emerald-400 font-semibold">{successMsg}</span>}
              {errorMsg && <span className="text-rose-400 font-semibold">{errorMsg}</span>}
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/50 transition-all"
            >
              Save Phrase & Generate Wallets
            </button>
          </div>

        </form>

      </div>

      {/* Manual Private Key Import (Single Key + Batch Import) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Single Key Import */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Key size={16} className="text-indigo-400" />
            Import Single Private Key
          </h3>

          <form onSubmit={handleAddCustomKey} className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Custom Label (Optional)</label>
              <input
                type="text"
                placeholder="e.g. My Ledger / Fat Wallet"
                value={customLabelInput}
                onChange={(e) => setCustomLabelInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">0x... Private Key</label>
              <input
                type="password"
                placeholder="Enter 0x Private Key"
                value={customKeyInput}
                onChange={(e) => setCustomKeyInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-950 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus size={16} />
              <span>Import Single Key</span>
            </button>
          </form>
        </div>

        {/* Batch Private Keys Import */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <FileText size={16} className="text-fuchsia-400" />
            Batch Import Multiple Keys
          </h3>

          <form onSubmit={handleBatchImport} className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Paste Multiple Private Keys (1 per line)</label>
              <textarea
                rows={3}
                placeholder="0x1111...&#10;0x2222...&#10;0x3333..."
                value={batchKeysInput}
                onChange={(e) => setBatchKeysInput(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-fuchsia-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs shadow-md shadow-fuchsia-950 transition-all flex items-center justify-center gap-1.5"
            >
              <Layers size={16} />
              <span>Batch Import All Keys</span>
            </button>
          </form>
        </div>

      </div>

      {/* List of Custom Imported Keys */}
      {customKeys.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
            Manually Imported Wallets ({customKeys.length}):
          </span>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {customKeys.map((item, idx) => {
              const pk = typeof item === 'string' ? item : item.key;
              const label = typeof item === 'object' && item.label ? item.label : `Imported Wallet #${idx + 1}`;
              return (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
                  <div>
                    <span className="font-bold text-white font-sans">{label}</span>
                    <span className="text-slate-500 text-[11px] block">{pk.slice(0, 10)}...{pk.slice(-8)}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveCustomKey(idx)}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950 transition-colors"
                    title="Remove Wallet"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
