/**
 * Updates apps/demo sandbox deployment config with Certificate Registry, Age Check Requirement,
 * and Use Case Example
 * contract addresses. Invoked from repo root after `yarn deploy` (scripts/deploy_contract.ts).
 *
 * Usage: tsx scripts/update-sandbox-deployment.ts <path-to-deployment-json>
 *
 * The JSON file must contain:
 *   certificateRegistryContract: { address: string, salt: string }
 *   ageCheckRequirementContract: { address: string, salt: string }
 *   sanctionListRequirementContract: { address: string, salt: string }
 *   basicDisclosureContract: { address: string, salt: string }
 *   shamirDisclosureContract: { address: string, salt: string }
 *   shamirDisclosureConstructorArgs: {
 *     recipientCount: number
 *     threshold: number
 *     recipients: [string, string, string]
 *     participantAddresses: [string, string, string, string, string]
 *   }
 *   useCaseExampleContract: { address: string, salt: string }
 *   certificateRegistryAdminAddress: string
 *   deployer: string
 *   nodeUrl?: string
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEPLOYMENT_JSON_PATHS = {
  sandbox: path.join(__dirname, '../src/config/deployments/sandbox.json'),
  devnet: path.join(__dirname, '../src/config/deployments/devnet.json'),
} as const;

const NETWORK_NODE_URLS = {
  sandbox: 'http://localhost:8080',
  devnet: 'https://v4-devnet-2.aztec-labs.com/',
} as const;

type DeploymentNetwork = keyof typeof DEPLOYMENT_JSON_PATHS;

export interface DeploymentPayload {
  network?: DeploymentNetwork;
  certificateRegistryContract: { address: string; salt: string };
  ageCheckRequirementContract: { address: string; salt: string };
  sanctionListRequirementContract: { address: string; salt: string };
  basicDisclosureContract: { address: string; salt: string };
  shamirDisclosureContract: { address: string; salt: string };
  shamirDisclosureConstructorArgs: {
    recipientCount: number;
    threshold: number;
    recipients: [string, string, string];
    participantAddresses: [string, string, string, string, string];
  };
  useCaseExampleContract: { address: string; salt: string };
  certificateRegistryAdminAddress: string;
  deployer: string;
  nodeUrl?: string;
}

function main(): void {
  const inputPath = process.argv[2];
  const networkArg = process.argv[3];
  const argNetwork =
    networkArg === 'devnet' || networkArg === 'sandbox'
      ? networkArg
      : undefined;
  if (!inputPath) {
    console.error(
      'Usage: tsx scripts/update-sandbox-deployment.ts <path-to-deployment-json>'
    );
    process.exit(1);
  }

  let payload: DeploymentPayload;
  try {
    const raw = readFileSync(path.resolve(inputPath), 'utf-8');
    payload = JSON.parse(raw) as DeploymentPayload;
  } catch (err) {
    console.error('Failed to read deployment payload:', (err as Error).message);
    process.exit(1);
  }

  const {
    network: payloadNetwork,
    certificateRegistryContract,
    ageCheckRequirementContract,
    sanctionListRequirementContract,
    basicDisclosureContract,
    shamirDisclosureContract,
    shamirDisclosureConstructorArgs,
    useCaseExampleContract,
    certificateRegistryAdminAddress,
    deployer,
    nodeUrl,
  } = payload;
  const network: DeploymentNetwork = payloadNetwork ?? argNetwork ?? 'sandbox';
  const deploymentJsonPath = DEPLOYMENT_JSON_PATHS[network];
  const defaultNodeUrl = NETWORK_NODE_URLS[network];
  if (
    !certificateRegistryContract?.address ||
    !certificateRegistryContract?.salt
  ) {
    console.error(
      'Payload must include certificateRegistryContract.address and .salt'
    );
    process.exit(1);
  }
  if (!useCaseExampleContract?.address || !useCaseExampleContract?.salt) {
    console.error(
      'Payload must include useCaseExampleContract.address and .salt'
    );
    process.exit(1);
  }
  if (
    !ageCheckRequirementContract?.address ||
    !ageCheckRequirementContract?.salt
  ) {
    console.error(
      'Payload must include ageCheckRequirementContract.address and .salt'
    );
    process.exit(1);
  }
  if (
    !sanctionListRequirementContract?.address ||
    !sanctionListRequirementContract?.salt
  ) {
    console.error(
      'Payload must include sanctionListRequirementContract.address and .salt'
    );
    process.exit(1);
  }
  if (!basicDisclosureContract?.address || !basicDisclosureContract?.salt) {
    console.error(
      'Payload must include basicDisclosureContract.address and .salt'
    );
    process.exit(1);
  }
  if (!shamirDisclosureContract?.address || !shamirDisclosureContract?.salt) {
    console.error(
      'Payload must include shamirDisclosureContract.address and .salt'
    );
    process.exit(1);
  }
  if (
    !shamirDisclosureConstructorArgs ||
    !Number.isInteger(shamirDisclosureConstructorArgs.recipientCount) ||
    !Number.isInteger(shamirDisclosureConstructorArgs.threshold) ||
    !Array.isArray(shamirDisclosureConstructorArgs.recipients) ||
    shamirDisclosureConstructorArgs.recipients.length !== 3 ||
    !Array.isArray(shamirDisclosureConstructorArgs.participantAddresses) ||
    shamirDisclosureConstructorArgs.participantAddresses.length !== 5
  ) {
    console.error(
      'Payload must include valid shamirDisclosureConstructorArgs with recipients[3] and participantAddresses[5]'
    );
    process.exit(1);
  }
  if (!certificateRegistryAdminAddress) {
    console.error('Payload must include certificateRegistryAdminAddress');
    process.exit(1);
  }
  if (!deployer) {
    console.error('Payload must include deployer');
    process.exit(1);
  }

  let deployment: Record<string, unknown>;
  try {
    const existing = readFileSync(deploymentJsonPath, 'utf-8');
    deployment = JSON.parse(existing) as Record<string, unknown>;
  } catch {
    deployment = {
      network,
      nodeUrl: nodeUrl ?? defaultNodeUrl,
      dripperContract: { address: '0x00', salt: '0x00' },
      tokenContract: { address: '0x00', salt: '0x00' },
      deployer,
      proverEnabled: network === 'devnet',
      deployedAt: new Date().toISOString(),
    };
  }

  deployment.network = network;
  deployment.certificateRegistryContract = certificateRegistryContract;
  deployment.ageCheckRequirementContract = ageCheckRequirementContract;
  deployment.sanctionListRequirementContract = sanctionListRequirementContract;
  deployment.basicDisclosureContract = basicDisclosureContract;
  deployment.shamirDisclosureContract = shamirDisclosureContract;
  deployment.shamirDisclosureConstructorArgs = shamirDisclosureConstructorArgs;
  deployment.useCaseExampleContract = useCaseExampleContract;
  deployment.certificateRegistryAdminAddress = certificateRegistryAdminAddress;
  deployment.deployer = deployer;
  deployment.nodeUrl = nodeUrl ?? (deployment.nodeUrl as string) ?? defaultNodeUrl;
  deployment.deployedAt = new Date().toISOString();

  writeFileSync(deploymentJsonPath, JSON.stringify(deployment, null, 2));
  console.log(`Updated ${network} deployment:`, deploymentJsonPath);
}

main();
