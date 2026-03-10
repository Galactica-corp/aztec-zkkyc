# Guardian Backend Guide

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

- Aztec JS SDK docs: `https://docs.aztec.network/typescript-api/devnet/aztec.js.md`
- Aztec PXE docs: `https://docs.aztec.network/typescript-api/devnet/pxe.md`
