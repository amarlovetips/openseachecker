import { ethers } from 'ethers';
import { StorageService } from './storage';

export const WalletHdService = {
  /**
   * Validate if a string is a valid 12 or 24 word BIP-39 mnemonic
   */
  isValidMnemonic(mnemonic) {
    if (!mnemonic || typeof mnemonic !== 'string') return false;
    const words = mnemonic.trim().split(/\s+/);
    return (words.length === 12 || words.length === 15 || words.length === 18 || words.length === 21 || words.length === 24) && ethers.Mnemonic.isValidMnemonic(mnemonic.trim());
  },

  /**
   * Validate if a string is a valid EVM private key
   */
  isValidPrivateKey(pk) {
    if (!pk || typeof pk !== 'string') return false;
    const cleanPk = pk.trim().startsWith('0x') ? pk.trim() : `0x${pk.trim()}`;
    return /^0x[a-fA-F0-9]{64}$/.test(cleanPk);
  },

  /**
   * Generate HD Wallets from Secret Recovery Phrase (Mnemonic)
   * Derivation Path: m/44'/60'/0'/0/i
   */
  generateHdWallets(mnemonic, count = 5) {
    const wallets = [];
    if (!this.isValidMnemonic(mnemonic)) {
      return [];
    }

    try {
      const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic.trim());

      for (let i = 0; i < count; i++) {
        const path = `m/44'/60'/0'/0/${i}`;
        const derivedNode = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, path);
        wallets.push({
          id: `hd_${i}`,
          type: 'hd',
          index: i,
          path: path,
          label: i === 0 ? `Main Fat Wallet (#1)` : `Sub-Wallet #${i + 1}`,
          address: derivedNode.address,
          privateKey: derivedNode.privateKey,
          isMain: i === 0,
        });
      }
    } catch (err) {
      console.error("Error deriving HD wallets:", err);
      return [];
    }

    return wallets;
  },

  /**
   * Load all wallets combining derived HD wallets + custom imported private keys
   */
  getAllWallets() {
    const mnemonic = StorageService.getMnemonic();
    const count = StorageService.getDerivedCount();
    const customKeys = StorageService.getCustomPrivateKeys();

    let wallets = [];

    // 1. Derive HD wallets if mnemonic exists
    if (mnemonic && this.isValidMnemonic(mnemonic)) {
      wallets = this.generateHdWallets(mnemonic, count);
    }

    // 2. Append custom imported private keys
    customKeys.forEach((item, idx) => {
      const pk = typeof item === 'string' ? item : item.key;
      const customLabel = typeof item === 'object' && item.label ? item.label : `Imported Wallet #${idx + 1}`;

      if (this.isValidPrivateKey(pk)) {
        try {
          const cleanPk = pk.trim().startsWith('0x') ? pk.trim() : `0x${pk.trim()}`;
          const customWallet = new ethers.Wallet(cleanPk);
          wallets.push({
            id: `custom_${idx}_${customWallet.address.slice(2, 8)}`,
            type: 'custom',
            index: wallets.length,
            path: 'Direct Private Key',
            label: customLabel,
            address: customWallet.address,
            privateKey: customWallet.privateKey,
            isMain: wallets.length === 0,
          });
        } catch (e) {
          console.error("Invalid custom key in storage:", pk);
        }
      }
    });

    return wallets;
  },

  /**
   * Truncate EVM Address for UI display (0x1234...5678)
   */
  truncateAddress(addr, chars = 4) {
    if (!addr) return '';
    return `${addr.substring(0, chars + 2)}...${addr.substring(addr.length - chars)}`;
  }
};
