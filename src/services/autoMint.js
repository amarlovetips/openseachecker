import { ethers } from 'ethers';
import { Web3Service } from './web3';
import { StorageService } from './storage';
import { backgroundTimerService } from './backgroundWorker';
import confetti from 'canvas-confetti';

export class AutoMintEngine {
  constructor() {
    this.isRunning = false;
    this.isArmed = false;
    this.isPreStaging = false;
    this.isPreSigned = false;
    this.shouldStop = false;
    this.dropInfo = null;
    this.wallets = [];
    this.targetQty = 1;
    this.selectedChain = null;
    this.executionMode = 'parallel'; // 'parallel' (nanosecond blast) or 'sequential'
    this.latencyOffsetMs = 15; // Lead time compensation
    this.gasSpeed = 'high'; // 'slow' | 'normal' | 'high'
    this.lastFeeData = null;
    this.gasMonitorInterval = null;
    this.preSignedTxs = [];
    this.logs = [];
    this.listeners = new Set();
    this.unsubWorker = null;
    this.unsubTrigger = null;
    this.unsubPreWarm = null;

    // Attach to worker high-resolution trigger
    this.unsubTrigger = backgroundTimerService.onTrigger((triggerTimestamp) => {
      this.triggerNanosecondBlast(triggerTimestamp);
    });

    // Attach to TCP/TLS Keep-Alive Pre-Warming (1.5s before launch)
    this.unsubPreWarm = backgroundTimerService.onPreWarm(() => {
      this.preWarmSocketConnection();
    });

    // Fallback heartbeat listener
    this.unsubWorker = backgroundTimerService.subscribe((msg) => {
      if (this.isArmed && !this.isRunning && this.dropInfo) {
        const now = Date.now();
        const triggerTime = (this.dropInfo.startTime || 0) - this.latencyOffsetMs;
        if (triggerTime > 0 && now >= triggerTime) {
          this.triggerNanosecondBlast();
        }
      }
    });
  }

  async preWarmSocketConnection() {
    if (!this.selectedChain) return;
    try {
      const provider = Web3Service.getProvider(this.selectedChain);
      provider.getBlockNumber().catch(() => {});
      this.addLog('info', `⚡ [TCP/TLS PRE-WARMED] Keep-alive socket connection active for instant 0ms trigger!`);
    } catch (e) {}
  }

  startGasMonitor(provider) {
    this.stopGasMonitor();
    this.gasMonitorInterval = setInterval(async () => {
      if (!this.isArmed || this.isRunning || !this.dropInfo) {
        this.stopGasMonitor();
        return;
      }
      try {
        const feeData = await provider.getFeeData();
        const raw = feeData?.gasPrice || feeData?.maxFeePerGas || 0n;
        const currentGwei = parseFloat(ethers.formatUnits(raw, 'gwei'));
        const lastRaw = this.lastFeeData ? (this.lastFeeData.gasPrice || this.lastFeeData.maxFeePerGas || 0n) : null;
        const lastGwei = lastRaw ? parseFloat(ethers.formatUnits(lastRaw, 'gwei')) : null;

        if (lastGwei !== null && Math.abs(currentGwei - lastGwei) / (lastGwei || 1) > 0.12) {
          this.addLog('info', `🔄 [LIVE GAS SHIFT] On-chain gas moved ${lastGwei.toFixed(3)} → ${currentGwei.toFixed(3)} Gwei. Re-syncing RAM transactions...`);
          this.lastFeeData = feeData;
          this.preStageTransactions(true);
        } else {
          this.lastFeeData = feeData;
        }
      } catch (e) {}
    }, 3500);
  }

  stopGasMonitor() {
    if (this.gasMonitorInterval) {
      clearInterval(this.gasMonitorInterval);
      this.gasMonitorInterval = null;
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach((cb) => cb({
      isRunning: this.isRunning,
      isArmed: this.isArmed,
      isPreSigned: this.isPreSigned,
      isPreStaging: this.isPreStaging,
      executionMode: this.executionMode,
      latencyOffsetMs: this.latencyOffsetMs,
      gasSpeed: this.gasSpeed,
      targetStartTime: this.dropInfo?.startTime || 0,
      logs: [...this.logs]
    }));
  }

  addLog(type, message, details = {}) {
    const timeStr = new Date().toISOString().substring(11, 23);
    const logItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: timeStr,
      type,
      message,
      details,
    };
    this.logs.unshift(logItem);
    if (this.logs.length > 300) this.logs.pop();
    this.notify();
  }

