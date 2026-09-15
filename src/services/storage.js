// Persistent Browser Storage Service

const STORAGE_KEYS = {
  MNEMONIC: 'opensea_bot_mnemonic',
  CUSTOM_KEYS: 'opensea_bot_custom_keys',
  DERIVED_COUNT: 'opensea_bot_derived_count',
  CUSTOM_RPCS: 'opensea_bot_custom_rpcs',
  GAS_CONFIG: 'opensea_bot_gas_config',
  SELECTED_CHAIN: 'opensea_bot_selected_chain',
  LAST_OPENSEA_URL: 'opensea_bot_last_url',
  TARGET_QTY: 'opensea_bot_target_qty',
  ACTIVE_WALLETS_COUNT: 'opensea_bot_active_wallets_count',
  EXECUTION_MODE: 'opensea_bot_execution_mode',
  LATENCY_OFFSET: 'opensea_bot_latency_offset',
};

export const StorageService = {
  // Mnemonic Seed Phrase
  saveMnemonic(mnemonic) {
    if (mnemonic) {
      localStorage.setItem(STORAGE_KEYS.MNEMONIC, mnemonic.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.MNEMONIC);
    }
  },

  getMnemonic() {
    return localStorage.getItem(STORAGE_KEYS.MNEMONIC) || '';
  },

  // Derived HD Wallets Count
  saveDerivedCount(count) {
    localStorage.setItem(STORAGE_KEYS.DERIVED_COUNT, String(count));
  },

  getDerivedCount() {
    const val = localStorage.getItem(STORAGE_KEYS.DERIVED_COUNT);
    return val ? parseInt(val, 10) : 5;
  },

  // Number of active wallets to use for auto-mint
  saveActiveWalletsCount(count) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_WALLETS_COUNT, String(count));
  },

  getActiveWalletsCount() {
    const val = localStorage.getItem(STORAGE_KEYS.ACTIVE_WALLETS_COUNT);
    return val ? parseInt(val, 10) : null;
  },

  // Execution Mode (parallel vs sequential)
  saveExecutionMode(mode) {
    localStorage.setItem(STORAGE_KEYS.EXECUTION_MODE, mode);
  },

  getExecutionMode() {
    return localStorage.getItem(STORAGE_KEYS.EXECUTION_MODE) || 'parallel';
  },

  // Latency offset / Lead time in ms
  saveLatencyOffset(offsetMs) {
    localStorage.setItem(STORAGE_KEYS.LATENCY_OFFSET, String(offsetMs));
  },

  getLatencyOffset() {
    const val = localStorage.getItem(STORAGE_KEYS.LATENCY_OFFSET);
    return val !== null ? parseInt(val, 10) : 15;
  },

  // Manually Imported Custom Private Keys
  saveCustomPrivateKeys(keysArray) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_KEYS, JSON.stringify(keysArray));
  },

  getCustomPrivateKeys() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_KEYS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  // Last OpenSea URL or Contract
  saveLastUrl(url) {
    if (url) localStorage.setItem(STORAGE_KEYS.LAST_OPENSEA_URL, url.trim());
  },

  getLastUrl() {
    return localStorage.getItem(STORAGE_KEYS.LAST_OPENSEA_URL) || '';
  },

  // Target Qty Per Wallet
  saveTargetQty(qty) {
    localStorage.setItem(STORAGE_KEYS.TARGET_QTY, String(qty));
  },

  getTargetQty() {
    const val = localStorage.getItem(STORAGE_KEYS.TARGET_QTY);
    return val ? parseInt(val, 10) : 1;
  },

  // Selected Chain ID
  saveSelectedChain(chainIdOrSlug) {
    localStorage.setItem(STORAGE_KEYS.SELECTED_CHAIN, String(chainIdOrSlug));
  },

  getSelectedChain() {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_CHAIN) || 'ethereum';
  },

  // Custom RPC Endpoints
  saveCustomRpcs(rpcsMap) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_RPCS, JSON.stringify(rpcsMap));
  },

  getCustomRpcs() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_RPCS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  },

  // Gas Speed Preset ('slow', 'normal', 'high')
  saveGasSpeed(speed) {
    localStorage.setItem('opensea_bot_gas_speed', speed);
  },

  getGasSpeed() {
    return localStorage.getItem('opensea_bot_gas_speed') || 'high'; // Default to high for ultra-fast minting
  },

  // Gas configuration
  saveGasConfig(config) {
    localStorage.setItem(STORAGE_KEYS.GAS_CONFIG, JSON.stringify(config));
  },

  getGasConfig() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GAS_CONFIG);
      return data ? JSON.parse(data) : {
        maxFeeGwei: '50',
        maxPriorityFeeGwei: '5.0',
        gasLimit: '250000',
        autoSpeed: 'high',
      };
    } catch (e) {
      return { maxFeeGwei: '50', maxPriorityFeeGwei: '5.0', gasLimit: '250000', autoSpeed: 'high' };
    }
  }
};
