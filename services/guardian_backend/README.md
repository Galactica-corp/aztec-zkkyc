# Aztec Guardian Backend

This subpackage provides guardians with the service and infrastructure to issue zero-knowledge certificates, such as ZK KYC. It works as an SDK that can be imported in JavaScript or TypeScript applications. There are also CLI tools for manual testing.

## Features

- **Issue certificates** — Create and issue zero-knowledge certificates to users.
- **Revoke certificates** — Revoke previously issued certificates when needed.
- **View whitelist status** — Check whitelist and certificate status for addresses or identities.
- **Aztec smart contract interactions** — Handle wallet management, transaction building, and submission for Aztec-specific contracts.

## Installation

<!-- TODO: Add installation instructions (e.g. from workspace root, or as a standalone dependency) -->

### From published package
```bash
yarn add @galactica-net/aztec-guardian-backend
```
<!-- TODO: Add import and usage instructions -->

### From source:
```bash
# From repository root (workspace)
yarn install

# Or install this package as a dependency
# yarn add aztec-guardian-backend
```

## Testing

<!-- TODO: Add testing instructions and how to run guardian backend tests -->

```bash
# From repository root
yarn test

# Or from this directory
# yarn test
```

## Running

<!-- TODO: Add instructions for running the service and/or CLI tools -->

```bash
# Start the guardian backend service (when implemented)
# yarn start

# Run CLI tools for manual testing (when implemented)
# yarn cli -- <command>
```
