import { create } from 'zustand';
import {
  SANDBOX_CONFIG,
  TESTNET_CONFIG,
  type NetworkConfig,
} from '../../../config/networks';
import { getContractRegistryStore } from '../../../store/contractRegistry';
import { isValidConfig } from '../../../utils';
import { getWalletStore } from '../wallet';
import type { AztecNetwork } from '../../../config/networks/constants';
import type { StoreNetworkPreset } from '../../types';

const STORAGE_KEY = 'aztec-wallet-network';

const BASE_CONFIGS: Record<AztecNetwork, NetworkConfig> = {
  sandbox: SANDBOX_CONFIG,
  testnet: TESTNET_CONFIG,
};

/** Maps legacy persisted network id from the old `devnet` name. */
function migrateStoredNetworkName(name: string | null): AztecNetwork | null {
  if (!name) {
    return null;
  }
  if (name === 'devnet') {
    return 'testnet';
  }
  return name as AztecNetwork;
}

type State = {
  currentConfig: NetworkConfig;
  configuredNetworks: Record<AztecNetwork, NetworkConfig>;
  defaultNetwork: AztecNetwork;
  isInitialized: boolean;
};

type Actions = {
  initialize: (presets: StoreNetworkPreset[]) => void;
  switchToNetwork: (name: AztecNetwork) => boolean;
  resetToDefault: () => void;
  syncFromStorage: () => void;
};

export type NetworkStore = State & Actions;

const INITIAL_STATE: State = {
  currentConfig: TESTNET_CONFIG,
  configuredNetworks: {} as Record<AztecNetwork, NetworkConfig>,
  defaultNetwork: 'testnet',
  isInitialized: false,
};

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  ...INITIAL_STATE,

  initialize: (presets) => {
    const configuredNetworks: Record<AztecNetwork, NetworkConfig> =
      {} as Record<AztecNetwork, NetworkConfig>;
    for (const preset of presets) {
      const base = BASE_CONFIGS[preset.aztecNetwork];
      if (base) {
        configuredNetworks[preset.aztecNetwork] = {
          ...base,
          nodeUrl: preset.nodeUrl,
        };
      }
    }

    const defaultNetwork = presets[0]?.aztecNetwork ?? 'sandbox';
    const defaultConfig = configuredNetworks[defaultNetwork] ?? SANDBOX_CONFIG;

    const rawSaved = localStorage.getItem(STORAGE_KEY);
    const savedNetwork = migrateStoredNetworkName(rawSaved);
    if (rawSaved === 'devnet' && savedNetwork === 'testnet') {
      localStorage.setItem(STORAGE_KEY, 'testnet');
    }
    const initialConfig =
      savedNetwork && configuredNetworks[savedNetwork]
        ? configuredNetworks[savedNetwork]
        : defaultConfig;

    set({
      configuredNetworks,
      defaultNetwork,
      currentConfig: initialConfig,
      isInitialized: true,
    });

    setupCrossTabSync();
  },

  switchToNetwork: (name) => {
    const { configuredNetworks, currentConfig } = get();
    const config = configuredNetworks[name as AztecNetwork];
    if (config && config.name !== currentConfig.name) {
      getContractRegistryStore().reset();
      getWalletStore().setPXEStatus('idle');
      set({ currentConfig: config });
      localStorage.setItem(STORAGE_KEY, name);
      return true;
    }
    return false;
  },

  resetToDefault: () => {
    const { defaultNetwork, configuredNetworks, currentConfig } = get();
    const defaultConfig = configuredNetworks[defaultNetwork] ?? SANDBOX_CONFIG;
    if (defaultConfig.name !== currentConfig.name) {
      getContractRegistryStore().reset();
      getWalletStore().setPXEStatus('idle');
    }
    localStorage.setItem(STORAGE_KEY, defaultNetwork);
    set({ currentConfig: defaultConfig });
  },

  syncFromStorage: () => {
    const { configuredNetworks, currentConfig } = get();
    const rawSaved = localStorage.getItem(STORAGE_KEY);
    const savedNetwork = migrateStoredNetworkName(rawSaved);
    if (rawSaved === 'devnet' && savedNetwork === 'testnet') {
      localStorage.setItem(STORAGE_KEY, 'testnet');
    }
    if (savedNetwork && configuredNetworks[savedNetwork]) {
      const newConfig = configuredNetworks[savedNetwork];
      if (newConfig.name !== currentConfig.name) {
        getContractRegistryStore().reset();
        getWalletStore().setPXEStatus('idle');
      }
      set({ currentConfig: newConfig });
    }
  },
}));

export const getNetworkStore = () => useNetworkStore.getState();

let isListenerSetup = false;
function setupCrossTabSync() {
  if (isListenerSetup) return;
  isListenerSetup = true;

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      getNetworkStore().syncFromStorage();
    }
  });
}

/**
 * Get network options for UI dropdowns.
 * @param configuredNetworks - The configured networks from store
 * @param presets - The original network presets
 */
export const buildNetworkOptions = (
  configuredNetworks: Record<AztecNetwork, NetworkConfig>,
  presets: StoreNetworkPreset[]
) => {
  return presets.map((preset) => {
    const config = configuredNetworks[preset.aztecNetwork];
    return {
      value: preset.aztecNetwork,
      label: config?.displayName ?? preset.aztecNetwork,
      description: config?.description ?? '',
      disabled: !config || !isValidConfig(config),
    };
  });
};
