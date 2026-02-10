import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { DripperContract } from '../artifacts/Dripper.js';
import { TokenContract } from '../artifacts/Token.js';
import { CertificateRegistryContract } from '../../../../artifacts/CertificateRegistry';
import { UseCaseExampleContract } from '../../../../artifacts/UseCaseExample';

import {
  createContractConfig,
  getDeployerAddress,
  getTokenConstructorArgs,
} from '../contract-registry';

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
   * Certificate Registry and Use Case Example are deployed by the root script
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

  useCaseExample: {
    artifact: UseCaseExampleContract.artifact,
    contract: UseCaseExampleContract,
    address: (config) => config.useCaseExampleContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.useCaseExampleDeploymentSalt),
      deployer: config.deployerAddress
        ? AztecAddress.fromString(config.deployerAddress)
        : getDeployerAddress(config),
      constructorArgs: [config.certificateRegistryContractAddress],
      constructorArtifact: 'constructor',
    }),
    lazyRegister: true,
  },
});
