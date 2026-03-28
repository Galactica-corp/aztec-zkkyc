import { AztecAddress } from '@aztec/stdlib/aztec-address';
import {
  getDevnetDeployment,
  PLACEHOLDER_ADDRESS,
  PLACEHOLDER_ETH_ADDRESS,
  PLACEHOLDER_SALT,
} from '../deployments';
import { NetworkConfig } from './types';

const ZERO_ADDRESS = AztecAddress.ZERO.toString();
const deployment = getDevnetDeployment();
const certRegistry = deployment.certificateRegistryContract;
const ageCheckRequirement = deployment.ageCheckRequirementContract;
const sanctionListRequirement = deployment.sanctionListRequirementContract;
const basicDisclosure = deployment.basicDisclosureContract;
const shamirDisclosure = deployment.shamirDisclosureContract;
const useCaseExample = deployment.useCaseExampleContract;
const tokenBridge = deployment.tokenBridgeContract;
const privateStablecoin = deployment.privateStablecoinContract;

/**
 * Devnet configuration for public development network.
 *
 * Contract addresses are hardcoded for the public devnet.
 * Certificate Registry and Use Case Example use placeholders unless deployed to devnet.
 */
export const DEVNET_CONFIG: NetworkConfig = {
  name: 'devnet',
  displayName: 'Devnet',
  description: 'Public development network for testing with real tokens',
  nodeUrl: deployment.nodeUrl,
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
  sanctionListRequirementContractAddress:
    sanctionListRequirement?.address ?? PLACEHOLDER_ADDRESS,
  sanctionListRequirementDeploymentSalt:
    sanctionListRequirement?.salt ?? PLACEHOLDER_SALT,
  basicDisclosureContractAddress:
    basicDisclosure?.address ?? PLACEHOLDER_ADDRESS,
  basicDisclosureDeploymentSalt: basicDisclosure?.salt ?? PLACEHOLDER_SALT,
  shamirDisclosureContractAddress:
    shamirDisclosure?.address ?? PLACEHOLDER_ADDRESS,
  shamirDisclosureDeploymentSalt: shamirDisclosure?.salt ?? PLACEHOLDER_SALT,
  shamirDisclosureConstructorArgs: {
    recipientCount:
      deployment.shamirDisclosureConstructorArgs?.recipientCount ?? 0,
    threshold: deployment.shamirDisclosureConstructorArgs?.threshold ?? 0,
    recipients: deployment.shamirDisclosureConstructorArgs?.recipients ?? [
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
    ],
    participantAddresses: deployment.shamirDisclosureConstructorArgs
      ?.participantAddresses ?? [
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
    ],
  },
  useCaseExampleContractAddress: useCaseExample?.address ?? PLACEHOLDER_ADDRESS,
  useCaseExampleDeploymentSalt: useCaseExample?.salt ?? PLACEHOLDER_SALT,
  tokenBridgeContractAddress: tokenBridge?.address ?? PLACEHOLDER_ADDRESS,
  tokenBridgeDeploymentSalt: tokenBridge?.salt ?? PLACEHOLDER_SALT,
  tokenBridgeTokenAddress:
    deployment.tokenBridgeConstructorArgs?.tokenAddress ?? PLACEHOLDER_ADDRESS,
  tokenBridgePortalAddress:
    deployment.tokenBridgeConstructorArgs?.portalAddress ??
    PLACEHOLDER_ETH_ADDRESS,
  privateStablecoinContractAddress:
    privateStablecoin?.address ?? PLACEHOLDER_ADDRESS,
  privateStablecoinDeploymentSalt: privateStablecoin?.salt ?? PLACEHOLDER_SALT,
  privateStablecoinName:
    deployment.privateStablecoinConstructorArgs?.name ?? 'Private Stablecoin',
  privateStablecoinSymbol:
    deployment.privateStablecoinConstructorArgs?.symbol ?? 'STBL',
  privateStablecoinDecimals:
    deployment.privateStablecoinConstructorArgs?.decimals ?? 18,
  privateStablecoinAdminAddress:
    deployment.privateStablecoinConstructorArgs?.adminAddress ??
    PLACEHOLDER_ADDRESS,
  deployerAddress: deployment.deployer,
  dripperDeploymentSalt: deployment.dripperContract.salt,
  tokenDeploymentSalt: deployment.tokenContract.salt,
  proverEnabled: deployment.proverEnabled,
  isTestnet: true,
  feePaymentContracts: {
    metered: {
      address:
        '0x2a39ba8b469adc19bfc0f5c1a9d496f73b82e95fb113e020214c729ff9cd1ff4',
      salt: '1337',
      deployer: AztecAddress.ZERO.toString(),
    },
  },
};
