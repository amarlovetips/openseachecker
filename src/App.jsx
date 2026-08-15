import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MintAnalyzer from './components/AutoMint/MintAnalyzer';
import GasSettingsModal from './components/AutoMint/GasSettingsModal';
import WalletHub from './components/Wallets/WalletHub';
import NftPortfolio from './components/NFTs/NftPortfolio';
import WalletSettings from './components/Settings/WalletSettings';
import { SUPPORTED_CHAINS, DEFAULT_CHAIN, getChainById } from './constants/chains';
import { WalletHdService } from './services/walletHd';
import { StorageService } from './services/storage';
import { ShieldCheck, Cpu, Globe, ExternalLink } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('automint');
  const [selectedChain, setSelectedChain] = useState(() => {
    const savedChainSlug = StorageService.getSelectedChain();
    return getChainById(savedChainSlug) || DEFAULT_CHAIN;
  });
  const [wallets, setWallets] = useState([]);
  const [isGasModalOpen, setIsGasModalOpen] = useState(false);

  useEffect(() => {
    refreshWallets();
  }, []);

  const refreshWallets = () => {
    try {
      const loaded = WalletHdService.getAllWallets();
      setWallets(loaded);
    } catch (err) {
      console.error("Failed to load wallets:", err);
      setWallets([]);
    }
  };

  const handleSelectChain = (chain) => {
    setSelectedChain(chain);
    StorageService.saveSelectedChain(chain.id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#06070a] text-slate-100 selection:bg-cyan-500 selection:text-black">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedChain={selectedChain}
        onSelectChain={handleSelectChain}
        walletCount={wallets.length}
        onOpenGasSettings={() => setIsGasModalOpen(true)}
      />

      {/* Main Container Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Tab 1: Auto Mint Engine */}
        {activeTab === 'automint' && (
          <MintAnalyzer
            selectedChain={selectedChain}
            onSelectChain={handleSelectChain}
            wallets={wallets}
            onOpenSettings={() => setActiveTab('settings')}
          />
        )}

        {/* Tab 2: Multi-Wallet Hub */}
        {activeTab === 'wallets' && (
          <WalletHub
            wallets={wallets}
            onRefreshWallets={refreshWallets}
            selectedChain={selectedChain}
            onOpenSettings={() => setActiveTab('settings')}
          />
        )}

        {/* Tab 3: NFT Portfolio */}
        {activeTab === 'nfts' && (
          <NftPortfolio
            wallets={wallets}
            selectedChain={selectedChain}
          />
        )}

        {/* Tab 4: Wallet Settings */}
        {activeTab === 'settings' && (
          <WalletSettings
            onWalletsUpdated={() => refreshWallets()}
          />
        )}

      </main>

      {/* Gas & RPC Config Modal */}
      <GasSettingsModal
        isOpen={isGasModalOpen}
        onClose={() => setIsGasModalOpen(false)}
        selectedChain={selectedChain}
      />

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-slate-900 bg-slate-950/80 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-cyan-400" />
            <span>OpenSea 1ms Auto-Mint Engine - Client-side Encrypted Key Vault</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>Auto-Selected Network: <strong className="text-cyan-300">{selectedChain.name}</strong></span>
            <span>Trigger Latency: <strong className="text-emerald-400">0ms Standby Ready</strong></span>
          </div>

        </div>
      </footer>

    </div>
  );
}
