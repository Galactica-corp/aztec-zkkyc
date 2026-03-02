
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import configManager, { getAztecNodeUrl, getEnv } from '../../../../config/config.js';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { registerInitialLocalNetworkAccountsInWallet } from '@aztec/wallets/testing';

interface SetupWalletOptions {
  ephemeral?: boolean;
  registerInitialAccounts?: boolean;
}

export async function setupWallet(options: SetupWalletOptions = {}): Promise<EmbeddedWallet> {
  const nodeUrl = getAztecNodeUrl();
  const node = createAztecNodeClient(nodeUrl);
  const wallet = await EmbeddedWallet.create(node, {
    ephemeral: options.ephemeral ?? false,
    pxeConfig: { proverEnabled: configManager.isDevnet() },
  });
  if (getEnv() === 'local-network' && options.registerInitialAccounts !== false) {
    await registerInitialLocalNetworkAccountsInWallet(wallet);
  }
  return wallet;
}
