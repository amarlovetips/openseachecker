import React from 'react';
import { Send, ExternalLink, ShieldCheck } from 'lucide-react';
import { WalletHdService } from '../../services/walletHd';

export default function NftCard({ nft, selectedChain, onOpenTransfer }) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-xl overflow-hidden flex flex-col justify-between group">
      
      {/* Image Header */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-950">
        <img
          src={nft.imageUrl}
          alt={nft.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md text-[10px] font-mono text-cyan-300 border border-slate-800">
          #{nft.tokenId}
        </div>
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md text-[10px] font-mono text-slate-300 border border-slate-800 flex items-center gap-1">
          <span>{nft.chainIcon}</span>
          <span>{nft.symbol}</span>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-white text-sm truncate">{nft.name}</h3>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            Contract: {WalletHdService.truncateAddress(nft.contractAddress, 4)}
          </p>

          {/* Traits */}
          {nft.traits && nft.traits.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {nft.traits.map((t, idx) => (
                <span
                  key={idx}
                  className="text-[9px] px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 font-mono"
                >
                  {t.trait_type}: <strong className="text-cyan-400">{t.value}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Owner & Action */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Owner Wallet:</span>
            <span className="text-cyan-300 font-semibold">{WalletHdService.truncateAddress(nft.ownerAddress, 4)}</span>
          </div>

          <button
            onClick={() => onOpenTransfer(nft)}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-cyan-950/40 transition-all flex items-center justify-center gap-1.5"
          >
            <Send size={14} />
            <span>Transfer NFT</span>
          </button>
        </div>

      </div>

    </div>
  );
}
