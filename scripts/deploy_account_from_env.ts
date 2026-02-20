import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { getSponsoredFPCInstance } from "../crates/zk_certificate/src/utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { setupWallet } from "../crates/zk_certificate/src/utils/setup_wallet.js";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { createAccountFromEnv } from "../crates/zk_certificate/src/utils/create_account_from_env.js";

export async function deploySchnorrAccountFromEnv(wallet?: EmbeddedWallet): Promise<AccountManager> {
  let logger: Logger;
  logger = createLogger('aztec:aztec-starter');
  logger.info('👤 Starting Schnorr account deployment...');

  const activeWallet = wallet ?? await setupWallet();
  const account = await createAccountFromEnv(activeWallet);
  logger.info(`📍 Account address will be: ${account.address}`);

  const deployMethod = await account.getDeployMethod();

  // Setup sponsored FPC
  logger.info('💰 Setting up sponsored fee payment for account deployment...');
  const sponsoredFPC = await getSponsoredFPCInstance();
  logger.info(`💰 Sponsored FPC instance obtained at: ${sponsoredFPC.address}`);

  logger.info('📝 Registering sponsored FPC contract with PXE...');
  await activeWallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
  logger.info('✅ Sponsored fee payment method configured for account deployment');

  // Deploy account
  const tx = await deployMethod.send({
    from: AztecAddress.ZERO,
    fee: { paymentMethod: sponsoredPaymentMethod },
  }).wait({ timeout: 120000 });

  logger.info(`✅ Account deployment transaction successful!`);
  logger.info(`📋 Transaction hash: ${tx.txHash}`);

  return account;
}

deploySchnorrAccountFromEnv();