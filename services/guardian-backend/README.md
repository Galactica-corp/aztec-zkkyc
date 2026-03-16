# Guardian Backend

Node.js backend for the guardian frontend: integrates Sumsub KYC with the Aztec network via `@galactica-net/guardian-aztec-connect` to issue and revoke ZK KYC certificates.

## Overview

- **REST API** for the reference frontend: access token generation, applicant encryption key storage, Sumsub webhook handling.
- **Sumsub** integration for KYC checks and applicant data.
- **guardian-aztec-connect** for on-chain certificate issuance and revocation (no S3, no EVM, no email delivery in this port).

See `AGENTS.md` for the migration spec, preserved API contracts, dropped Go features, and internal processing record shape.

## Setup

- Node.js 24+, Yarn.
- Copy `.env.example` to `.env` and set required variables.

## Scripts

- `yarn test` / `yarn test:unit` / `yarn test:integration` — run tests.
- `yarn dev` — start the HTTP server for local development.
- `yarn cli -- status` — check guardian account and whitelist readiness.
- `yarn cli -- revoke <revocationId>` — revoke a certificate by revocation ID.

## Configuration

All settings come from environment variables; see `.env.example`. Do not commit `.env` or secrets.

- **Sumsub** (required for API and webhook): `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `SUMSUB_WEBHOOK_SECRET_KEY`.
- **Aztec / issuance**: `AZTEC_ENV`, `SECRET`, `SIGNING_KEY`, `SALT`, `CERTIFICATE_REGISTRY_ADDRESS`, `CERTIFICATE_REGISTRY_ADMIN_ADDRESS`, `CERTIFICATE_REGISTRY_DEPLOYMENT_SALT`, `CERTIFICATE_REGISTRY_DEPLOYER_ADDRESS`.
- **Server**: `PORT` (default 3000).

The frontend must send `userAddress` (Aztec address) with the access-token request so the backend can issue on approval; optional body field: `{ "holderCommitment": "...", "userAddress": "..." }`.

## Legacy Certificate Page

The reference frontend route `/certificate/:certificateId` and S3-based certificate download are **out of scope** for the first migration milestone. That flow assumed a downloadable encrypted certificate artifact; this backend issues on-chain only and persists issuance metadata (`uniqueId`, `revocationId`, `txHash`). A replacement flow for the certificate page can be added in a later phase.
