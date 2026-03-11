# Guardian Aztec Connect

This subpackage provides guardians with the service and infrastructure to issue zero-knowledge certificates, such as ZK KYC. It works as an SDK that can be imported in JavaScript or TypeScript applications. There are also CLI tools for manual testing.

## Features

- **Issue certificates** — Create and issue zero-knowledge certificates to users.
- **Revoke certificates** — Revoke previously issued certificates when needed.
- **View whitelist status** — Check whitelist and certificate status for addresses or identities.
- **Aztec smart contract interactions** — Handle wallet management, transaction building, and submission for Aztec-specific contracts.

## Installation

### From published package
```bash
yarn add @galactica-net/guardian-aztec-connect
```

### From source:
```bash
# From repository root (workspace)
yarn install

# Or install this package as a dependency
# yarn add guardian-aztec-connect
```

## Testing

```bash
# From repository root
yarn test

# Or from this directory
yarn test
yarn test:unit
yarn test:integration
```

## Running

This package currently implements the wallet setup slice:

- load a guardian Schnorr account from `SECRET`, `SIGNING_KEY`, and `SALT`
- resolve the Aztec network via `AZTEC_ENV`
- query whether the guardian account contract is deployed
- check whether the guardian address is whitelisted in the certificate registry
- deploy the guardian account if needed

`AZTEC_ENV` follows the repository-wide `config/<env>.json` convention. Use `local-network` by default or set `AZTEC_ENV=devnet`.

Create a local `.env` file from `.env.example` before running the SDK or CLI. Set `CERTIFICATE_REGISTRY_ADDRESS` to enable whitelist checks against the certificate registry. For contracts deployed outside the current PXE, also provide `CERTIFICATE_REGISTRY_DEPLOYMENT_SALT`, `CERTIFICATE_REGISTRY_ADMIN_ADDRESS`, and optionally `CERTIFICATE_REGISTRY_DEPLOYER_ADDRESS` so the client can reconstruct and register the contract instance before reading the whitelist. If the registry still cannot be reached, the account status call succeeds and reports the whitelist status as unavailable.

```bash
# Check the guardian account status
yarn cli -- account status

# Deploy the guardian account if needed
yarn cli -- account deploy

# Select a network explicitly
yarn cli -- account status --network devnet

# Print JSON for scripting
yarn cli -- account status --json
```

## SDK Usage

```ts
import {
    deployGuardianAccountIfNeeded,
    getGuardianAccountStatus,
} from "@galactica-net/guardian-aztec-connect";

const status = await getGuardianAccountStatus({
    aztecEnv: "local-network",
});

console.log(status.isWhitelisted);
console.log(status.whitelistStatusError);

const deployed = await deployGuardianAccountIfNeeded({
    aztecEnv: "local-network",
});
```
