/**
 * Contract classes that are not compiled by this workspace's `yarn codegen`.
 *
 * `PrivateStablecoin` and `TokenBridge` used to be committed wrappers under
 * `artifacts/`, generated from `@defi-wonderland/aztec-standards`. In 5.0.1
 * aztec-standards dropped both contracts: the AIP-20 `Token` is the stablecoin
 * replacement, and `TokenBridge` now ships in `@aztec/noir-contracts.js`.
 */
export { TokenContract as PrivateStablecoinContract } from '@aztec-foundation/aztec-standards/dist/src/artifacts/Token.js';
export { TokenBridgeContract } from '@aztec/noir-contracts.js/TokenBridge';
