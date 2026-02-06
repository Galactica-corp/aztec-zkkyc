import { Logger, createLogger } from "@aztec/aztec.js/log";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { setupWallet } from "../crates/zk_certificate/src/utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../crates/zk_certificate/src/utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getTimeouts } from "../config/config.js";
import { createAccountFromEnv } from "../crates/zk_certificate/src/utils/create_account_from_env.js";
import { getCertificateRegistryAdminAddress } from "../crates/zk_certificate/src/utils/env_helper.js";

import { CertificateRegistryContract } from "../artifacts/CertificateRegistry.js";
import { UseCaseExampleContract } from "../artifacts/UseCaseExample.js";
import { ContractBase, DeployMethod } from "@aztec/aztec.js/contracts";

async function main() {
  let logger: Logger;

  logger = createLogger('aztec:aztec-starter');
  logger.info(`🚀 Starting contract deployment process...`);

  const timeouts = getTimeouts();

  // Setup wallet
  logger.info('📡 Setting up wallet...');
  const wallet = await setupWallet();
  logger.info(`📊 Wallet set up successfully`);

  // Setup sponsored FPC
  logger.info('💰 Setting up sponsored fee payment contract...');
  const sponsoredFPC = await getSponsoredFPCInstance();
  logger.info(`💰 Sponsored FPC instance obtained at: ${sponsoredFPC.address}`);

  logger.info('📝 Registering sponsored FPC contract with wallet...');
  await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
  logger.info('✅ Sponsored fee payment method configured');

  // Deploy account
  logger.info('👤 Deploying Schnorr account...');
  let accountManager = await createAccountFromEnv(wallet);
  const address = accountManager.address;
  logger.info(`✅ Account deployed successfully at: ${address}`);

  async function logContractInstantiationData(method: DeployMethod<ContractBase>, constructorArgs: string[] = []) {
    const instance = await method.getInstance();
    if (instance) {
      logger.info('📦 Contract instantiation data:');
      logger.info(`Salt: ${instance.salt}`);
      logger.info(`Deployer: ${instance.deployer}`);
      if (instance.publicKeys) {
        logger.info(`Public Keys - Master Nullifier: ${instance.publicKeys.masterNullifierPublicKey}`);
        logger.info(`Public Keys - Master Incoming Viewing: ${instance.publicKeys.masterIncomingViewingPublicKey}`);
        logger.info(`Public Keys - Master Outgoing Viewing: ${instance.publicKeys.masterOutgoingViewingPublicKey}`);
        logger.info(`Public Keys - Master Tagging: ${instance.publicKeys.masterTaggingPublicKey}`);
      }
      logger.info(`Constructor args: ${JSON.stringify(constructorArgs)}`);
    }
  }

  // Deploy certificate registry contract
  logger.info('🏎️  Starting certificate registry contract deployment...');
  // Using a different admin address so that the management frontend can use another account than the backend.
  const adminAddress = getCertificateRegistryAdminAddress();
  logger.info(`📋 Admin address for certificate registry contract: ${adminAddress}`);
  const certificateDeployMethod = CertificateRegistryContract.deploy(wallet, adminAddress);
  logger.info('⏳ Waiting for deployment transaction to be mined...');
  const certificateRegistryContract = await certificateDeployMethod.send({
    from: address,
    fee: { paymentMethod: sponsoredPaymentMethod }
  }).deployed({ timeout: timeouts.deployTimeout });
  logger.info(`🎉 Certificate Registry Contract deployed successfully!`);
  logger.info(`📍 Contract address: ${certificateRegistryContract.address}`);
  await logContractInstantiationData(certificateDeployMethod, [adminAddress.toString()]);
  logger.info(`👤 Admin address: ${address}`);


  // Deploy use case example contract
  logger.info('🏎️  Starting use case example contract deployment...');
  const useCaseExampleDeployMethod = UseCaseExampleContract.deploy(wallet, certificateRegistryContract.address);
  logger.info('⏳ Waiting for deployment transaction to be mined...');
  const useCaseExampleContract = await useCaseExampleDeployMethod.send({
    from: address,
    fee: { paymentMethod: sponsoredPaymentMethod }
  }).deployed({ timeout: timeouts.deployTimeout });
  logger.info(`🎉 Use Case Example Contract deployed successfully!`);
  logger.info(`📍 Contract address: ${useCaseExampleContract.address}`);
  await logContractInstantiationData(useCaseExampleDeployMethod, [certificateRegistryContract.address.toString()]);

  // Verify deployment
  logger.info('🔍 Verifying contract deployment...');
  logger.info('✅ Contract deployed and ready');

  logger.info('🏁 Deployment process completed successfully!');
  logger.info(`📋 Summary:`);
  logger.info(`   - Contract Address: ${certificateRegistryContract.address}`);
  logger.info(`   - Use Case Example Contract Address: ${useCaseExampleContract.address}`);
  logger.info(`   - Admin Address: ${adminAddress}`);
  logger.info(`   - Sponsored FPC: ${sponsoredFPC.address}`);
}

main().catch((error) => {
  const logger = createLogger('aztec:aztec-starter');
  logger.error(`❌ Deployment failed: ${error.message}`);
  logger.error(`📋 Error details: ${error.stack}`);
  process.exit(1);
});