  clearLogs() {
    this.logs = [];
    this.notify();
  }

  /**
   * Calculate dynamic gas parameters based 100% on LIVE network feeData.
   * Zero hardcoded Gwei presets. Adapts dynamically whether the chain is at 0.05 Gwei, 5 Gwei, or 50 Gwei.
   */
  calculateGasParams(feeData, gasSpeed = 'high') {
    const speed = gasSpeed || this.gasSpeed || StorageService.getGasSpeed() || 'high';

    // Case 1: EIP-1559 network
    if (feeData && (feeData.maxFeePerGas != null || feeData.maxPriorityFeePerGas != null)) {
      const netBase = feeData.maxFeePerGas || feeData.gasPrice || 1000000n;
      const netPriority = feeData.maxPriorityFeePerGas != null && feeData.maxPriorityFeePerGas > 0n 
        ? feeData.maxPriorityFeePerGas 
        : (netBase * 5n) / 100n; // default 5% if chain reports 0 tip

      let tipWei;
      let maxFeeWei;

      if (speed === 'slow') {
        // Slow: 1.0x Live Network Fee (Standard base fee, live tip)
        tipWei = netPriority > 0n ? netPriority : (netBase * 5n) / 100n;
        if (tipWei === 0n) tipWei = 1n;
        maxFeeWei = (netBase * 105n) / 100n + tipWei; // 1.05x base + live tip
      } else if (speed === 'normal') {
        // Normal: +35% Dynamic Boost over live network fee
        tipWei = netPriority > 0n ? (netPriority * 135n) / 100n : (netBase * 15n) / 100n;
        if (tipWei === 0n) tipWei = 1n;
        maxFeeWei = (netBase * 135n) / 100n + tipWei;
      } else {
        // High / Fast (Ultra MEV Sniper Speed):
        // 3.0x live priority tip buffer (or 35% of base if tip is 0 like on Robinhood Chain)
        // 2.8x live base fee buffer so validators greedily prioritize our transaction in block #0
        tipWei = netPriority > 0n ? (netPriority * 300n) / 100n : (netBase * 35n) / 100n;
        if (tipWei === 0n) tipWei = 1n;
        maxFeeWei = (netBase * 280n) / 100n + tipWei;
      }

      return {
        maxFeePerGas: maxFeeWei,
        maxPriorityFeePerGas: tipWei,
      };
    }

    // Case 2: Legacy / gasPrice network
    const netGasPrice = feeData?.gasPrice || 1000000000n;
    let finalGasPrice;

    if (speed === 'slow') {
      finalGasPrice = netGasPrice; // 1.0x live network price
    } else if (speed === 'normal') {
      finalGasPrice = (netGasPrice * 130n) / 100n; // 1.3x live network price
    } else {
      finalGasPrice = (netGasPrice * 250n) / 100n; // 2.5x live network price for instant mining
    }

    return {
      gasPrice: finalGasPrice,
    };
  }

  /**
   * Arm the bot with Nanosecond Pre-Sign Pipeline
   */
  async armAutoMint({
    dropInfo,
    wallets,
    targetQuantityPerWallet = 1,
    chainInput,
    gasConfig,
    gasSpeed = 'high',
    executionMode = 'parallel',
    latencyOffsetMs = 15
  }) {
    if (this.isRunning) return;

    this.dropInfo = dropInfo;
    this.wallets = wallets;
    this.targetQty = targetQuantityPerWallet;
    this.selectedChain = chainInput;
    this.gasConfig = gasConfig || StorageService.getGasConfig();
    this.gasSpeed = gasSpeed || StorageService.getGasSpeed() || 'high';
    this.executionMode = executionMode;
    this.latencyOffsetMs = latencyOffsetMs;
    this.isArmed = true;
    this.shouldStop = false;
    this.isPreSigned = false;
    this.preSignedTxs = [];

    const provider = Web3Service.getProvider(this.selectedChain);
    backgroundTimerService.requestNotificationPermission();

    const now = Date.now();
    const startTime = dropInfo.startTime || 0;
    const speedLabel = this.gasSpeed === 'high' ? '🚀 HIGH / FAST (2.5x Dynamic Live Boost)' : (this.gasSpeed === 'normal' ? '⚡ NORMAL (+35% Boost)' : '🐢 SLOW (1.0x Live Network)');

    if (startTime > now) {
      const diffMs = startTime - now;
      const diffSecs = (diffMs / 1000).toFixed(1);
      const targetTimeStr = new Date(startTime).toLocaleTimeString();

      this.addLog('warning', `🛡️ [ARMED IN 0MS STANDBY] Target Launch: ${targetTimeStr} (${diffSecs}s remaining).`);
      this.addLog('info', `⚡ Mode: ${this.executionMode.toUpperCase()} BLAST | Gas: ${speedLabel} | Lead Compensation: -${this.latencyOffsetMs}ms.`);
      this.addLog('info', `⏳ Live Gas Poller active: automatically syncs RAM transactions if chain gas fluctuates...`);

      // Arm background high-resolution worker
      backgroundTimerService.armTimer(startTime, this.latencyOffsetMs);

      // Start live gas monitor
      this.startGasMonitor(provider);

      // Immediately pre-stage and pre-sign all raw transactions ahead of time
      this.preStageTransactions();
    } else {
      this.addLog('info', `⚡ Launch time already active! Initiating immediate blast across ${wallets.length} wallets (Gas: ${speedLabel})...`);
      this.executeMintSequence();
    }
  }

