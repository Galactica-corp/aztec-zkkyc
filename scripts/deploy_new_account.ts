import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { getSponsoredFPCInstance } from "../crates/zk_certificate/src/utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { setupWallet } from "../crates/zk_certificate/src/utils/setup_wallet.js";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { NO_FROM } from "@aztec/aztec.js/account";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { getTimeouts } from "../config/config.js";

export async function deploySchnorrAccount(wallet?: EmbeddedWallet): Promise<AccountManager> {
  let logger: Logger;
  logger = createLogger('aztec:aztec-starter');
  logger.info('👤 Starting Schnorr account deployment...');

  // Generate account keys
  logger.info('🔐 Generating account keys...');
  let secretKey = Fr.random();
  let signingKey = GrumpkinScalar.random();
  let salt = Fr.random();
  logger.info(`Save the following SECRET and SALT in .env for future use.`);
  logger.info(`🔑 Secret key generated: ${secretKey.toString()}`);
  logger.info(`🖊️ Signing key generated: ${signingKey.toString()}`);
  logger.info(`🧂 Salt generated: ${salt.toString()}`);

  const activeWallet = wallet ?? await setupWallet()
  const account = await activeWallet.createSchnorrAccount(secretKey, salt, signingKey)
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
    from: NO_FROM,
    fee: { paymentMethod: sponsoredPaymentMethod },
    wait: { timeout: getTimeouts().txTimeout },
  });

  logger.info(`✅ Account deployment transaction successful!`);
  logger.info(`📋 Transaction hash: ${tx.receipt.txHash}`);

  return account;
}

deploySchnorrAccount();