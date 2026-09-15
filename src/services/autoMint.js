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
    this.preSignedTxs = [];
    this.logs = [];
    this.listeners = new Set();
    this.unsubWorker = null;
    this.unsubTrigger = null;

    // Attach to worker high-resolution trigger
    this.unsubTrigger = backgroundTimerService.onTrigger((triggerTimestamp) => {
      this.triggerNanosecondBlast(triggerTimestamp);
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
   * Arm the bot with Nanosecond Pre-Sign Pipeline
   */
  async armAutoMint({
    dropInfo,
    wallets,
    targetQuantityPerWallet = 1,
    chainInput,
    gasConfig,
    executionMode = 'parallel',
    latencyOffsetMs = 15
  }) {
    if (this.isRunning) return;

    this.dropInfo = dropInfo;
    this.wallets = wallets;
    this.targetQty = targetQuantityPerWallet;
    this.selectedChain = chainInput;
    this.gasConfig = gasConfig || StorageService.getGasConfig();
    this.executionMode = executionMode;
    this.latencyOffsetMs = latencyOffsetMs;
    this.isArmed = true;
    this.shouldStop = false;
    this.isPreSigned = false;
    this.preSignedTxs = [];

    backgroundTimerService.requestNotificationPermission();

    const now = Date.now();
    const startTime = dropInfo.startTime || 0;

    if (startTime > now) {
      const diffMs = startTime - now;
      const diffSecs = (diffMs / 1000).toFixed(1);
      const targetTimeStr = new Date(startTime).toLocaleTimeString();

      this.addLog('warning', `🛡️ [ARMED IN 0MS STANDBY] Target Launch: ${targetTimeStr} (${diffSecs}s remaining).`);
      this.addLog('info', `⚡ Mode: ${this.executionMode.toUpperCase()} BLAST | Lead Compensation: -${this.latencyOffsetMs}ms.`);
      this.addLog('info', `⏳ Pre-staging transactions in background memory for zero-latency nanosecond trigger...`);

      // Arm background high-resolution worker
      backgroundTimerService.armTimer(startTime, this.latencyOffsetMs);

      // Immediately pre-stage and pre-sign all raw transactions ahead of time
      this.preStageTransactions();
    } else {
      this.addLog('info', `⚡ Launch time already active! Initiating immediate blast across ${wallets.length} wallets...`);
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

      const maxFeeGwei = gasSettings.maxFeeGwei || '35';
      const maxPriorityFeeGwei = gasSettings.maxPriorityFeeGwei || '3.0';

      // Fetch fee data in advance
      let feeData = null;
      try {
        feeData = await provider.getFeeData();
      } catch (e) {}

      // Pre-instantiate signers and fetch nonces in parallel
      const signers = this.wallets.map(w => new ethers.Wallet(w.privateKey, provider));
      const nonces = await Promise.all(
        signers.map(s => provider.getTransactionCount(s.address, 'pending').catch(() => 0))
      );

      // Determine contract calldata
      const seaDropInterface = new ethers.Interface(this.mintAbiSignatures);
      let targetCalldata = null;

      // Try encoding SeaDrop mintPublic or standard mint
      try {
        targetCalldata = seaDropInterface.encodeFunctionData("mintPublic", [
          this.dropInfo.contractAddress,
          ethers.ZeroAddress,
          signers[0].address,
          this.targetQty
        ]);
      } catch (e) {
        targetCalldata = seaDropInterface.encodeFunctionData("mint", [this.targetQty]);
      }

      // Pre-sign all transactions into ready-to-broadcast raw hexes
      const preSigned = [];
      for (let i = 0; i < signers.length; i++) {
        if (!this.isArmed) break;

        const signer = signers[i];
        const walletItem = this.wallets[i];
        const nonce = nonces[i];

        // Specific calldata per wallet (for SeaDrop minterIfNotPayer)
        let walletCalldata = targetCalldata;
        try {
          walletCalldata = seaDropInterface.encodeFunctionData("mintPublic", [
            this.dropInfo.contractAddress,
            ethers.ZeroAddress,
            signer.address,
            this.targetQty
          ]);
        } catch (e) {
          walletCalldata = targetCalldata;
        }

        const txObj = {
          to: this.dropInfo.contractAddress,
          value: valueWei,
          data: walletCalldata,
          gasLimit: 250000n,
          nonce,
          chainId: this.selectedChain.chainId,
        };

        if (feeData && feeData.maxFeePerGas) {
          txObj.maxFeePerGas = ethers.parseUnits(String(maxFeeGwei), 'gwei');
          txObj.maxPriorityFeePerGas = ethers.parseUnits(String(maxPriorityFeeGwei), 'gwei');
        } else {
          txObj.gasPrice = feeData?.gasPrice || ethers.parseUnits(String(maxFeeGwei), 'gwei');
        }

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
    backgroundTimerService.disarmTimer();

    this.addLog('info', `⏰ [TRIGGER HIT AT EXACT T=0] Launching Nanosecond Multi-Wallet Execution...`);
    this.executeMintSequence();
  }

  /**
   * Manual Instant Mint Trigger
   */
  forceStartNow({ dropInfo, wallets, targetQuantityPerWallet = 1, chainInput, gasConfig, executionMode = 'parallel' }) {
    this.dropInfo = dropInfo;
    this.wallets = wallets;
    this.targetQty = targetQuantityPerWallet;
    this.selectedChain = chainInput;
    this.gasConfig = gasConfig || StorageService.getGasConfig();
    this.executionMode = executionMode;
    this.isArmed = false;
    this.shouldStop = false;
    this.preSignedTxs = [];
    backgroundTimerService.disarmTimer();

    this.addLog('warning', `⚡ Manual Instant Mint triggered by user for ${wallets.length} wallets!`);
    this.executeMintSequence();
  }

  stop() {
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
    "function maxSupply() public view returns (uint256)"
  ];

  /**
   * Real-Time Supply Availability Check
   */
  async checkSupplyAvailability(provider) {
    if (!ethers.isAddress(this.dropInfo?.contractAddress)) return true;

    try {
      const contract = new ethers.Contract(this.dropInfo.contractAddress, this.mintAbiSignatures, provider);
      const [totalRes, maxRes] = await Promise.allSettled([
        contract.totalSupply(),
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

    this.isRunning = true;
    this.isArmed = false;
    this.notify();

    backgroundTimerService.playSound('launch');
    backgroundTimerService.sendNotification(
      '🚀 OpenSea Public Mint Started!',
      `Blasting across ${this.wallets.length} wallets now!`
    );

    const provider = Web3Service.getProvider(this.selectedChain);

    this.addLog('info', `==================================================`);
    this.addLog('info', `🚀 [NANOSECOND TRIGGER ENGAGED] Firing ${this.wallets.length} Wallets on ${this.selectedChain.name}`);
    this.addLog('info', `🎯 Contract: ${this.dropInfo.contractAddress} | Mode: ${this.executionMode.toUpperCase()}`);

    // 1. Initial On-Chain Supply Availability Check
    const isAvailable = await this.checkSupplyAvailability(provider);
    if (!isAvailable) {
      this.isRunning = false;
      this.notify();
      return;
    }

    let totalBroadcasted = 0;

    // STRATEGY 1: PARALLEL NANOSECOND BLAST (ALL WALLETS DISPATCHED CONCURRENTLY)
    if (this.executionMode === 'parallel') {
      const blastStart = performance.now();

      // If pre-signed transactions exist, blast them simultaneously via raw socket
      if (this.preSignedTxs.length > 0) {
        this.addLog('info', `⚡ [PARALLEL RAW BLAST] Broadcasting all pre-signed transactions simultaneously...`);

        const blastPromises = this.preSignedTxs.map(async (item) => {
          if (this.shouldStop) return;

          const dispatchStart = performance.now();
          try {
            const txRes = await provider.broadcastTransaction(item.rawSignedHex);
            const latencyMicrosecs = ((performance.now() - dispatchStart) * 1000).toFixed(0);

            totalBroadcasted++;

            this.addLog('tx', `✅ [DISPATCHED in ${latencyMicrosecs}µs] Wallet #${item.walletIndex} (${item.address.slice(0, 8)}...) Tx in Mempool!`, {
              hash: txRes.hash,
              wallet: item.address,
              quantity: this.targetQty,
              cost: `${item.totalPriceEth.toFixed(4)} ${this.dropInfo.symbol}`,
            });

            // Asynchronous background confirmation tracking
            txRes.wait(1).then((receipt) => {
              if (receipt.status === 1) {
                this.addLog('success', `🎉 [CONFIRMED ON BLOCK #${receipt.blockNumber}] Wallet #${item.walletIndex} Mint Successful!`);
              } else {
                this.addLog('error', `⚠️ [REVERTED ON CHAIN] Wallet #${item.walletIndex} Reverted on Block #${receipt.blockNumber}`);
              }
            }).catch((waitErr) => {
              const msg = waitErr?.reason || waitErr?.message || '';
              if (msg.toLowerCase().includes('sold out') || msg.toLowerCase().includes('exceed') || msg.toLowerCase().includes('max supply')) {
                this.shouldStop = true;
                this.addLog('error', `🛑 [SUPPLY SOLD OUT ON-CHAIN] Halting any further processing to protect funds.`);
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

        await Promise.all(blastPromises);

      } else {
        // Fallback: Parallel immediate sign & blast if not pre-signed
        this.addLog('info', `⚡ Parallel Sign & Blast across ${this.wallets.length} wallets...`);
        const gasSettings = this.gasConfig || StorageService.getGasConfig();
        const pricePerNft = parseFloat(this.dropInfo.mintPrice || '0');
        const totalPriceEth = pricePerNft * this.targetQty;
        const valueWei = ethers.parseEther(String(totalPriceEth));
        const maxFeeGwei = gasSettings.maxFeeGwei || '35';
        const maxPriorityFeeGwei = gasSettings.maxPriorityFeeGwei || '3.0';

        let feeData = null;
        try { feeData = await provider.getFeeData(); } catch (e) {}

        const parallelPromises = this.wallets.map(async (walletItem, i) => {
          if (this.shouldStop) return;

          const signer = new ethers.Wallet(walletItem.privateKey, provider);
          const dispatchStart = performance.now();

          const txParams = {
            to: this.dropInfo.contractAddress,
            value: valueWei,
            gasLimit: 250000n,
          };

          if (feeData && feeData.maxFeePerGas) {
            txParams.maxFeePerGas = ethers.parseUnits(String(maxFeeGwei), 'gwei');
            txParams.maxPriorityFeePerGas = ethers.parseUnits(String(maxPriorityFeeGwei), 'gwei');
          } else {
            txParams.gasPrice = feeData?.gasPrice || ethers.parseUnits(String(maxFeeGwei), 'gwei');
          }

          try {
            const contract = new ethers.Contract(this.dropInfo.contractAddress, this.mintAbiSignatures, signer);
            let tx;
            try {
              tx = await contract.mint(this.targetQty, txParams);
            } catch (e1) {
              try {
                tx = await contract.publicMint(this.targetQty, txParams);
              } catch (e2) {
                try {
                  const seaDrop = new ethers.Contract('0x00005EA00Ac477B1030CE7850649663527901b0c', this.mintAbiSignatures, signer);
                  tx = await seaDrop.mintPublic(this.dropInfo.contractAddress, ethers.ZeroAddress, signer.address, this.targetQty, txParams);
                } catch (e3) {
                  tx = await signer.sendTransaction(txParams);
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
      }

      const totalBlastMs = (performance.now() - blastStart).toFixed(2);
      this.addLog('success', `⚡ [PARALLEL BLAST COMPLETE] All ${totalBroadcasted} wallet transactions dispatched in ${totalBlastMs}ms!`);

    } else {
      // STRATEGY 2: RAPID SEQUENTIAL CASCADE WITH REAL-TIME SUPPLY VERIFICATION
      const gasSettings = this.gasConfig || StorageService.getGasConfig();
      const pricePerNft = parseFloat(this.dropInfo.mintPrice || '0');
      const totalPriceEth = pricePerNft * this.targetQty;
      const valueWei = ethers.parseEther(String(totalPriceEth));
      const maxFeeGwei = gasSettings.maxFeeGwei || '35';
      const maxPriorityFeeGwei = gasSettings.maxPriorityFeeGwei || '3.0';

      let feeData = null;
      try { feeData = await provider.getFeeData(); } catch (e) {}

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

        const txParams = {
          to: this.dropInfo.contractAddress,
          value: valueWei,
          gasLimit: 250000n,
        };

        if (feeData && feeData.maxFeePerGas) {
          txParams.maxFeePerGas = ethers.parseUnits(String(maxFeeGwei), 'gwei');
          txParams.maxPriorityFeePerGas = ethers.parseUnits(String(maxPriorityFeeGwei), 'gwei');
        } else {
          txParams.gasPrice = feeData?.gasPrice || ethers.parseUnits(String(maxFeeGwei), 'gwei');
        }

        try {
          const contract = new ethers.Contract(this.dropInfo.contractAddress, this.mintAbiSignatures, signer);
          let tx;
          try {
            tx = await contract.mint(this.targetQty, txParams);
          } catch (e1) {
            try {
              tx = await contract.publicMint(this.targetQty, txParams);
            } catch (e2) {
              try {
                const seaDrop = new ethers.Contract('0x00005EA00Ac477B1030CE7850649663527901b0c', this.mintAbiSignatures, signer);
                tx = await seaDrop.mintPublic(this.dropInfo.contractAddress, ethers.ZeroAddress, signer.address, this.targetQty, txParams);
              } catch (e3) {
                tx = await signer.sendTransaction(txParams);
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
