import type { ContractArtifact } from '@aztec/aztec.js/abi';

/**
 * Network-specific artifact overrides.
 *
 * Some networks require pinned artifact versions that match the deployed contracts.
 * Add your contract artifacts here when connecting to networks with pre-deployed contracts.
 *
 * Keys are contract names (matching those in contracts.ts), values are artifacts.
 */
export type NetworkArtifactOverrides = Record<string, ContractArtifact>;

export const DEVNET_ARTIFACTS: NetworkArtifactOverrides = {
};

export const SANDBOX_ARTIFACTS: NetworkArtifactOverrides = {
};

export const getNetworkArtifacts = (
  networkName: string
): NetworkArtifactOverrides | undefined => {
  switch (networkName) {
    case 'devnet':
      return DEVNET_ARTIFACTS;
    case 'sandbox':
      return SANDBOX_ARTIFACTS;
    default:
      return undefined;
  }
};
