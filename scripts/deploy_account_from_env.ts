import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { getSponsoredFPCInstance } from "../crates/zk_certificate/src/utils/sponsored_fpc.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { setupWallet } from "../crates/zk_certificate/src/utils/setup_wallet.js";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { createAccountFromEnv } from "../crates/zk_certificate/src/utils/create_account_from_env.js";
import { getTimeouts } from "../config/config.js";

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
  await activeWallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
  logger.info('✅ Sponsored fee payment method configured for account deployment');

  // Deploy account (use config timeouts; devnet first tx can take longer for proving keys)
  const receipt = await deployMethod.send({
    from: AztecAddress.ZERO,
    fee: { paymentMethod: sponsoredPaymentMethod },
    wait: { timeout: getTimeouts().txTimeout, returnReceipt: true },
  });

  try {
    logger.info(`✅ Account deployment transaction successful!`);
    logger.info(`📋 Account address: ${account.address}`);
    logger.info(`📋 Transaction hash: ${receipt.txHash}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Timeout awaiting isMined")) {
      logger.info(
        "Transaction sent but still being mined (normal on devnet). Check status on https://devnet.aztecscan.xyz/"
      );
      logger.info(`📋 Account address: ${account.address}`);
    } else {
      throw err;
    }
  }

  return account;
}

deploySchnorrAccountFromEnv().catch((err: unknown) => {
  console.error("Deploy failed:", err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});