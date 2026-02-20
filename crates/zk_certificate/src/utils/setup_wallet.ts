
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { getAztecNodeUrl, getEnv } from '../../../../config/config.js';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { registerInitialLocalNetworkAccountsInWallet } from '@aztec/wallets/testing';

export async function setupWallet(): Promise<EmbeddedWallet> {
  const nodeUrl = getAztecNodeUrl();
  const node = createAztecNodeClient(nodeUrl);
  const wallet = await EmbeddedWallet.create(node);
  if (getEnv() === 'local-network') {
    await registerInitialLocalNetworkAccountsInWallet(wallet);
  }
  return wallet
}
