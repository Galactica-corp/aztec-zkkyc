/**
 * Deployment configuration types for Aztec contracts
 */

import { NETWORK_URLS, type NetworkType } from '../networks/constants';

/**
 * Contract deployment information
 */
export interface ContractDeployment {
  address: string;
  salt: string;
}

/**
 * Full deployment configuration for a network.
 * certificateRegistryContract and useCaseExampleContract are populated by scripts/deploy_contract.ts (root).
 */
export interface DeploymentConfig {
  network: NetworkType;
  nodeUrl: string;
  dripperContract: ContractDeployment;
  tokenContract: ContractDeployment;
  /** Set by root yarn deploy (scripts/deploy_contract.ts) */
  certificateRegistryContract?: ContractDeployment;
  /** Set by root yarn deploy (scripts/deploy_contract.ts) */
  useCaseExampleContract?: ContractDeployment;
  deployer: string;
  proverEnabled: boolean;
  deployedAt: string;
}

/**
 * Placeholder values for undeployed contracts
 */
export const PLACEHOLDER_ADDRESS =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
export const PLACEHOLDER_SALT =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Check if a deployment config has valid (non-placeholder) contract addresses
 */
export const isDeploymentValid = (config: DeploymentConfig): boolean => {
  return (
    config.dripperContract.address !== PLACEHOLDER_ADDRESS &&
    config.tokenContract.address !== PLACEHOLDER_ADDRESS &&
    config.deployer !== PLACEHOLDER_ADDRESS
  );
};

/**
 * Default sandbox deployment config (placeholder until contracts are deployed).
 * Run `yarn deploy` from repo root to deploy Certificate Registry + Use Case Example and update this file.
 */
export const DEFAULT_SANDBOX_DEPLOYMENT: DeploymentConfig = {
  network: 'sandbox',
  nodeUrl: NETWORK_URLS.sandbox,
  dripperContract: {
    address: PLACEHOLDER_ADDRESS,
    salt: PLACEHOLDER_SALT,
  },
  tokenContract: {
    address: PLACEHOLDER_ADDRESS,
    salt: PLACEHOLDER_SALT,
  },
  certificateRegistryContract: {
    address: PLACEHOLDER_ADDRESS,
    salt: PLACEHOLDER_SALT,
  },
  useCaseExampleContract: {
    address: PLACEHOLDER_ADDRESS,
    salt: PLACEHOLDER_SALT,
  },
  deployer: PLACEHOLDER_ADDRESS,
  proverEnabled: false,
  deployedAt: '',
};

/**
 * Default devnet deployment config (placeholder until contracts are deployed)
 */
export const DEFAULT_DEVNET_DEPLOYMENT: DeploymentConfig = {
  network: 'devnet',
  nodeUrl: NETWORK_URLS.devnet,
  dripperContract: {
    address: PLACEHOLDER_ADDRESS,
    salt: PLACEHOLDER_SALT,
  },
  tokenContract: {
    address: PLACEHOLDER_ADDRESS,
    salt: PLACEHOLDER_SALT,
  },
  certificateRegistryContract: {
    address: PLACEHOLDER_ADDRESS,
    salt: PLACEHOLDER_SALT,
  },
  useCaseExampleContract: {
    address: PLACEHOLDER_ADDRESS,
    salt: PLACEHOLDER_SALT,
  },
  deployer: PLACEHOLDER_ADDRESS,
  proverEnabled: true,
  deployedAt: '',
};
