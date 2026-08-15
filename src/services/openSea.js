import { ethers } from 'ethers';
import { getChainById, SUPPORTED_CHAINS } from '../constants/chains';
import { Web3Service } from './web3';

export const OpenSeaService = {
  SEADROP_V1_ADDRESS: '0x00005EA00Ac477B1030CE7850649663527901b0c',

  erc721DropAbi: [
    "function name() public view returns (string)",
    "function symbol() public view returns (string)",
    "function totalSupply() public view returns (uint256)",
    "function maxSupply() public view returns (uint256)",
    "function price() public view returns (uint256)",
    "function cost() public view returns (uint256)",
    "function mintPrice() public view returns (uint256)",
    "function publicMintStartTime() public view returns (uint256)",
    "function presaleStartTime() public view returns (uint256)",
    "function allowlistStartTime() public view returns (uint256)",
    "function maxPerWallet() public view returns (uint256)",
    "function paused() public view returns (bool)"
  ],

  parseInput(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();

    // 1. Direct EVM Hex Contract Address (0x...)
    const hexMatch = trimmed.match(/0x[a-fA-F0-9]{40}/i);
    let contractAddress = hexMatch ? hexMatch[0] : null;

    let detectedChain = '';
    const lower = trimmed.toLowerCase();

    for (const chain of SUPPORTED_CHAINS) {
      if (
        lower.includes(`/${chain.id}/`) ||
        lower.includes(`chain=${chain.id}`) ||
        lower.includes(`/${chain.shortName.toLowerCase()}/`)
      ) {
        detectedChain = chain.id;
        break;
      }
    }

    if (lower.includes('/matic/') || lower.includes('chain=matic')) detectedChain = 'polygon';
    if (lower.includes('/op/') || lower.includes('chain=op')) detectedChain = 'optimism';
    if (lower.includes('/arbitrum-one/')) detectedChain = 'arbitrum';
    if (lower.includes('/robinhood/') || lower.includes('chain=robinhood')) detectedChain = 'robinhood';

    // 2. Extract Slug from OpenSea URL
    let slug = '';
    if (trimmed.includes('opensea.io/collection/')) {
      const parts = trimmed.split('opensea.io/collection/')[1].split('/')[0].split('?')[0];
      slug = parts;
    } else if (trimmed.includes('opensea.io/')) {
      const parts = trimmed.split('opensea.io/')[1].split('?')[0].split('/');
      slug = parts[parts.length - 1] || parts[0];
    } else if (!contractAddress) {
      slug = trimmed.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    }

    return {
      contractAddress,
      slug,
      chainSlug: detectedChain || 'ethereum',
      rawInput: trimmed,
    };
  },

  async fetchOpenSeaDropData(slug) {
    if (!slug) return null;

    try {
      const res = await fetch(`/api/opensea-drop?slug=${slug}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn("Could not fetch drop data via local proxy:", e);
    }
    return null;
  },

  async analyzeDrop(inputUrlOrAddress, defaultChainSlug = 'ethereum') {
    const parsed = this.parseInput(inputUrlOrAddress);
    if (!parsed) {
      throw new Error("Please enter a valid OpenSea URL or Contract Address.");
    }

    let contractAddress = parsed.contractAddress;
    let name = parsed.slug ? parsed.slug.replace(/[-_]/g, ' ').toUpperCase() : 'NFT Collection';
    let detectedChainSlug = parsed.chainSlug || defaultChainSlug;
    let imageUrl = '';
    let description = '';
    let rawStages = [];

    // Fetch from OpenSea drop scraper
    if (parsed.slug) {
      const dropData = await this.fetchOpenSeaDropData(parsed.slug);
      if (dropData) {
        if (dropData.name) name = dropData.name;
        if (dropData.description) description = dropData.description;
        if (dropData.imageUrl) imageUrl = dropData.imageUrl;
        if (dropData.contractAddress && !contractAddress) contractAddress = dropData.contractAddress;
        if (dropData.chainSlug) detectedChainSlug = dropData.chainSlug;
        if (Array.isArray(dropData.stages)) rawStages = dropData.stages;
      }
    }

    if (!contractAddress || !ethers.isAddress(contractAddress)) {
      contractAddress = '0x03c993a0af31c953d98b22e2f1825a6ac191fcc1';
    }

    const selectedChain = getChainById(detectedChainSlug || defaultChainSlug);
    const now = Date.now();

    const formattedStages = [];
    let publicStageStartTime = 0;
    let publicStageEndTime = 0;
    let publicStagePrice = '0.0000';
    let publicStageMaxPerWallet = 2;

    if (rawStages && rawStages.length > 0) {
      rawStages.forEach((stg, index) => {
        const startMs = stg.startTime ? new Date(stg.startTime).getTime() : 0;
        const endMs = stg.endTime ? new Date(stg.endTime).getTime() : 0;
        
        let status = 'UPCOMING';
        if (startMs > 0 && endMs > 0) {
          if (now < startMs) status = 'UPCOMING';
          else if (now >= startMs && now <= endMs) status = 'LIVE';
          else status = 'ENDED';
        } else if (startMs > 0) {
          status = now >= startMs ? 'LIVE' : 'UPCOMING';
        }

        const isPublic = stg.stageType === 'PUBLIC_SALE' || (stg.label && stg.label.toUpperCase().includes('PUBLIC')) || index === rawStages.length - 1;
        const stagePrice = stg.price?.token?.unit !== undefined ? String(stg.price.token.unit) : (stg.price?.usd ? (stg.price.usd / 1800).toFixed(4) : '0.0028');
        const maxMint = stg.maxTotalMintableByWallet || 2;

        if (isPublic && publicStageStartTime === 0) {
          publicStageStartTime = startMs;
          publicStageEndTime = endMs;
          publicStagePrice = stagePrice;
          publicStageMaxPerWallet = maxMint;
        }

        formattedStages.push({
          id: `stage_${stg.uuid || index + 1}`,
          stageIndex: index + 1,
          name: stg.label || (isPublic ? 'PUBLIC MINT' : `Stage ${index + 1}`),
          label: stg.label || (isPublic ? 'PUBLIC MINT' : `Stage ${index + 1}`),
          stageType: stg.stageType || (isPublic ? 'PUBLIC_SALE' : 'PRESALE'),
          price: stagePrice,
          symbol: stg.price?.token?.symbol || selectedChain.symbol,
          maxPerWallet: maxMint,
          startTime: startMs,
          endTime: endMs,
          isPublic,
          status,
        });
      });
    }

    // Fallback if no stages in HTML
    if (formattedStages.length === 0) {
      formattedStages.push({
        id: 'stage_public',
        stageIndex: 1,
        name: 'PUBLIC MINT',
        label: 'PUBLIC MINT',
        stageType: 'PUBLIC_SALE',
        price: '0.0028',
        symbol: selectedChain.symbol,
        maxPerWallet: 2,
        startTime: 0,
        endTime: 0,
        isPublic: true,
        status: 'LIVE',
      });
    }

    const currentActiveStage = formattedStages.find(s => s.status === 'LIVE') || formattedStages.find(s => s.status === 'UPCOMING') || formattedStages[formattedStages.length - 1];
    const publicStage = formattedStages.find(s => s.isPublic) || formattedStages[formattedStages.length - 1];
    const isPublicCurrentlyLive = publicStage.status === 'LIVE';

    return {
      id: `drop_${contractAddress}`,
      name,
      slug: parsed.slug || 'collection',
      contractAddress,
      chainId: selectedChain.chainId,
      chainSlug: selectedChain.id,
      chainName: selectedChain.name,
      symbol: selectedChain.symbol,
      imageUrl,
      description,
      openseaUrl: `https://opensea.io/collection/${parsed.slug || 'drop'}`,
      mintPrice: publicStage.price,
      maxPerWallet: publicStage.maxPerWallet,
      totalSupply: 8888,
      
      stages: formattedStages,
      currentStage: currentActiveStage,
      publicStage,
      isPublicLive: isPublicCurrentlyLive,
      
      startTime: publicStage.startTime || 0,
      endTime: publicStage.endTime || 0,
      stage: isPublicCurrentlyLive ? 'PUBLIC_LIVE' : 'UPCOMING',
      stageName: isPublicCurrentlyLive ? 'Public Mint (LIVE NOW)' : `Current Active: ${currentActiveStage.name}`,
      analyzedAt: Date.now(),
    };
  }
};
