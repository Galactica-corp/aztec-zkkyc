import { Logger, createLogger } from "@aztec/aztec.js/log";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { setupWallet } from "../crates/zk_certificate/src/utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../crates/zk_certificate/src/utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getTimeouts } from "../config/config.js";
import { createAccountFromEnv } from "../crates/zk_certificate/src/utils/create_account_from_env.js";
import { getCertificateRegistryAdminAddress } from "../crates/zk_certificate/src/utils/env_helper.js";

import { CertificateRegistryContract } from "../artifacts/CertificateRegistry.js";
import { AgeCheckRequirementContract } from "../artifacts/AgeCheckRequirement.js";
import { BasicDisclosureContract } from "../artifacts/BasicDisclosure.js";
import { ShamirDisclosureContract } from "../artifacts/ShamirDisclosure.js";
import { UseCaseExampleContract } from "../artifacts/UseCaseExample.js";
import { ContractBase, DeployMethod } from "@aztec/aztec.js/contracts";
import { updateDemoSandboxDeployment } from "./utils/update-demo-sandbox.js";

const AGE_CHECK_MINIMUM_AGE = 18;
const MAX_REQUIREMENT_CHECKERS = 4;
const MAX_DISCLOSURES = 4;
const REQUIREMENT_CHECKER_COUNT = 1;
const DISCLOSURE_COUNT = 2;
const DISCLOSURE_CONTEXT = 777;

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

  // Deploy age check requirement contract
  logger.info('🏎️  Starting age check requirement contract deployment...');
  logger.info(`📋 Minimum required age: ${AGE_CHECK_MINIMUM_AGE}`);
  const ageCheckDeployMethod = AgeCheckRequirementContract.deploy(wallet, AGE_CHECK_MINIMUM_AGE);
  logger.info('⏳ Waiting for deployment transaction to be mined...');
  const ageCheckRequirementContract = await ageCheckDeployMethod.send({
    from: address,
    fee: { paymentMethod: sponsoredPaymentMethod }
  }).deployed({ timeout: timeouts.deployTimeout });
  logger.info(`🎉 Age Check Requirement Contract deployed successfully!`);
  logger.info(`📍 Contract address: ${ageCheckRequirementContract.address}`);
  await logContractInstantiationData(ageCheckDeployMethod, [AGE_CHECK_MINIMUM_AGE.toString()]);

  // Deploy basic disclosure contract
  logger.info("🏎️  Starting basic disclosure contract deployment...");
  const basicDisclosureDeployMethod = BasicDisclosureContract.deploy(wallet, address);
  logger.info("⏳ Waiting for deployment transaction to be mined...");
  const basicDisclosureContract = await basicDisclosureDeployMethod
    .send({
      from: address,
      fee: { paymentMethod: sponsoredPaymentMethod },
    })
    .deployed({ timeout: timeouts.deployTimeout });
  logger.info("🎉 Basic Disclosure Contract deployed successfully!");
  logger.info(`📍 Contract address: ${basicDisclosureContract.address}`);
  await logContractInstantiationData(basicDisclosureDeployMethod, [address.toString()]);

  // Deploy shamir disclosure contract
  logger.info("🏎️  Starting shamir disclosure contract deployment...");
  const shamirDisclosureDeployMethod = ShamirDisclosureContract.deploy(
    wallet,
    address,
    adminAddress,
    ageCheckRequirementContract.address
  );
  logger.info("⏳ Waiting for deployment transaction to be mined...");
  const shamirDisclosureContract = await shamirDisclosureDeployMethod
    .send({
      from: address,
      fee: { paymentMethod: sponsoredPaymentMethod },
    })
    .deployed({ timeout: timeouts.deployTimeout });
  logger.info("🎉 Shamir Disclosure Contract deployed successfully!");
  logger.info(`📍 Contract address: ${shamirDisclosureContract.address}`);
  await logContractInstantiationData(shamirDisclosureDeployMethod, [
    address.toString(),
    adminAddress.toString(),
    ageCheckRequirementContract.address.toString(),
  ]);


  // Deploy use case example contract
  logger.info('🏎️  Starting use case example contract deployment...');
  const useCaseExampleDeployMethod = UseCaseExampleContract.deploy(
    wallet,
    certificateRegistryContract.address,
    Array.from(
      { length: MAX_REQUIREMENT_CHECKERS },
      () => ageCheckRequirementContract.address
    ),
    REQUIREMENT_CHECKER_COUNT,
    Array.from({ length: MAX_DISCLOSURES }, (_, i) =>
      i % 2 === 0 ? basicDisclosureContract.address : shamirDisclosureContract.address
    ),
    DISCLOSURE_COUNT,
    DISCLOSURE_CONTEXT
  );
  logger.info('⏳ Waiting for deployment transaction to be mined...');
  const useCaseExampleContract = await useCaseExampleDeployMethod.send({
    from: address,
    fee: { paymentMethod: sponsoredPaymentMethod }
  }).deployed({ timeout: timeouts.deployTimeout });
  logger.info(`🎉 Use Case Example Contract deployed successfully!`);
  logger.info(`📍 Contract address: ${useCaseExampleContract.address}`);
  await logContractInstantiationData(useCaseExampleDeployMethod, [
    certificateRegistryContract.address.toString(),
    ageCheckRequirementContract.address.toString(),
    basicDisclosureContract.address.toString(),
    shamirDisclosureContract.address.toString(),
  ]);

  // Verify deployment
  logger.info('🔍 Verifying contract deployment...');
  logger.info('✅ Contract deployed and ready');

  logger.info('🏁 Deployment process completed successfully!');
  logger.info(`📋 Summary:`);
  logger.info(`   - Contract Address: ${certificateRegistryContract.address}`);
  logger.info(`   - Age Check Requirement Contract Address: ${ageCheckRequirementContract.address}`);
  logger.info(`   - Basic Disclosure Contract Address: ${basicDisclosureContract.address}`);
  logger.info(`   - Shamir Disclosure Contract Address: ${shamirDisclosureContract.address}`);
  logger.info(`   - Use Case Example Contract Address: ${useCaseExampleContract.address}`);
  logger.info(`   - Admin Address: ${adminAddress}`);
  logger.info(`   - Sponsored FPC: ${sponsoredFPC.address}`);

  // Update demo app sandbox deployment so Settings show these contracts
  const certInstance = await certificateDeployMethod.getInstance();
  const ageCheckInstance = await ageCheckDeployMethod.getInstance();
  const basicDisclosureInstance = await basicDisclosureDeployMethod.getInstance();
  const shamirDisclosureInstance = await shamirDisclosureDeployMethod.getInstance();
  const useCaseInstance = await useCaseExampleDeployMethod.getInstance();
  if (
    certInstance &&
    ageCheckInstance &&
    basicDisclosureInstance &&
    shamirDisclosureInstance &&
    useCaseInstance
  ) {
    updateDemoSandboxDeployment({
      certificateRegistryContract: {
        address: certificateRegistryContract.address.toString(),
        salt: certInstance.salt.toString(),
      },
      ageCheckRequirementContract: {
        address: ageCheckRequirementContract.address.toString(),
        salt: ageCheckInstance.salt.toString(),
      },
      basicDisclosureContract: {
        address: basicDisclosureContract.address.toString(),
        salt: basicDisclosureInstance.salt.toString(),
      },
      shamirDisclosureContract: {
        address: shamirDisclosureContract.address.toString(),
        salt: shamirDisclosureInstance.salt.toString(),
      },
      useCaseExampleContract: {
        address: useCaseExampleContract.address.toString(),
        salt: useCaseInstance.salt.toString(),
      },
      certificateRegistryAdminAddress: adminAddress.toString(),
      deployer: address.toString(),
      nodeUrl: "http://localhost:8080",
      logger,
    });
  }
}

main().catch((error) => {
  const logger = createLogger('aztec:aztec-starter');
  logger.error(`❌ Deployment failed: ${error.message}`);
  logger.error(`📋 Error details: ${error.stack}`);
  process.exit(1);
});