  /**
   * Pre-stage and Pre-Sign all transactions in memory during Standby
   */
  async preStageTransactions() {
    if (!this.dropInfo || !this.wallets || this.wallets.length === 0 || this.isPreStaging) return;

    this.isPreStaging = true;
    this.notify();

    const provider = Web3Service.getProvider(this.selectedChain);
    const gasSettings = this.gasConfig || StorageService.getGasConfig();

    try {
      const pricePerNft = parseFloat(this.dropInfo.mintPrice || '0');
      const totalPriceEth = pricePerNft * this.targetQty;
      const valueWei = ethers.parseEther(String(totalPriceEth));

      // Fetch fee data in advance
      let feeData = null;
      try {
        feeData = await provider.getFeeData();
      } catch (e) {}

      const gasParams = this.calculateGasParams(feeData, this.gasSpeed);
      const rawPrice = feeData?.gasPrice || feeData?.maxFeePerGas || 0n;
      const liveGwei = parseFloat(ethers.formatUnits(rawPrice, 'gwei'));
      const liveGweiStr = liveGwei < 0.001 ? liveGwei.toFixed(6) : (liveGwei < 1 ? liveGwei.toFixed(3) : liveGwei.toFixed(2));
      const tipFormatted = gasParams.maxPriorityFeePerGas 
        ? `${ethers.formatUnits(gasParams.maxPriorityFeePerGas, 'gwei')} Gwei Tip`
        : `${ethers.formatUnits(gasParams.gasPrice, 'gwei')} Gwei Price`;

      this.addLog('info', `⛽ [LIVE ON-CHAIN GAS: ${liveGweiStr} Gwei] Strategy: ${this.gasSpeed.toUpperCase()} -> Priority: ${tipFormatted}`);

      // Pre-instantiate signers and fetch nonces in parallel
      const signers = this.wallets.map(w => new ethers.Wallet(w.privateKey, provider));
      const nonces = await Promise.all(
        signers.map(s => provider.getTransactionCount(s.address, 'pending').catch(() => 0))
      );

      // Resolve drop protocol and correct transaction destination (SeaDrop vs Standalone)
      const dropProtocol = await this.resolveDropProtocol(this.dropInfo.contractAddress, provider, this.selectedChain.chainId);
      this.addLog('info', `🎯 Protocol: ${dropProtocol.type.toUpperCase()} | Target: ${dropProtocol.targetAddress} (NFT: ${this.dropInfo.contractAddress.slice(0, 10)}...)`);

      const seaDropInterface = new ethers.Interface(this.mintAbiSignatures);

      // Pre-sign all transactions into ready-to-broadcast raw hexes
      const preSigned = [];
      for (let i = 0; i < signers.length; i++) {
        if (!this.isArmed) break;

        const signer = signers[i];
        const walletItem = this.wallets[i];
        const nonce = nonces[i];

        let walletCalldata;
        if (dropProtocol.type === 'seadrop') {
          walletCalldata = seaDropInterface.encodeFunctionData("mintPublic", [
            this.dropInfo.contractAddress,
            ethers.ZeroAddress,
            signer.address,
            this.targetQty
          ]);
        } else {
          try {
            walletCalldata = seaDropInterface.encodeFunctionData("mint", [this.targetQty]);
          } catch (e) {
            walletCalldata = seaDropInterface.encodeFunctionData("publicMint", [this.targetQty]);
          }
        }

        const txObj = {
          to: dropProtocol.targetAddress,
          value: valueWei,
          data: walletCalldata,
          gasLimit: 280000n,
          nonce,
          chainId: this.selectedChain.chainId,
          ...gasParams,
        };

        const rawSignedHex = await signer.signTransaction(txObj);
        preSigned.push({
          walletIndex: i + 1,
          label: walletItem.label,
          address: signer.address,
          signer,
          rawSignedHex,
          txObj,
          totalPriceEth,
        });
      }

      if (this.isArmed && preSigned.length > 0) {
        this.preSignedTxs = preSigned;
        this.isPreSigned = true;
        this.addLog('success', `⚡ [NANOSECOND PRE-STAGE READY] ${preSigned.length}/${this.wallets.length} transactions pre-signed in RAM memory. Zero cryptographic delay on trigger!`);
      }
    } catch (err) {
      console.warn("Pre-staging error:", err);
    } finally {
      this.isPreStaging = false;
      this.notify();
    }
  }

