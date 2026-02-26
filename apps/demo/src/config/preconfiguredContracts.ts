import ageCheckRequirementSandbox from '../../../../target/age_check_requirement-AgeCheckRequirement.json' with { type: 'json' };
import useCaseExampleSandbox from '../../../../target/use_case_example-UseCaseExample.json' with { type: 'json' };
import certificateRegistrySandbox from '../../../../target/zk_certificate-CertificateRegistry.json' with { type: 'json' };
import { DEVNET_CONFIG } from './networks/devnet';
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
];
