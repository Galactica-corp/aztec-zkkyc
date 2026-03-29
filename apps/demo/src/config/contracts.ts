import { AztecAddress, EthAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { AgeCheckRequirementContract } from '../../../../artifacts/AgeCheckRequirement';
import { BasicDisclosureContract } from '../../../../artifacts/BasicDisclosure';
import { CertificateRegistryContract } from '../../../../artifacts/CertificateRegistry';
import { PrivateStablecoinContract } from '../../../../artifacts/PrivateStablecoin';
import { SanctionListRequirementContract } from '../../../../artifacts/SanctionListRequirement';
import { TokenBridgeContract } from '../../../../artifacts/TokenBridge';
import { UseCaseExampleContract } from '../../../../artifacts/UseCaseExample';
import { createContractConfig, getDeployerAddress } from '../contract-registry';

const DISCLOSURE_CONTEXT = 777;

/**
 * Edit this file to add/remove contracts for your application.
 *
 * By default, all contracts are registered at initialization.
 * Set `lazyRegister: true` on a contract to only register it on-demand.
 */
export const contractsConfig = createContractConfig({
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

  basicDisclosure: {
    artifact: BasicDisclosureContract.artifact,
    contract: BasicDisclosureContract,
    address: (config) => config.basicDisclosureContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.basicDisclosureDeploymentSalt),
      deployer: config.deployerAddress
        ? AztecAddress.fromString(config.deployerAddress)
        : getDeployerAddress(config),
      constructorArgs: [
        AztecAddress.fromString(config.certificateRegistryAdminAddress),
      ],
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

  sanctionListRequirement: {
    artifact: SanctionListRequirementContract.artifact,
    contract: SanctionListRequirementContract,
    address: (config) => config.sanctionListRequirementContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.sanctionListRequirementDeploymentSalt),
      deployer: config.deployerAddress
        ? AztecAddress.fromString(config.deployerAddress)
        : getDeployerAddress(config),
      constructorArgs: [
        AztecAddress.fromString(config.certificateRegistryAdminAddress),
      ],
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
        config.ageCheckRequirementContractAddress,
        config.basicDisclosureContractAddress,
        DISCLOSURE_CONTEXT,
      ],
      constructorArtifact: 'constructor',
    }),
    lazyRegister: true,
  },

  /**
   * Bridge and private stablecoin are deployed like Certificate Registry (real
   * deployer in sandbox.json), not universal deploy (ZERO deployer). Use
   * deployerAddress when present so getContractInstanceFromInstantiationParams
   * matches the address recorded in deployments/*.json.
   */
  tokenBridge: {
    artifact: TokenBridgeContract.artifact,
    contract: TokenBridgeContract,
    address: (config) => config.tokenBridgeContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.tokenBridgeDeploymentSalt),
      deployer: config.deployerAddress
        ? AztecAddress.fromString(config.deployerAddress)
        : getDeployerAddress(config),
      constructorArgs: [
        AztecAddress.fromString(config.tokenBridgeTokenAddress),
        EthAddress.fromString(config.tokenBridgePortalAddress),
      ],
      constructorArtifact: 'constructor',
    }),
    lazyRegister: true,
  },

  privateStablecoin: {
    artifact: PrivateStablecoinContract.artifact,
    contract: PrivateStablecoinContract,
    address: (config) => config.privateStablecoinContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.privateStablecoinDeploymentSalt),
      deployer: config.deployerAddress
        ? AztecAddress.fromString(config.deployerAddress)
        : getDeployerAddress(config),
      constructorArgs: [
        config.privateStablecoinName,
        config.privateStablecoinSymbol,
        config.privateStablecoinDecimals,
        AztecAddress.fromString(config.privateStablecoinAdminAddress),
      ],
      constructorArtifact: 'constructor_with_minter',
    }),
    lazyRegister: true,
  },
});
