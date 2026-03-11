# Guardian Backend Guide

Use this file as the compact source of truth for this package. Read `README.md` and this file before making substantial changes. Also inherit the root repository guidance from `/AGENTS.md`.

## Spec

`Guardian Backend` is a NodeJS service that runs in the backend to integrate a frontend where users pass KYC with the Sumsub KYC API and the `guardian-aztec-connect` SDK. It is a central component in providing a KYC service to users and issue ZK KYC on the Aztec blockchain.

Core features:

- Backend for guardian frontend application
- Integrate Sumsub API for KYC audits and storage
- Call `guardian-aztec-connect` (package in this repo) to issue and revoke ZK KYC certificates on-chain

Workspace context:

- package path: `services/guardian-backend`
- package name: `@galactica-net/guardian-backend`
- included from the root workspace `package.json`

Target shape:

- `README.md` for package overview
- `AGENTS.md` for compact spec, workflow, and config rules
- `.env.example` for local testing placeholders
- `src/` and `test/` added incrementally as features land

Design rules:

- keep domain logic separate from Aztec transport and wallet concerns
- expose backend service through REST API and CLI for testing (both share core services instead of duplicated logic)
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

## Configuration Rules

- load secrets and runtime settings from environment variables
- use local `.env` files only for testing and manual development
- do not commit real `.env` files or secrets
- validate required config early
- do not hardcode private keys, mnemonics, or contract addresses
- do not print sensitive values in logs

## Reference Implementation

- This package is a NodeJS port of the reference implementation written in Go, that can be found in `@services/guardian-backend/go-reference-implementation`
- Our port should keep the REST API of the reference implementation, to be compatible with the same frontend. The reference frontend code it will be working with can be found in `@apps/guardian-frontend-reference`. It is a placeholder that will be reworked and rebranded after this package is finished.
-  There are some features of the go reference implementation, that we do not need. These parts should be dropped and cut out of the migration. These includes the AWS S3 storage. We do not need to store data about the generated ZK certificates. We also do not need ethereum blockchain libraries.
- Our port will use the `guardian-aztec-connect` package and its JS SDK function to work with the blockchain instead of `github.com/galactica-corp/guardians-sdk`. It will take care of all the blockchain interaction. The KYC certificate content and API differ a bit. Resolve those differences.
- Keep the port simple and effective. You can drop irrelevant or redundant features.

## Preferred Sources

Prefer sources in this order:

1. package code and docs in `services/guardian-backend`
2. Reference implementation in `@services/guardian-backend/go-reference-implementation`
3. Root guidance in `/AGENTS.md`
4. Reference frontend counterpart in `@apps/guardian-frontend-reference`
5. Sumsub API docs https://docs.sumsub.com/reference/about-sumsub-api

