import { PrivateStablecoinContract } from '../../../../artifacts/PrivateStablecoin';
import { TokenBridgeContract } from '../../../../artifacts/TokenBridge';
import ageCheckRequirementSandbox from '../../../../target/age_check_requirement-AgeCheckRequirement.json' with { type: 'json' };
import useCaseExampleSandbox from '../../../../target/use_case_example-UseCaseExample.json' with { type: 'json' };
import certificateRegistrySandbox from '../../../../target/zk_certificate-CertificateRegistry.json' with { type: 'json' };
import { TESTNET_CONFIG } from './networks/testnet';
import { SANDBOX_CONFIG } from './networks/sandbox';
import type { AztecNetwork } from './networks/constants';

export type PreconfiguredContract = {
  id: string;
  label: string;
  address: string;
  artifactJson: string;
  network?: AztecNetwork;
};

export const PRECONFIGURED_CONTRACTS: PreconfiguredContract[] = [
  {
    id: 'certificate-registry-sandbox',
    label: 'Certificate Registry (Sandbox)',
    address: SANDBOX_CONFIG.certificateRegistryContractAddress,
    artifactJson: JSON.stringify(certificateRegistrySandbox),
    network: 'sandbox',
  },
  {
    id: 'use-case-example-sandbox',
    label: 'Use Case Example (Sandbox)',
    address: SANDBOX_CONFIG.useCaseExampleContractAddress,
    artifactJson: JSON.stringify(useCaseExampleSandbox),
    network: 'sandbox',
  },
  {
    id: 'age-check-requirement-sandbox',
    label: 'Age Check Requirement (Sandbox)',
    address: SANDBOX_CONFIG.ageCheckRequirementContractAddress,
    artifactJson: JSON.stringify(ageCheckRequirementSandbox),
    network: 'sandbox',
  },
  {
    id: 'token-bridge-sandbox',
    label: 'Token Bridge (Sandbox)',
    address: SANDBOX_CONFIG.tokenBridgeContractAddress,
    artifactJson: JSON.stringify(TokenBridgeContract.artifact),
    network: 'sandbox',
  },
  {
    id: 'private-stablecoin-sandbox',
    label: 'Private Stablecoin (Sandbox)',
    address: SANDBOX_CONFIG.privateStablecoinContractAddress,
    artifactJson: JSON.stringify(PrivateStablecoinContract.artifact),
    network: 'sandbox',
  },
  {
    id: 'token-bridge-testnet',
    label: 'Token Bridge (Testnet)',
    address: TESTNET_CONFIG.tokenBridgeContractAddress,
    artifactJson: JSON.stringify(TokenBridgeContract.artifact),
    network: 'testnet',
  },
  {
    id: 'private-stablecoin-testnet',
    label: 'Private Stablecoin (Testnet)',
    address: TESTNET_CONFIG.privateStablecoinContractAddress,
    artifactJson: JSON.stringify(PrivateStablecoinContract.artifact),
    network: 'testnet',
  },
];
