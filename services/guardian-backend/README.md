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
- `yarn cli -- <command> [options]` — forwards to `guardian-aztec-connect` CLI; same usage (e.g. `yarn cli account status`, `yarn cli kyc revoke --revocation-id <id>`). Run `yarn cli -- --help` for full usage.

## Webhook debug logs

When the Sumsub webhook is called (`POST /api/v1/sumsub-webhook`), the server logs lines prefixed with `[webhook]` to **stdout**. Run `yarn dev` in this package and watch the terminal where the server is running to see:

- Incoming webhook request and headers (`X-Payload-Digest-Alg`, body length).
- Digest verification: `Digest OK` or `Digest verification FAILED (check SUMSUB_WEBHOOK_SECRET_KEY)`.
- Parsed event type and, for `applicantReviewed`, the `reviewAnswer` (e.g. `GREEN`).
- When the issuance callback runs (`Calling onApplicantReviewed` / `onApplicantReviewed completed`).

Use these logs to confirm that Sumsub is hitting your endpoint and that `SUMSUB_WEBHOOK_SECRET_KEY` matches the secret configured in the Sumsub dashboard.

## Configuration

All settings come from environment variables; see `.env.example`. Do not commit `.env` or secrets.

- **Sumsub** (required for API and webhook): `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `SUMSUB_WEBHOOK_SECRET_KEY`.
- **Aztec / issuance**: `AZTEC_ENV`, `SECRET`, `SIGNING_KEY`, `SALT`, `CERTIFICATE_REGISTRY_ADDRESS`, `CERTIFICATE_REGISTRY_ADMIN_ADDRESS`, `CERTIFICATE_REGISTRY_DEPLOYMENT_SALT`, `CERTIFICATE_REGISTRY_DEPLOYER_ADDRESS`.
- **Server**: `PORT` (default 3005).
- **CORS**: `CORS_ALLOW_ORIGINS` — comma-separated list of origins allowed for browser requests (default: `http://localhost:5173`). Set this when the frontend runs on a different origin (e.g. Vite dev server) so the backend can respond with the appropriate `Access-Control-Allow-Origin` header.

The frontend must send `userAddress` (Aztec address) as the only field in the access-token request body so the backend can issue on approval: `{ "userAddress": "..." }`.

## Legacy Certificate Page

The reference frontend route `/certificate/:certificateId` and S3-based certificate download are **out of scope** for the first migration milestone. That flow assumed a downloadable encrypted certificate artifact; this backend issues on-chain only and persists issuance metadata (`uniqueId`, `revocationId`, `txHash`). A replacement flow for the certificate page can be added in a later phase.
