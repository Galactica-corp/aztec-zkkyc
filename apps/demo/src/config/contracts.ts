import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { AgeCheckRequirementContract } from '../../../../artifacts/AgeCheckRequirement';
import { CertificateRegistryContract } from '../../../../artifacts/CertificateRegistry';
import { UseCaseExampleContract } from '../../../../artifacts/UseCaseExample';
import { DripperContract } from '../artifacts/Dripper.js';
import { TokenContract } from '../artifacts/Token.js';
import {
  createContractConfig,
  getDeployerAddress,
  getTokenConstructorArgs,
} from '../contract-registry';

const MAX_REQUIREMENT_CHECKERS = 4;
const MAX_DISCLOSURES = 4;
const REQUIREMENT_CHECKER_COUNT = 1;
const DISCLOSURE_COUNT = 2;
const DISCLOSURE_CONTEXT = 777;

/**
 * Edit this file to add/remove contracts for your application.
 *
 * By default, all contracts are registered at initialization.
 * Set `lazyRegister: true` on a contract to only register it on-demand.
 */
export const contractsConfig = createContractConfig({
  /**
   * Dripper contract - Mints tokens to users
   */
  dripper: {
    artifact: DripperContract.artifact,
    contract: DripperContract,
    address: (config) => config.dripperContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.dripperDeploymentSalt),
      deployer: getDeployerAddress(config),
      constructorArgs: [],
      constructorArtifact: 'constructor',
    }),
    lazyRegister: true,
  },

  /**
   * Token contract - Yield Token (YT)
   */
  token: {
    artifact: TokenContract.artifact,
    contract: TokenContract,
    address: (config) => config.tokenContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.tokenDeploymentSalt),
      deployer: getDeployerAddress(config),
      constructorArgs: [...getTokenConstructorArgs(config)],
      constructorArtifact: 'constructor_with_minter',
    }),
    lazyRegister: true,
  },

  /**
   * Certificate Registry, Age Check Requirement, and Use Case Example are deployed by the root script
   * (scripts/deploy_contract.ts) with a real deployer account, not universal deploy.
   * So we must use config.deployerAddress for instantiation params to match the
   * deployed addresses. getDeployerAddress(config) returns ZERO for sandbox (used
   * for Dripper/Token which use universal deploy from the demo deploy script).
   */
  certificateRegistry: {
    artifact: CertificateRegistryContract.artifact,
    contract: CertificateRegistryContract,
    address: (config) => config.certificateRegistryContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.certificateRegistryDeploymentSalt),
      deployer: config.deployerAddress
        ? AztecAddress.fromString(config.deployerAddress)
        : getDeployerAddress(config),
      constructorArgs: [config.certificateRegistryAdminAddress],
      constructorArtifact: 'constructor',
    }),
  },

  ageCheckRequirement: {
    artifact: AgeCheckRequirementContract.artifact,
    contract: AgeCheckRequirementContract,
    address: (config) => config.ageCheckRequirementContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.ageCheckRequirementDeploymentSalt),
      deployer: config.deployerAddress
        ? AztecAddress.fromString(config.deployerAddress)
        : getDeployerAddress(config),
      constructorArgs: [18],
      constructorArtifact: 'constructor',
    }),
    lazyRegister: true,
  },

  useCaseExample: {
    artifact: UseCaseExampleContract.artifact,
    contract: UseCaseExampleContract,
    address: (config) => config.useCaseExampleContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.useCaseExampleDeploymentSalt),
      deployer: config.deployerAddress
        ? AztecAddress.fromString(config.deployerAddress)
        : getDeployerAddress(config),
      constructorArgs: [
        config.certificateRegistryContractAddress,
        Array.from(
          { length: MAX_REQUIREMENT_CHECKERS },
          () => config.ageCheckRequirementContractAddress
        ),
        REQUIREMENT_CHECKER_COUNT,
        Array.from({ length: MAX_DISCLOSURES }, (_, i) =>
          i % 2 === 0
            ? config.basicDisclosureContractAddress
            : config.shamirDisclosureContractAddress
        ),
        DISCLOSURE_COUNT,
        DISCLOSURE_CONTEXT,
      ],
      constructorArtifact: 'constructor',
    }),
    lazyRegister: true,
  },
});