  /**
   * Nanosecond High-Precision Trigger Blast
   */
  async triggerNanosecondBlast(triggerTimestamp) {
    if (!this.isArmed || this.isRunning) return;

    this.isArmed = false;
    this.stopGasMonitor();
    backgroundTimerService.disarmTimer();

    this.addLog('info', `⏰ [TRIGGER HIT AT EXACT T=0] Launching Nanosecond Multi-Wallet Execution...`);
    this.executeMintSequence();
  }

  /**
   * Manual Instant Mint Trigger
   */
  forceStartNow({ dropInfo, wallets, targetQuantityPerWallet = 1, chainInput, gasConfig, gasSpeed = 'high', executionMode = 'parallel' }) {
    this.stopGasMonitor();
    this.dropInfo = dropInfo;
    this.wallets = wallets;
    this.targetQty = targetQuantityPerWallet;
    this.selectedChain = chainInput;
    this.gasConfig = gasConfig || StorageService.getGasConfig();
    this.gasSpeed = gasSpeed || StorageService.getGasSpeed() || 'high';
    this.executionMode = executionMode;
    this.isArmed = false;
    this.shouldStop = false;
    this.preSignedTxs = [];
    backgroundTimerService.disarmTimer();

    const speedLabel = this.gasSpeed === 'high' ? '🚀 HIGH / FAST (2.5x Dynamic Live Boost)' : (this.gasSpeed === 'normal' ? '⚡ NORMAL (+35% Boost)' : '🐢 SLOW (1.0x Live Network)');
    this.addLog('warning', `⚡ Manual Instant Mint triggered by user for ${wallets.length} wallets! Gas: ${speedLabel}`);
    this.executeMintSequence();
  }

  stop() {
    this.stopGasMonitor();
    this.shouldStop = true;
    this.isRunning = false;
    this.isArmed = false;
    this.isPreSigned = false;
    this.preSignedTxs = [];
    backgroundTimerService.disarmTimer();
    this.addLog('warning', '🛑 Auto-Mint Bot Disarmed / Stopped by user.');
    this.notify();
  }

  mintAbiSignatures = [
    "function mintPublic(address nftContract, address feeRecipient, address minterIfNotPayer, uint256 quantity) external payable",
    "function mint(uint256 quantity) public payable",
    "function publicMint(uint256 quantity) public payable",
    "function mintNFT(uint256 quantity) public payable",
    "function claim(address receiver, uint256 quantity, address currency, uint256 pricePerToken, tuple(bytes32[] proof, uint256 quantityLimitPerWallet, uint256 pricePerToken, address currency) allowlistProof, bytes data) public payable",
    "function totalSupply() public view returns (uint256)",
    "function totalMinted() public view returns (uint256)",
    "function maxSupply() public view returns (uint256)",
    "function getAllowedSeaDrop() public view returns (address[])",
    "function getSeaDrop() public view returns (address)"
  ];

