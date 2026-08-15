import React, { useState, useEffect } from 'react';
import NftCard from './NftCard';
import NftTransferModal from './NftTransferModal';
import { Web3Service } from '../../services/web3';
import { Image as ImageIcon, Search, RefreshCw, Layers } from 'lucide-react';

export default function NftPortfolio({ wallets = [], selectedChain }) {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNftForTransfer, setSelectedNftForTransfer] = useState(null);

  useEffect(() => {
    fetchPortfolio();
  }, [wallets, selectedChain]);

  const fetchPortfolio = async () => {
    if (!wallets || wallets.length === 0) return;
    setLoading(true);

    try {
      const allNfts = [];
      for (const w of wallets) {
        const items = await Web3Service.getWalletNfts(w.address, selectedChain);
        allNfts.push(...items);
      }
      setNfts(allNfts);
    } catch (err) {
      console.error("Failed to load NFT portfolio:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTransferredNft = (nftId) => {
    setNfts((prev) => prev.filter((item) => item.id !== nftId));
    setSelectedNftForTransfer(null);
  };

  const filteredNfts = nfts.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tokenId.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      
      {/* Top Banner Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-500 p-0.5 shadow-lg">
            <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <ImageIcon className="text-fuchsia-400" size={22} />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">NFT Portfolio & Transfer Manager</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-800/60 font-mono">
                {selectedChain.shortName}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              View and transfer minted NFTs across all active multi-wallets.
            </p>
          </div>
        </div>

        {/* Count & Refresh */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-right">
            <span className="text-[10px] text-slate-500 uppercase block font-sans font-semibold">Held NFTs</span>
            <span className="text-base font-bold text-fuchsia-300">{nfts.length} Items</span>
          </div>

          <button
            onClick={fetchPortfolio}
            disabled={loading}
            className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            title="Refresh Portfolio"
          >
            <RefreshCw size={16} className={`text-fuchsia-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
        <input
          type="text"
          placeholder="Search NFT name or token ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-fuchsia-500"
        />
      </div>

      {/* NFT Grid */}
      {filteredNfts.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <Layers size={40} className="mx-auto text-slate-600" />
          <h3 className="font-bold text-white text-base">No NFTs Found in Portfolio</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Mint NFTs using the Auto-Mint Engine to see them appear here in real-time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredNfts.map((nft) => (
            <NftCard
              key={nft.id}
              nft={nft}
              selectedChain={selectedChain}
              onOpenTransfer={(item) => setSelectedNftForTransfer(item)}
            />
          ))}
        </div>
      )}

      {/* Transfer NFT Modal */}
      <NftTransferModal
        isOpen={!!selectedNftForTransfer}
        onClose={() => setSelectedNftForTransfer(null)}
        nft={selectedNftForTransfer}
        wallets={wallets}
        selectedChain={selectedChain}
        onTransferSuccess={handleRemoveTransferredNft}
      />

    </div>
  );
}
