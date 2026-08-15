import { ethers } from 'ethers';
import { Web3Service } from './web3';
import { StorageService } from './storage';
import { backgroundTimerService } from './backgroundWorker';
import confetti from 'canvas-confetti';

export class AutoMintEngine {
  constructor() {
    this.isRunning = false;
    this.isArmed = false;
    this.shouldStop = false;
    this.dropInfo = null;
    this.wallets = [];
    this.targetQty = 1;
    this.selectedChain = null;
    this.logs = [];
    this.listeners = new Set();
    this.unsubWorker = null;

    // Attach to unthrottled background worker
    this.unsubWorker = backgroundTimerService.subscribe(() => {
      this.checkArmedTrigger();
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
   * Arm the bot in 0ms Standby Mode.
   */
  armAutoMint({ dropInfo, wallets, targetQuantityPerWallet = 1, chainInput, gasConfig }) {
    if (this.isRunning) return;

    this.dropInfo = dropInfo;
    this.wallets = wallets;
    this.targetQty = targetQuantityPerWallet;
    this.selectedChain = chainInput;
    this.gasConfig = gasConfig || StorageService.getGasConfig();
    this.isArmed = true;
    this.shouldStop = false;

    backgroundTimerService.requestNotificationPermission();

    const now = Date.now();
    const startTime = dropInfo.startTime || 0;

    if (startTime > now) {
      const diffMs = startTime - now;
      const diffMins = (diffMs / (1000 * 60)).toFixed(1);
      const targetTimeStr = new Date(startTime).toLocaleTimeString();

      this.addLog('warning', `🛡️ [AUTO-MINT ARMED IN 0MS STANDBY] Target Launch Time: ${targetTimeStr} (in ${diffMins} mins).`);
      this.addLog('info', `⏳ STANDBY ACTIVE: Fast Mempool Pipeline Ready. Selected Wallets: ${wallets.length}. NO transaction will be sent until countdown hits 0.`);
      this.addLog('info', `⚡ Unthrottled Background Worker: You can safely minimize this tab or use other apps.`);
      this.notify();
    } else {
      this.addLog('info', `⚡ Launch time active! Initiating Turbo Mempool Auto-Mint across ${wallets.length} wallets...`);
      this.executeMintSequence();
    }
  }

  /**
   * Manual Instant Mint Trigger
   */
  forceStartNow({ dropInfo, wallets, targetQuantityPerWallet = 1, chainInput, gasConfig }) {
    this.dropInfo = dropInfo;
    this.wallets = wallets;
    this.targetQty = targetQuantityPerWallet;
    this.selectedChain = chainInput;
    this.gasConfig = gasConfig || StorageService.getGasConfig();
    this.isArmed = false;
    this.shouldStop = false;

    this.addLog('warning', `⚡ Manual Instant Mint triggered by user for ${wallets.length} wallets!`);
    this.executeMintSequence();
  }

  /**
   * Background unthrottled worker check
   */
  checkArmedTrigger() {
    if (!this.isArmed || this.isRunning || !this.dropInfo) return;

    const now = Date.now();
    const startTime = this.dropInfo.startTime || 0;

    if (startTime > 0 && now >= startTime) {
      this.isArmed = false;
      this.addLog('info', `⏰ [TRIGGER ACTIVATED] Public Mint Countdown Complete! Launching Turbo Pipeline...`);
      this.executeMintSequence();
    }
  }

  stop() {
    this.shouldStop = true;
    this.isRunning = false;
    this.isArmed = false;
    this.addLog('warning', '🛑 Auto-Mint Bot Disarmed / Stopped by user.');
    this.notify();
  }

  /**
   * Universal OpenSea SeaDrop & Standard Drop Signatures
   */
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
   * Check Live On-Chain Supply Availability
   */
  async checkSupplyAvailability(provider) {
    if (!ethers.isAddress(this.dropInfo.contractAddress)) return true;

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
   * Execute Multi-Wallet Fast Mempool Pipeline (Non-blocking tx broadcast with supply verification)
   */
  async executeMintSequence() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isArmed = false;
    this.notify();

    backgroundTimerService.playSound('launch');
    backgroundTimerService.sendNotification(
      '🚀 OpenSea Public Mint Started!',
      `Turbo Broadcasting across ${this.wallets.length} wallets now!`
    );

    const gasSettings = this.gasConfig || StorageService.getGasConfig();
    const provider = Web3Service.getProvider(this.selectedChain);

    this.addLog('info', `==================================================`);
    this.addLog('info', `🚀 [TURBO MEMPOOL LAUNCH] Rapid Non-Blocking Broadcast across ${this.wallets.length} Wallets`);
    this.addLog('info', `🎯 Contract: ${this.dropInfo.contractAddress} | Chain: ${this.selectedChain.name}`);
    this.addLog('info', `👛 Target: ${this.targetQty} NFT/Wallet | Mode: Fast Mempool Pipeline (No Block Delay)`);

    // 1. Initial Supply Check
    const isAvailable = await this.checkSupplyAvailability(provider);
    if (!isAvailable) {
      this.isRunning = false;
      this.notify();
      return;
    }

    let totalBroadcasted = 0;

    // Fetch live fee data for gas calculation
    let feeData = null;
    try {
      feeData = await provider.getFeeData();
    } catch (e) {}

    const maxFeeGwei = gasSettings.maxFeeGwei || '35';
    const maxPriorityFeeGwei = gasSettings.maxPriorityFeeGwei || '3.0';

    const pricePerNft = parseFloat(this.dropInfo.mintPrice || '0');
    const totalPriceEth = pricePerNft * this.targetQty;
    const valueWei = ethers.parseEther(String(totalPriceEth));

    // Fast Cascade Pipeline: Wallet 1 -> Wallet 2 -> Wallet 3 (Non-blocking!)
    for (let i = 0; i < this.wallets.length; i++) {
      if (this.shouldStop) {
        this.addLog('warning', `🛑 Multi-Wallet pipeline stopped by user.`);
        break;
      }

      const walletItem = this.wallets[i];
      const signer = new ethers.Wallet(walletItem.privateKey, provider);

      this.addLog('info', `--------------------------------------------------`);
      this.addLog('info', `⚡ [Wallet ${i + 1}/${this.wallets.length}] Broadcasting from ${walletItem.label} (${signer.address.slice(0, 8)}...${signer.address.slice(-6)})`);

      const startTimeMs = performance.now();

      // Gas parameters
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
        let txPromise;
        const contract = new ethers.Contract(this.dropInfo.contractAddress, this.mintAbiSignatures, signer);

        // Try standard mint or seadrop
        try {
          txPromise = contract.mint(this.targetQty, txParams);
        } catch (e1) {
          try {
            txPromise = contract.publicMint(this.targetQty, txParams);
          } catch (e2) {
            try {
              const seaDrop = new ethers.Contract('0x00005EA00Ac477B1030CE7850649663527901b0c', this.mintAbiSignatures, signer);
              txPromise = seaDrop.mintPublic(this.dropInfo.contractAddress, ethers.ZeroAddress, signer.address, this.targetQty, txParams);
            } catch (e3) {
              txPromise = signer.sendTransaction(txParams);
            }
          }
        }

        const tx = await txPromise;
        const broadcastMs = (performance.now() - startTimeMs).toFixed(1);

        totalBroadcasted++;

        this.addLog('tx', `✅ [BROADCASTED in ${broadcastMs}ms] Wallet #${i + 1} Tx In Mempool!`, {
          hash: tx.hash,
          wallet: signer.address,
          quantity: this.targetQty,
          cost: `${totalPriceEth.toFixed(4)} ${this.dropInfo.symbol}`,
        });

        try { confetti({ particleCount: 25, spread: 50, origin: { y: 0.8 } }); } catch (e) {}

        // Track block confirmation in the background (DOES NOT BLOCK NEXT WALLET!)
        tx.wait(1).then((receipt) => {
          if (receipt.status === 1) {
            this.addLog('success', `🎉 [CONFIRMED ON BLOCK #${receipt.blockNumber}] Wallet #${i + 1} (${signer.address.slice(0, 8)}...) Mint Completed!`);
          } else {
            this.addLog('error', `⚠️ [REVERTED ON CHAIN] Wallet #${i + 1} Tx Reverted on Block #${receipt.blockNumber}`);
          }
        }).catch((waitErr) => {
          // If transaction reverted due to sold out, stop remaining pipeline
          const msg = waitErr?.reason || waitErr?.message || '';
          if (msg.toLowerCase().includes('sold out') || msg.toLowerCase().includes('exceed') || msg.toLowerCase().includes('max supply')) {
            this.shouldStop = true;
            this.addLog('error', `🛑 [SUPPLY SOLD OUT ON-CHAIN] Halting remaining wallet queue to save gas.`);
          }
        });

        // Instant rapid cascade to next wallet (Only 5ms delay between broadcasts!)
        if (i < this.wallets.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }

      } catch (err) {
        const errMsg = err?.reason || err?.message || 'Broadcast Failed';
        this.addLog('error', `❌ Wallet #${i + 1} Broadcast Error: ${errMsg}`);

        // Check if error is due to Sold Out / Max Supply reached
        if (errMsg.toLowerCase().includes('sold out') || errMsg.toLowerCase().includes('max supply') || errMsg.toLowerCase().includes('exceed')) {
          this.shouldStop = true;
          this.addLog('error', `🛑 [MINT COMPLETED / SOLD OUT] Halting remaining wallets to protect your funds.`);
          break;
        }
      }
    }

    this.isRunning = false;
    backgroundTimerService.playSound('success');
    this.addLog('info', `==================================================`);
    this.addLog('success', `⚡ TURBO BATCH COMPLETE! Total Broadcasted: ${totalBroadcasted} Transactions into Mempool in Parallel.`);
    this.notify();
  }
}

export const autoMintEngine = new AutoMintEngine();
