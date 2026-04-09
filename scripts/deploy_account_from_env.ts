import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { getSponsoredFPCInstance } from "../crates/zk_certificate/src/utils/sponsored_fpc.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { setupWallet } from "../crates/zk_certificate/src/utils/setup_wallet.js";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { NO_FROM } from "@aztec/aztec.js/account";
import { ContractInitializationStatus } from "@aztec/aztec.js/wallet";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { createAccountFromEnv } from "../crates/zk_certificate/src/utils/create_account_from_env.js";
import { getTimeouts } from "../config/config.js";

/** True when the node rejects a deploy because the account instance was already published (duplicate nullifier). */
function isAlreadyDeployedChainError(err: unknown): boolean {
  const collect = (e: unknown): string[] => {
    if (e instanceof Error) {
      const parts = [e.message];
      const c = (e as Error & { cause?: unknown }).cause;
      if (c !== undefined) parts.push(...collect(c));
      return parts;
    }
    if (e && typeof e === "object" && "message" in e) {
      return [String((e as { message: unknown }).message)];
    }
    return [];
  };
  return collect(err).some(
    (m) => m.includes("Existing nullifier") || m.includes("existing nullifier")
  );
}

export async function deploySchnorrAccountFromEnv(wallet?: EmbeddedWallet): Promise<AccountManager> {
  let logger: Logger;
  logger = createLogger('aztec:aztec-starter');
  logger.info('👤 Starting Schnorr account deployment...');

  const activeWallet = wallet ?? await setupWallet();
  const account = await createAccountFromEnv(activeWallet);
  logger.info(`📍 Account address will be: ${account.address}`);

  const metadata = await activeWallet.getContractMetadata(account.address);
  if (metadata.initializationStatus === ContractInitializationStatus.INITIALIZED) {
    logger.info('✅ Account contract is already deployed on chain; skipping deployment.');
    return account;
  }

  const deployMethod = await account.getDeployMethod();

  // Setup sponsored FPC
  logger.info('💰 Setting up sponsored fee payment for account deployment...');
  const sponsoredFPC = await getSponsoredFPCInstance();
  logger.info(`💰 Sponsored FPC instance obtained at: ${sponsoredFPC.address}`);

  logger.info('📝 Registering sponsored FPC contract with PXE...');
  await activeWallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
  logger.info('✅ Sponsored fee payment method configured for account deployment');

  try {
    // Deploy account (use config timeouts; public testnet first tx can take longer for proving keys)
    const deployTx = await deployMethod.send({
      from: NO_FROM,
      fee: { paymentMethod: sponsoredPaymentMethod },
      wait: { timeout: getTimeouts().txTimeout },
    });

    logger.info(`✅ Account deployment transaction successful!`);
    logger.info(`📋 Account address: ${account.address}`);
    logger.info(`📋 Transaction hash: ${deployTx.receipt.txHash}`);
  } catch (err: unknown) {
    if (isAlreadyDeployedChainError(err)) {
      logger.info(
        '✅ Account appears already deployed on chain (duplicate nullifier); treating as success.'
      );
      logger.info(`📋 Account address: ${account.address}`);
      return account;
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Timeout awaiting isMined")) {
      logger.info(
        "Transaction sent but still being mined (normal on testnet). Check status on https://testnet.aztecscan.xyz/"
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