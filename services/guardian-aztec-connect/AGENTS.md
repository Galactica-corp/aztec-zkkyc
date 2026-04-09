# Guardian Aztec Connect Guide

Use this file as the compact source of truth for this package. Read `README.md`, this file, and `IMPLEMENTATION_PLAN.md` before making substantial changes. Also inherit the root repository guidance from `/AGENTS.md`.

## Spec

`Guardian Aztec Connect` provides guardians with the service and infrastructure to issue zero-knowledge certificates, such as ZK KYC. It should support:

- an SDK imported by JavaScript or TypeScript applications
- CLI tools for manual testing and operational flows

Core features:

- issue certificates
- revoke certificates
- view whitelist status
- handle Aztec-specific wallet management, transaction building, and transaction submission

Normalized ZK-KYC issuance payload:

- `personal.surname`: required string
- `personal.forename`: required string
- `personal.middlename`: optional string, defaults to empty string
- `personal.birthday`: required ISO date string in `YYYY-MM-DD` format
- `personal.citizenship`: required ISO 3166-1 alpha-3 country code
- `personal.verificationLevel`: required integer, currently `0`, `1`, or `2`
- `address.streetAndNumber`: required string
- `address.postcode`: required string
- `address.town`: required string
- `address.region`: optional ISO 3166-2 subdivision code, defaults to empty string
- `address.country`: required ISO 3166-1 alpha-3 country code

Issuance API rules:

- provider-specific KYC payloads must be normalized outside this package before calling the SDK or CLI
- SDK issuance auto-generates `uniqueId` and `revocationId` when they are not provided explicitly
- CLI issuance reads the normalized payload from a JSON file path
- issuance returns the generated certificate identifiers so callers can persist them in external systems

Workspace context:

- package path: `services/guardian-aztec-connect`
- package name: `@galactica-net/guardian-aztec-connect`
- included from the root workspace `package.json`

Target shape:

- `README.md` for package overview
- `AGENTS.md` for compact spec, workflow, and config rules
- `IMPLEMENTATION_PLAN.md` for feature-by-feature build steps
- `.env.example` for local testing placeholders
- `src/` and `test/` added incrementally as features land

Design rules:

- keep domain logic separate from Aztec transport and wallet concerns
- expose SDK and CLI through shared core services instead of duplicated logic
- prefer explicit typed inputs and outputs at package boundaries
- keep placeholders explicit with `TODO:`
- use docstrings to document the purpose of exposed functions and how to use them.
- use comments to explain important reasons why the code has been written like this.
- do not comment what the code is obviously doing. Instead use descriptive variable and function names. 

## Workflow Rules

- implement in small, testable vertical slices
- if behavior is not specified yet, extend the spec here first and then implement it
- keep docs in sync with behavior in the same change
- test everything as you go
- use `aztec` CLI wrappers instead of `nargo` directly for Aztec compile and test flows
- Prefer reusable and modular code. Do not copy paste large code sections.
- After implementing a feature, take appropriate steps to refactor the codebase to keep it well maintained.

Required TDD cycle:

1. write the test first
2. run it and confirm it fails for the expected reason
3. implement the smallest change that should make it pass
4. run the relevant tests again and confirm they pass
5. update docs, examples, or config notes if needed
6. commit only after the change is green

Definition of done:

1. behavior is specified
2. tests were added first and seen failing
3. implementation passes the new and nearby relevant tests
4. manual verification steps are documented if needed
5. docs remain consistent with the code

## Implementation Learnings

- Reuse the shared runtime and `certificateRegistryClient` for all certificate-registry reads and writes. Do not create separate Aztec bootstrapping paths per feature.
- For contracts deployed outside the current PXE, register the contract before calling `Contract.at(...)`. For the certificate registry, reconstruction needs the address, deployment salt, admin address, and deployer address.
- On `local-network`, prefer ephemeral wallet/PXE state by default. Reusing persisted PXE state after restarting the local chain can cause stale block-hash and contract-sync errors.
- Keep whitelist and future registry checks non-fatal where possible in status-style commands, but still surface the error clearly in the returned result and CLI output.
- When extending later slices like issuance, note listing, and revocation, add tests first at the client/helper layer, then the shared service layer, then CLI formatting/output.
- Keep the KYC validation and hashing logic reusable and separate from on-chain submission so backend/provider adapters can normalize into the same payload shape.

## Configuration Rules

- load secrets and runtime settings from environment variables
- use local `.env` files only for testing and manual development
- do not commit real `.env` files or secrets
- validate required config early
- do not hardcode private keys, mnemonics, or contract addresses
- do not print sensitive values in logs

## Preferred Sources

Prefer sources in this order:

1. package code and docs in `services/guardian-aztec-connect`
2. root guidance in `/AGENTS.md`
3. Aztec and Noir MCP tools for getting documentation in Cursor
4. Official Aztec docs for agents: `https://docs.aztec.network/developers/ai_tooling#for-learning-and-exploration`

Useful references:

- Aztec JS SDK docs: `https://docs.aztec.network/reference/aztec-js`
- Aztec PXE docs: `https://docs.aztec.network/developers/apis/pxe`
