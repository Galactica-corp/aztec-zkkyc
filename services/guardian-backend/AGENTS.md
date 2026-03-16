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

## Migration Spec (from Go Reference)

### Preserved REST API

The backend must expose exactly three routes compatible with `@apps/guardian-frontend-reference`:

1. **POST /api/v1/access-token**
   - Request body: `{ "holderCommitment": string }`
   - Response: JSON-encoded string (the Sumsub SDK access token). The frontend expects `response.json()` to yield a plain string.
   - Behavior: generate Sumsub access token for the given holder; cache optional.

2. **PUT /api/v1/applicants/:applicantId/encryption-public-key**
   - Request body: `{ "encryptionPublicKey": string }` (base64 or raw per client; backend stores as provided for applicant metadata).
   - Response: JSON body required so frontend `response.json()` does not throw. Use e.g. `{ "ok": true }`.
   - Behavior: store encryption public key in Sumsub applicant metadata under key `encryption_public_key`.

3. **POST /api/v1/sumsub-webhook**
   - Headers: `X-Payload-Digest` (hex), `X-Payload-Digest-Alg` (e.g. HMAC_SHA256_HEX, HMAC_SHA512_HEX).
   - Body: raw request body for digest verification.
   - Behavior: verify HMAC; on `applicantReviewed` with `reviewAnswer === "GREEN"`, run the issuance workflow (fetch applicant, normalize KYC, issue via guardian-aztec-connect, persist result).

### Dropped Go-Only Features

Do not port:

- AWS S3 storage for certificate artifacts
- Email delivery of certificate download links
- Ethereum / go-ethereum / guardians-sdk and EVM registry
- Merkle proof service
- Redis Streams as a queue (optional later; first implementation is synchronous webhook-to-issuance in-process)

### Internal Processing Record

The backend keeps a correlation record per KYC session to bridge frontend, Sumsub, and Aztec. Recommended fields:

- `holderCommitment` (string): from frontend when requesting access token
- `userAddress` (string): Aztec address for issuance; **provided by the frontend** (see below)
- `applicantId` (string): Sumsub applicant id
- `sumsubExternalUserId` (string): typically equals holderCommitment in Sumsub
- `encryptionPublicKey` (string, optional): from PUT applicants endpoint
- `status`: e.g. `accessTokenIssued` | `applicantLoaded` | `approved` | `issuing` | `issued` | `failed`
- `normalizedKycPayload`: provider-agnostic KYC shape for guardian-aztec-connect
- `issuanceResult`: `{ uniqueId, revocationId, txHash }` when status is `issued`
- `lastError` (string, optional): last failure reason
- `createdAt`, `updatedAt` (timestamps)

### User Address Source

The Aztec SDK requires `userAddress` for issuance. The **frontend will be updated** to send the user's Aztec address to the backend. Until that change lands, the backend may accept `userAddress` via an extended access-token request body (e.g. optional `userAddress` in POST /api/v1/access-token) or a dedicated endpoint; the exact contract will be aligned with the frontend. The processing record must store `userAddress` so the webhook handler can issue without further frontend round-trips.

### Issuance Flow (First Implementation)

- **Synchronous**: When Sumsub sends `applicantReviewed` with GREEN, the webhook handler runs the full flow in-process: load/create processing record, fetch applicant from Sumsub, normalize to ZkKycInput, call guardian-aztec-connect `issueKycCertificate()`, persist result. No queue worker in the first milestone.
- **Idempotency**: Duplicate webhooks for the same applicant must not double-issue; use processing record status and stored issuance result to skip or return existing result.

### Legacy Certificate Page

The frontend route `/certificate/:certificateId` and S3-based certificate download are **out of scope** for the first backend migration milestone. Document this in README; do not reintroduce S3 for compatibility.

## Preferred Sources

Prefer sources in this order:

1. package code and docs in `services/guardian-backend`
2. Reference implementation in `@services/guardian-backend/go-reference-implementation`
3. Root guidance in `/AGENTS.md`
4. Reference frontend counterpart in `@apps/guardian-frontend-reference`
5. Sumsub API docs https://docs.sumsub.com/reference/about-sumsub-api