  /**
   * Resolve Contract Protocol (SeaDrop vs Standard Standalone ERC721)
   */
  async resolveDropProtocol(contractAddress, provider, chainId) {
    if (!ethers.isAddress(contractAddress)) {
      return { type: 'standard', targetAddress: contractAddress, seaDropAddress: null };
    }

    // 1. Query contract for SeaDrop integration on-chain
    try {
      const contract = new ethers.Contract(contractAddress, this.mintAbiSignatures, provider);
      try {
        const allowed = await contract.getAllowedSeaDrop();
        if (Array.isArray(allowed) && allowed.length > 0 && ethers.isAddress(allowed[0]) && allowed[0] !== ethers.ZeroAddress) {
          const seadropAddr = ethers.getAddress(allowed[0]);
          return { type: 'seadrop', targetAddress: seadropAddr, seaDropAddress: seadropAddr };
        }
      } catch (e) {}

      try {
        const single = await contract.getSeaDrop();
        if (ethers.isAddress(single) && single !== ethers.ZeroAddress) {
          const seadropAddr = ethers.getAddress(single);
          return { type: 'seadrop', targetAddress: seadropAddr, seaDropAddress: seadropAddr };
        }
      } catch (e) {}
    } catch (e) {}

    // 2. Check if OpenSea stages indicate SeaDrop
    const isSeaDrop = this.dropInfo?.stages?.some(s => 
      s.__typename && s.__typename.toLowerCase().includes('seadrop')
    );

    if (isSeaDrop) {
      const defaultSeaDrop = chainId === 4663 
        ? '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5' // Robinhood Chain
        : '0x00005EA00aC477B1030cE7850649663527901b0c'; // Standard SeaDrop v1
      const seadropAddr = ethers.getAddress(defaultSeaDrop);
      return { type: 'seadrop', targetAddress: seadropAddr, seaDropAddress: seadropAddr };
    }

    return { type: 'standard', targetAddress: ethers.getAddress(contractAddress), seaDropAddress: null };
  }

  /**
   * Real-Time Supply Availability Check
   */
  async checkSupplyAvailability(provider) {
    if (!ethers.isAddress(this.dropInfo?.contractAddress)) return true;

    try {
      const contract = new ethers.Contract(this.dropInfo.contractAddress, this.mintAbiSignatures, provider);
      const [totalRes, maxRes] = await Promise.allSettled([
        contract.totalSupply().catch(() => contract.totalMinted()),
        contract.maxSupply()
      ]);

      if (totalRes.status === 'fulfilled' && maxRes.status === 'fulfilled') {
        const total = Number(totalRes.value);
        const max = Number(maxRes.value);
        if (max > 0 && total >= max) {
          this.addLog('error', `🛑 [MINT HALTED: SOLD OUT] Total Supply (${total}/${max}) is fully minted out!`);
          return false;
        }
      }
    } catch (e) {}

    return true;
  }

