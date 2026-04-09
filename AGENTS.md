# Repository guidelines for Codex agents

This repository contains TypeScript scripts and Noir contracts for the Aztec local network.
Follow these guidelines when contributing:

# Aztec Project

## Critical: Use `aztec` CLI, not `nargo` directly

This is an Aztec smart contract project. Always use the `aztec` CLI wrapper instead of calling `nargo` directly:

- **Compile**: `aztec compile` (NOT `nargo compile`). Using `nargo compile` alone produces incomplete artifacts.
- **Test**: `aztec test` (NOT `nargo test`).
- **Other nargo commands** like `nargo fmt` and `nargo doc` are fine to use directly.

## Setup
- Use **Node.js v24** with Yarn. Do not use `npm` or `npx` directly.
- Install dependencies with `yarn install`.
- Start the Aztec local network using `aztec start --local-network` before running tests or scripts.

## Development
- Compile contracts with `yarn compile` and generate TypeScript artifacts with `yarn codegen`.
- Use four spaces for indentation in TypeScript and scripts.
- Do not commit generated artifacts (`src/artifacts`, `target`, or `store` folders).
- Make use of the `aztec` and `noir` MCP servers to query documentation on writing Noir smart contracts for Aztec.
- use docstrings to document the purpose of exposed functions and how to use them.
- use comments to explain important reasons why the code has been written like this.
- do not comment what the code is obviously doing. Instead use descriptive variable and function names.

## Testing
- Run `yarn test` and ensure it passes before committing. This runs both the TypeScript tests and Noir tests.
- For Noir contracts, use `aztec test --workspace` (or `yarn test:nr`); do not use `nargo test`.

## Pull Requests
- Use clear commit messages and provide a concise description in the PR body about the change.
- Mention which tests were executed.

