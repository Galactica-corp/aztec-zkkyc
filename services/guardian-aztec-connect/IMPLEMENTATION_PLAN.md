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
- Keep building on the shared runtime/context instead of reloading network, wallet, and guardian account in each function.
- Use `AZTEC_ENV` with the root `config/<env>.json` files. Guardian account material is `SECRET`, `SIGNING_KEY`, and `SALT`.
- For account deployment/status, prefer `getContractMetadata(...).isContractInitialized` over wallet registration checks.
- Keep CLI commands wired through the command registry and keep reusable test fixtures under `test/support/`.

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
- Reuse the certificate registry client abstraction and extend the existing account status / CLI command surfaces instead of creating separate bootstrapping paths.

## 3. Issue KYC certificates

Goal: Get, parse and check KYC details to then issue a ZK KYC in the certificate registry.

Suggested Steps:
1. Understand the data and structure required for a ZK KYC from looking at `@crates/use_case_exaple/src/test/e2e/index.test.ts` and `@crates/zk_certificate/src/content/kyc_layout.nr`.
2. Create a JSON schema defining the input data for a ZK KYC.
4. Expose issuance function skeleton in JS and CLI API.
3. Integrate a parser to check input data for completeness and validity.
5. Prepare the string fields of the KYC for issuance by hashing them, see `@crates/use_case_example/src/test/e2e/index.test.ts:32-53`
6. Call smart contract function issuing the certificate
7. Wait for on-chain settlement.
8. Add nice error handling and reporting.
9. Return IDs of the issued certificate, so that the caller can log them in their KYC database.

Notes:
- For testing, you can check the integration test `@crates/use_case_exaple/src/test/e2e/index.test.ts` as reference.
- This smart contract function can be used for issuance: `@crates/zk_certificate/src/main.nr:155-198` 
- Reuse the shared runtime, certificate registry client, and CLI registry. Keep KYC parsing/validation separate from Aztec transaction submission.

## 4. Query PXE notes about revokable certificates

Goal: Query private Aztec notes for the guardian account to check which certificates has been issued and what their revocation IDs are.

Suggested Steps:
1. Create a new `listRevokableCertificates` function with an exposed JS and CLI API.
2. Load the guardian account and network (expecting reusable functions for that shared with other functions).
3. Load the PXE environment.
4. Query notes from the certificate registry (see `@crates/zk_certificate/src/main.nr:75-76` )
5. Return notes in a nice format.
6. Format notes in the CLI call.

Notes:
- For testing, you can check the integration test `@crates/use_case_exaple/src/test/e2e/index.test.ts` as reference.
- Reuse the shared runtime and certificate registry client setup from the previous slices.

## 5. Revoke KYC certificates

Goal: Revoke a KYC certificate by its ID.

Suggested Steps:
1. Create a new `revokeCertificate` function with an exposed JS and CLI API. It takes the revocation ID as input.
2. Load the guardian account and network (expecting reusable functions for that shared with other functions).
3. Create and submit the revocation on-chain. The interaction with the smart contract is similar to the issuance function.

Notes:
- For testing, you can check the integration test `@crates/use_case_exaple/src/test/e2e/index.test.ts` as reference.
- The revocation function in the smart contract is implemented here:  `@crates/zk_certificate/src/main.nr:213-231` 
- Reuse the same transaction submission patterns and CLI command registry introduced in the wallet setup slice.

## 6. Improvements

Goal: Check and improve the package.

Suggested steps:
1. Get an overview of the functions and scope of this package.
2. Review package scripts, CLI API and the JS API. Improve it where it makes sense.
3. Check the README.md documentation and update it where necessary. Keep it short, informative and actionable.
4. Identify and suggest refactorings and improvements.
