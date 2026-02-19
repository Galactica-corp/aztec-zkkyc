import { getEnv } from '../../utils/env';
import {
  getSandboxDeployment,
  isDeploymentValid,
  PLACEHOLDER_ADDRESS,
  PLACEHOLDER_SALT,
} from '../deployments';
import { NetworkConfig } from './types';

const env = getEnv();

/**
 * Load sandbox deployment from JSON config file.
 * Environment variables can override nodeUrl and proverEnabled.
 * Certificate Registry, Age Check Requirement, and Use Case Example are set by
 * root `yarn deploy` (scripts/deploy_contract.ts).
 */
const deployment = getSandboxDeployment();

const certRegistry = deployment.certificateRegistryContract;
const ageCheckRequirement = deployment.ageCheckRequirementContract;
const basicDisclosure = deployment.basicDisclosureContract;
const shamirDisclosure = deployment.shamirDisclosureContract;
const useCaseExample = deployment.useCaseExampleContract;

/**
 * Sandbox configuration for local development.
 *
 * Contract addresses are loaded from src/config/deployments/sandbox.json
 * - Token/Dripper: run `yarn deploy-contracts` from apps/demo
 * - Certificate Registry + Age Check Requirement + Use Case Example: run `yarn deploy` from repo root
 */
export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Sandbox',
  description: isDeploymentValid(deployment)
    ? 'Local development environment with deployed contracts'
    : 'Local sandbox - run "yarn deploy" (root) or "yarn deploy-contracts" (demo) to deploy',
  nodeUrl: env.aztecNodeUrl || deployment.nodeUrl,
  dripperContractAddress: deployment.dripperContract.address,
  tokenContractAddress: deployment.tokenContract.address,
  certificateRegistryContractAddress:
    certRegistry?.address ?? PLACEHOLDER_ADDRESS,
  certificateRegistryDeploymentSalt: certRegistry?.salt ?? PLACEHOLDER_SALT,
  certificateRegistryAdminAddress:
    deployment.certificateRegistryAdminAddress ?? PLACEHOLDER_ADDRESS,
  ageCheckRequirementContractAddress:
    ageCheckRequirement?.address ?? PLACEHOLDER_ADDRESS,
  ageCheckRequirementDeploymentSalt:
    ageCheckRequirement?.salt ?? PLACEHOLDER_SALT,
  basicDisclosureContractAddress: basicDisclosure?.address ?? PLACEHOLDER_ADDRESS,
  basicDisclosureDeploymentSalt: basicDisclosure?.salt ?? PLACEHOLDER_SALT,
  shamirDisclosureContractAddress: shamirDisclosure?.address ?? PLACEHOLDER_ADDRESS,
  shamirDisclosureDeploymentSalt: shamirDisclosure?.salt ?? PLACEHOLDER_SALT,
  useCaseExampleContractAddress: useCaseExample?.address ?? PLACEHOLDER_ADDRESS,
  useCaseExampleDeploymentSalt: useCaseExample?.salt ?? PLACEHOLDER_SALT,
  deployerAddress: deployment.deployer,
  dripperDeploymentSalt: deployment.dripperContract.salt,
  tokenDeploymentSalt: deployment.tokenContract.salt,
  proverEnabled: env.proverEnabled,
  isTestnet: false,
};
