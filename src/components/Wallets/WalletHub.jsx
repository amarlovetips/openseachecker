import React, { useState, useEffect } from 'react';
import WalletCard from './WalletCard';
import DepositModal from './DepositModal';
import SendModal from './SendModal';
import { Web3Service } from '../../services/web3';
import { StorageService } from '../../services/storage';
import { WalletHdService } from '../../services/walletHd';
import { Wallet, Plus, RefreshCw, Search, ShieldCheck, Download, ArrowUpRight } from 'lucide-react';

export default function WalletHub({ wallets = [], onRefreshWallets, selectedChain, onOpenSettings }) {
  const [balances, setBalances] = useState({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [selectedWalletForDeposit, setSelectedWalletForDeposit] = useState(null);
  const [selectedWalletForSend, setSelectedWalletForSend] = useState(null);

  useEffect(() => {
    fetchBalances();
  }, [wallets, selectedChain]);

  const fetchBalances = async () => {
    if (!wallets || wallets.length === 0) return;
    setLoadingBalances(true);
    try {
      const addresses = wallets.map((w) => w.address);
      const res = await Web3Service.getBatchBalances(addresses, selectedChain);
      setBalances(res);
    } catch (err) {
      console.error("Failed to fetch wallet balances:", err);
    } finally {
      setLoadingBalances(false);
    }
  };

  const handleAddMoreWallets = (increment = 5) => {
    const currentCount = StorageService.getDerivedCount();
    const newCount = currentCount + increment;
    StorageService.saveDerivedCount(newCount);
    if (onRefreshWallets) onRefreshWallets();
  };

  const filteredWallets = wallets.filter(
    (w) =>
      w.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalBalanceSum = Object.values(balances).reduce(
    (acc, curr) => acc + parseFloat(curr || 0),
    0
  );

  return (
    <div className="space-y-6">
      
      {/* Top Banner Stats */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 p-0.5 shadow-lg">
            <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Wallet className="text-cyan-400" size={22} />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Multi-Chain Wallet Hub</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono">
                {selectedChain.shortName} ({selectedChain.symbol})
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Total {wallets.length} smart HD derived wallets & imported keys active.
            </p>
          </div>
        </div>

        {/* Aggregated Total Balance */}
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 font-mono text-right">
            <span className="text-[10px] text-slate-500 uppercase block font-sans font-semibold">
              Total Combined Portfolio Balance
            </span>
            <span className="text-base font-extrabold text-cyan-300">
              {totalBalanceSum.toFixed(4)} {selectedChain.symbol}
            </span>
          </div>

          <button
            onClick={fetchBalances}
            disabled={loadingBalances}
            className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            title="Refresh All Balances"
          >
            <RefreshCw size={16} className={`text-cyan-400 ${loadingBalances ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Controls Bar: Search + Add Wallets Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search wallet label or 0x..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => handleAddMoreWallets(5)}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/40 transition-all flex items-center justify-center gap-1.5"
          >
            <Plus size={16} />
            <span>+ Add 5 HD Wallets</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition-all"
          >
            Import Custom Key
          </button>
        </div>
      </div>

      {/* Wallets Grid */}
      {filteredWallets.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <Wallet size={40} className="mx-auto text-slate-600" />
          <h3 className="font-bold text-white text-base">No Wallets Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Please configure your Seed Phrase in Settings or click "+ Add 5 HD Wallets" above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWallets.map((wallet) => (
            <WalletCard
              key={wallet.id}
              wallet={wallet}
              balance={balances[wallet.address]}
              selectedChain={selectedChain}
              onOpenDeposit={(w) => setSelectedWalletForDeposit(w)}
              onOpenSend={(w) => setSelectedWalletForSend(w)}
            />
          ))}
        </div>
      )}

      {/* Deposit & Send Modals */}
      <DepositModal
        isOpen={!!selectedWalletForDeposit}
        onClose={() => setSelectedWalletForDeposit(null)}
        wallet={selectedWalletForDeposit}
        selectedChain={selectedChain}
      />

      <SendModal
        isOpen={!!selectedWalletForSend}
        onClose={() => setSelectedWalletForSend(null)}
        wallet={selectedWalletForSend}
        balance={selectedWalletForSend ? balances[selectedWalletForSend.address] : '0.0000'}
        selectedChain={selectedChain}
        onTxComplete={() => fetchBalances()}
      />

    </div>
  );
}
