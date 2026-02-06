import tokenDevnet from '../artifacts/devnet/token_contract-Token.json' with { type: 'json' };
import tokenSandbox from '../artifacts/sandbox/token_contract-Token.json' with { type: 'json' };
import certificateRegistrySandbox from '../../../../target/zk_certificate-CertificateRegistry.json' with { type: 'json' };
import useCaseExampleSandbox from '../../../../target/use_case_example-UseCaseExample.json' with { type: 'json' };
import type { AztecNetwork } from './networks/constants';
import { DEVNET_CONFIG } from './networks/devnet';
import { SANDBOX_CONFIG } from './networks/sandbox';

export type PreconfiguredContract = {
  id: string;
  label: string;
  address: string;
  artifactJson: string;
  network?: AztecNetwork;
};

export const PRECONFIGURED_CONTRACTS: PreconfiguredContract[] = [
  {
    id: 'wonderlands-token-devnet',
    label: 'Wonderlands Token (Devnet)',
    address: DEVNET_CONFIG.tokenContractAddress,
    artifactJson: JSON.stringify(tokenDevnet),
    network: 'devnet',
  },
  {
    id: 'wonderlands-token-sandbox',
    label: 'Wonderlands Token (Sandbox)',
    address: SANDBOX_CONFIG.tokenContractAddress,
    artifactJson: JSON.stringify(tokenSandbox),
    network: 'sandbox',
  },
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
];
