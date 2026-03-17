# Guardian Frontend Reference

Reference frontend for the Guardian KYC flow. It runs in the Aztec ZK-KYC monorepo and talks to the Guardian Backend (Sumsub + guardian-aztec-connect).

## Setup

- **Node.js**: use v24+ (see root `package.json` engines).
- **Package manager**: Yarn. This app is a workspace package; from the repo root run:

  ```bash
  yarn install
  ```

- **Environment**: copy `.env.example` to `.env` (or `.env.development`) and set `VITE_BACKEND_URL` to your Guardian Backend base URL.

## Run

From the repo root:

```bash
yarn workspace syntetika-guardian dev
```

Or from this directory (after `yarn install` at root):

```bash
yarn dev
```

## Usage

The app has a single route: **`/`**. To start the Sumsub KYC flow, open the app with the user’s **Aztec address** in the query string:

- **Example**: `http://localhost:5173/?userAddress=0x1234...`

The frontend sends `userAddress` to `POST /api/v1/access-token` and launches the Sumsub Web SDK with the returned token. No wallet connection or certificate download is required for this flow.

## Build

```bash
yarn build
```

## Deploy

Scripts for Cloudflare Workers (e.g. `deploy:cassiopeia`, `deploy:mainnet`) are defined in `package.json`; configure `wrangler.jsonc` and env for your target.