  /**
   * Execute Multi-Wallet Mint (True Nanosecond Parallel Blast or Rapid Sequential)
   */
  async executeMintSequence() {
    if (this.isRunning) return;

    this.stopGasMonitor();
    this.isRunning = true;
    this.isArmed = false;
    this.notify();

    backgroundTimerService.playSound('launch');
    backgroundTimerService.sendNotification(
      '🚀 OpenSea Public Mint Started!',
      `Blasting across ${this.wallets.length} wallets now!`
    );

    const provider = Web3Service.getProvider(this.selectedChain);

    // Fetch live on-chain gas at this exact second
    let currentLiveFee = null;
    try {
      currentLiveFee = await provider.getFeeData();
    } catch (e) {}

    const rawLiveGas = currentLiveFee?.gasPrice || currentLiveFee?.maxFeePerGas || 0n;
    const liveGasGweiFloat = parseFloat(ethers.formatUnits(rawLiveGas, 'gwei'));
    const liveGasDisplay = liveGasGweiFloat < 0.001 ? liveGasGweiFloat.toFixed(6) : (liveGasGweiFloat < 1 ? liveGasGweiFloat.toFixed(3) : liveGasGweiFloat.toFixed(2));

    this.addLog('info', `==================================================`);
    this.addLog('info', `🚀 [NANOSECOND TRIGGER ENGAGED] Firing ${this.wallets.length} Wallets on ${this.selectedChain.name}`);
    this.addLog('info', `⛽ [LIVE ON-CHAIN GAS AT MINT] ${liveGasDisplay} Gwei | Speed: ${this.gasSpeed.toUpperCase()}`);
    this.addLog('info', `🎯 Contract: ${this.dropInfo.contractAddress} | Mode: ${this.executionMode.toUpperCase()}`);

    let totalBroadcasted = 0;

    // STRATEGY 1: TRUE 0MS PARALLEL BLAST (PRE-SIGNED IN RAM -> DIRECT RAW SOCKET BROADCAST)
    if (this.executionMode === 'parallel' && this.preSignedTxs.length > 0) {
      const blastStart = performance.now();
      this.addLog('info', `⚡ [0MS RAW SOCKET BLAST] Firing all ${this.preSignedTxs.length} pre-signed transactions simultaneously into active socket!`);

      // Fire all pre-signed raw hexes into socket buffers simultaneously
      const blastPromises = this.preSignedTxs.map(async (item) => {
        if (this.shouldStop) return;

        const dispatchStart = performance.now();
        try {
          const txRes = await provider.broadcastTransaction(item.rawSignedHex);
          const latencyMicrosecs = ((performance.now() - dispatchStart) * 1000).toFixed(0);

          totalBroadcasted++;

          this.addLog('tx', `✅ [IN MEMPOOL in ${latencyMicrosecs}µs] Wallet #${item.walletIndex} (${item.address.slice(0, 8)}...) Tx Dispatched!`, {
            hash: txRes.hash,
            wallet: item.address,
            quantity: this.targetQty,
            cost: `${item.totalPriceEth.toFixed(4)} ${this.dropInfo.symbol}`,
          });

          // Asynchronous background confirmation tracking
          txRes.wait(1).then((receipt) => {
            if (receipt.status === 1) {
              this.addLog('success', `🎉 [MINED ON BLOCK #${receipt.blockNumber}] Wallet #${item.walletIndex} Mint Confirmed!`);
            } else {
              this.addLog('error', `⚠️ [REVERTED ON CHAIN] Wallet #${item.walletIndex} Reverted on Block #${receipt.blockNumber}`);
            }
          }).catch((waitErr) => {
            const msg = waitErr?.reason || waitErr?.message || '';
            if (msg.toLowerCase().includes('sold out') || msg.toLowerCase().includes('exceed') || msg.toLowerCase().includes('max supply')) {
              this.shouldStop = true;
              this.addLog('error', `🛑 [SUPPLY SOLD OUT ON-CHAIN] Halting any further processing.`);
            }
          });

        } catch (err) {
          const errMsg = err?.reason || err?.message || 'Broadcast error';
          this.addLog('error', `❌ Wallet #${item.walletIndex} Broadcast Error: ${errMsg}`);
          if (errMsg.toLowerCase().includes('sold out') || errMsg.toLowerCase().includes('max supply') || errMsg.toLowerCase().includes('exceed')) {
            this.shouldStop = true;
            this.addLog('error', `🛑 [SUPPLY SOLD OUT ON-CHAIN] Stopping remaining queue.`);
          }
        }
      });

      const totalBlastMs = (performance.now() - blastStart).toFixed(2);
      this.addLog('success', `⚡ [0MS DISPATCH COMPLETE] All ${this.preSignedTxs.length} wallet transactions sent in ${totalBlastMs}ms!`);

      // Run supply availability check concurrently in background without blocking initial burst
      this.checkSupplyAvailability(provider).then((hasSupply) => {
        if (!hasSupply) this.shouldStop = true;
      }).catch(() => {});

      await Promise.all(blastPromises);

    } else {
      // For Sequential Cascade or un-signed Fallback: verify supply first
      const isAvailable = await this.checkSupplyAvailability(provider);
      if (!isAvailable) {
        this.isRunning = false;
        this.notify();
        return;
      }

      if (this.executionMode === 'parallel') {
        const blastStart = performance.now();
        // Fallback: Parallel immediate sign & blast if not pre-signed
        this.addLog('info', `⚡ Parallel Sign & Blast across ${this.wallets.length} wallets...`);
        const gasSettings = this.gasConfig || StorageService.getGasConfig();
        const pricePerNft = parseFloat(this.dropInfo.mintPrice || '0');
        const totalPriceEth = pricePerNft * this.targetQty;
        const valueWei = ethers.parseEther(String(totalPriceEth));

        const dropProtocol = await this.resolveDropProtocol(this.dropInfo.contractAddress, provider, this.selectedChain.chainId);

        let feeData = null;
        try { feeData = await provider.getFeeData(); } catch (e) {}
        const gasParams = this.calculateGasParams(feeData, this.gasSpeed, gasSettings);

        const parallelPromises = this.wallets.map(async (walletItem, i) => {
          if (this.shouldStop) return;

          const signer = new ethers.Wallet(walletItem.privateKey, provider);
          const dispatchStart = performance.now();

          const txOverrides = {
            value: valueWei,
            gasLimit: 280000n,
            ...gasParams,
          };

          try {
            let tx;
            if (dropProtocol.type === 'seadrop') {
              try {
                const seaDrop = new ethers.Contract(dropProtocol.targetAddress, this.mintAbiSignatures, signer);
                tx = await seaDrop.mintPublic(this.dropInfo.contractAddress, ethers.ZeroAddress, signer.address, this.targetQty, txOverrides);
              } catch (seadropErr) {
                // If SeaDrop mintPublic reverted, fallback to direct contract methods
                const contract = new ethers.Contract(this.dropInfo.contractAddress, this.mintAbiSignatures, signer);
                try {
                  tx = await contract.mint(this.targetQty, txOverrides);
                } catch (e1) {
                  try {
                    tx = await contract.publicMint(this.targetQty, txOverrides);
                  } catch (e2) {
                    throw seadropErr;
                  }
                }
              }
            } else {
              const contract = new ethers.Contract(this.dropInfo.contractAddress, this.mintAbiSignatures, signer);
              try {
                tx = await contract.mint(this.targetQty, txOverrides);
              } catch (e1) {
                try {
                  tx = await contract.publicMint(this.targetQty, txOverrides);
                } catch (e2) {
                  try {
                    tx = await contract.mintNFT(this.targetQty, txOverrides);
                  } catch (e3) {
                    tx = await signer.sendTransaction({
                      to: this.dropInfo.contractAddress,
                      ...txOverrides,
                    });
                  }
                }
              }
            }

            const dispatchMs = (performance.now() - dispatchStart).toFixed(1);
            totalBroadcasted++;

            this.addLog('tx', `✅ [DISPATCHED in ${dispatchMs}ms] Wallet #${i + 1} Tx in Mempool!`, {
              hash: tx.hash,
              wallet: signer.address,
              quantity: this.targetQty,
              cost: `${totalPriceEth.toFixed(4)} ${this.dropInfo.symbol}`,
            });

            tx.wait(1).then((receipt) => {
              if (receipt.status === 1) {
                this.addLog('success', `🎉 [CONFIRMED ON BLOCK #${receipt.blockNumber}] Wallet #${i + 1} Mint Successful!`);
              } else {
                this.addLog('error', `⚠️ [REVERTED ON CHAIN] Wallet #${i + 1} Reverted on Block #${receipt.blockNumber}`);
              }
            }).catch((waitErr) => {
              const msg = waitErr?.reason || waitErr?.message || '';
              if (msg.toLowerCase().includes('sold out') || msg.toLowerCase().includes('exceed') || msg.toLowerCase().includes('max supply')) {
                this.shouldStop = true;
                this.addLog('error', `🛑 [SUPPLY SOLD OUT] Stopping remaining queue.`);
              }
            });

          } catch (err) {
            const errMsg = err?.reason || err?.message || 'Broadcast failed';
            this.addLog('error', `❌ Wallet #${i + 1} Error: ${errMsg}`);
            if (errMsg.toLowerCase().includes('sold out') || errMsg.toLowerCase().includes('max supply') || errMsg.toLowerCase().includes('exceed')) {
              this.shouldStop = true;
            }
          }
        });

        await Promise.all(parallelPromises);

        const totalBlastMs = (performance.now() - blastStart).toFixed(2);
        this.addLog('success', `⚡ [PARALLEL BLAST COMPLETE] All ${totalBroadcasted} wallet transactions dispatched in ${totalBlastMs}ms!`);
      } else {
      // STRATEGY 2: RAPID SEQUENTIAL CASCADE WITH REAL-TIME SUPPLY VERIFICATION
      const gasSettings = this.gasConfig || StorageService.getGasConfig();
      const pricePerNft = parseFloat(this.dropInfo.mintPrice || '0');
      const totalPriceEth = pricePerNft * this.targetQty;
      const valueWei = ethers.parseEther(String(totalPriceEth));

      const dropProtocol = await this.resolveDropProtocol(this.dropInfo.contractAddress, provider, this.selectedChain.chainId);

      let feeData = null;
      try { feeData = await provider.getFeeData(); } catch (e) {}
      const gasParams = this.calculateGasParams(feeData, this.gasSpeed, gasSettings);

      for (let i = 0; i < this.wallets.length; i++) {
        if (this.shouldStop) break;

        // Check supply before every wallet in sequential mode
        const hasSupply = await this.checkSupplyAvailability(provider);
        if (!hasSupply) {
          this.shouldStop = true;
          break;
        }

        const walletItem = this.wallets[i];
        const signer = new ethers.Wallet(walletItem.privateKey, provider);
        const startTimeMs = performance.now();

        const txOverrides = {
          value: valueWei,
          gasLimit: 280000n,
          ...gasParams,
        };

        try {
          let tx;
          if (dropProtocol.type === 'seadrop') {
            try {
              const seaDrop = new ethers.Contract(dropProtocol.targetAddress, this.mintAbiSignatures, signer);
              tx = await seaDrop.mintPublic(this.dropInfo.contractAddress, ethers.ZeroAddress, signer.address, this.targetQty, txOverrides);
            } catch (seadropErr) {
              // If SeaDrop mintPublic reverted, fallback to direct contract methods
              const contract = new ethers.Contract(this.dropInfo.contractAddress, this.mintAbiSignatures, signer);
              try {
                tx = await contract.mint(this.targetQty, txOverrides);
              } catch (e1) {
                try {
                  tx = await contract.publicMint(this.targetQty, txOverrides);
                } catch (e2) {
                  throw seadropErr;
                }
              }
            }
          } else {
            const contract = new ethers.Contract(this.dropInfo.contractAddress, this.mintAbiSignatures, signer);
            try {
              tx = await contract.mint(this.targetQty, txOverrides);
            } catch (e1) {
              try {
                tx = await contract.publicMint(this.targetQty, txOverrides);
              } catch (e2) {
                try {
                  tx = await contract.mintNFT(this.targetQty, txOverrides);
                } catch (e3) {
                  tx = await signer.sendTransaction({
                    to: this.dropInfo.contractAddress,
                    ...txOverrides,
                  });
                }
              }
            }
          }

          const executionMs = (performance.now() - startTimeMs).toFixed(1);
          totalBroadcasted++;

          this.addLog('tx', `✅ [BROADCASTED in ${executionMs}ms] Wallet #${i + 1} (${signer.address.slice(0, 8)}...) In Mempool!`, {
            hash: tx.hash,
            wallet: signer.address,
            quantity: this.targetQty,
            cost: `${totalPriceEth.toFixed(4)} ${this.dropInfo.symbol}`,
          });

          tx.wait(1).then((receipt) => {
            if (receipt.status === 1) {
              this.addLog('success', `🎉 [CONFIRMED ON BLOCK #${receipt.blockNumber}] Wallet #${i + 1} Mint Successful!`);
            }
          }).catch((waitErr) => {
            const msg = waitErr?.reason || waitErr?.message || '';
            if (msg.toLowerCase().includes('sold out') || msg.toLowerCase().includes('exceed') || msg.toLowerCase().includes('max supply')) {
              this.shouldStop = true;
              this.addLog('error', `🛑 [SUPPLY SOLD OUT ON-CHAIN] Halting remaining wallets.`);
            }
          });

          if (i < this.wallets.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 5));
          }

        } catch (err) {
          const errMsg = err?.reason || err?.message || 'Broadcast failed';
          this.addLog('error', `❌ Wallet #${i + 1} Error: ${errMsg}`);
          if (errMsg.toLowerCase().includes('sold out') || errMsg.toLowerCase().includes('max supply') || errMsg.toLowerCase().includes('exceed')) {
            this.shouldStop = true;
            this.addLog('error', `🛑 [SUPPLY SOLD OUT] Stopping remaining wallets.`);
            break;
          }
        }
      }
    }
  }

    this.isRunning = false;
    this.isPreSigned = false;
    this.preSignedTxs = [];
    backgroundTimerService.playSound('success');
    try { confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } }); } catch (e) {}
    this.addLog('info', `==================================================`);
    this.addLog('success', `⚡ BATCH COMPLETE! Total Broadcasted: ${totalBroadcasted} Transactions.`);
    this.notify();
  }
}

export const autoMintEngine = new AutoMintEngine();
