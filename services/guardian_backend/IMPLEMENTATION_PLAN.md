# Implementation Plan

Build the package in small slices, with TDD.

## 1. Wallet Setup

Goal: Base tooling for loading and working with an Aztec wallet

Suggested steps:
1. Import the AztecJS dependency for interacting with wallets
2. Read account secrets from ENV variables
3. Load account in AztecJS wallet
4. Connect to the network according to the config. The config should allow setting up multiple networks (local sandbox, devnet, mainnet) and support a command or flag to select the network to work with.
5. Query account status from the network including if the account smart contract has been deployed
6. Expose the account status check from above as external function that can be called after importing this package.
7. Expose the account status check from above as CLI command.
8. Ensure that the repository testing infrastructure is in place and working so that we can use test driven development going forward.
8. Function to deploy the account if it has not been deployed yet. See 
9. Expose account deployment as JS function and CLI.

Notes:
- You can check `@scripts/deploy_account_from_env.ts` as reference for how to connect to the network, load an account and deploy it.
- For testing, you can check the integration test `@crates/use_case_exaple/src/test/e2e/index.test.ts` as reference.

## 2. Check whitelist status

Goal: Interact with the certificate registry smart contract and check if the used guardian account is whitelisted.

Suggested Steps:
1. Extend the JS exported and CLI function to check the account status from the previous section.
2. Load the certificate registry account from the ENV variables.
3. Call the public function to read the whitelist state of the guardian's address
4. In the CLI version of the call, add instructions how a guardian can get whitelisted (asking the Galactica team to whitelist them)

Notes:
- For testing, you can check the integration test `@crates/use_case_exaple/src/test/e2e/index.test.ts` as reference. It shows how to deploy the certificate registry and how the admin manages the whitelist.
- This smart contract function can be used: `@crates/zk_certificate/src/main.nr:383-395` 

## 3. Issue KYC certificates

Goal: Get, parse and check KYC details to then issue a ZK KYC in the certificate registry.

Suggested Steps:
1. 

Notes:
- 

## 4. Query PXE notes about revokable certificates

Goal: Query private Aztec notes for the guardian account to check which certificates has been issued and what their revocation IDs are.

Suggested Steps:
1. 

Notes:
- 

## 5. Revoke KYC certificates

Goal: Revoke a KYC certificate by its ID.

Suggested Steps:
1. 

Notes:
- 
