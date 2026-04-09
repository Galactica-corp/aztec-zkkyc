/**
 * AztecWallet Configuration
 *
 * Simple API - just pass wallet IDs and we handle the rest.
 * Available wallets:
 *   - EVM: 'metamask', 'rabby'
 *   - Aztec: 'azguard'
 */

import { createAztecWalletConfig } from '../aztec-wallet';
import { NETWORK_URLS } from './networks';

/**
 * Main AztecWallet configuration
 *
 * Simple API - just pass wallet IDs:
 * - embedded: true/false
 * - evmWallets: ['metamask', 'rabby', ...]
 * - aztecWallets: ['azguard', ...]
 */
export const aztecWalletConfig = createAztecWalletConfig({
  // Networks
  networks: [
    { name: 'testnet', displayName: 'Testnet', nodeUrl: NETWORK_URLS.testnet },
    { name: 'sandbox', displayName: 'Sandbox', nodeUrl: NETWORK_URLS.sandbox },
  ],
  defaultNetwork: 'testnet',

  // Wallet groups - the single source of truth for which wallets to enable
  walletGroups: {
    embedded: true,
    aztecWallets: ['azguard'],
    evmWallets: ['metamask', 'rabby'],
  },

  // Show network picker in header ('full' | 'compact' | undefined)
  showNetworkPicker: 'full',

  // Modal customization (optional)
  modal: {
    title: 'Connect Wallet',
  },
});
