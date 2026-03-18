FROM --platform=linux/amd64 ubuntu:24.04
SHELL ["/bin/bash", "-c"]

ENV NVM_DIR=/root/.nvm
ARG NODE_VERSION=24.8.0
ENV NODE_VERSION=$NODE_VERSION

ARG AZTEC_VERSION=4.0.0-devnet.2-patch.1
ENV AZTEC_VERSION=$AZTEC_VERSION

ENV NON_INTERACTIVE=1
ENV BIN_PATH=/usr/local/bin

# Install dependencies including newer libstdc++
RUN apt update && apt install -y \
    curl \
    bash \
    git \
    tar \
    gzip \
    libc++-dev \
    libstdc++6 \
    jq \
    python3 \
    build-essential \
    ca-certificates \
    netcat-openbsd

# Install nvm, node and npm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install ${NODE_VERSION} \
    && nvm use ${NODE_VERSION} \
    && nvm alias default ${NODE_VERSION}

# Add node and npm to path
ENV PATH="${NVM_DIR}/versions/node/v${NODE_VERSION}/bin:${PATH}"
RUN npm i -g yarn

# Install Aztec CLI
RUN curl -fsSL "https://install.aztec.network/${AZTEC_VERSION}" \
    | VERSION="${AZTEC_VERSION}" bash -s

# The Aztec install script puts the `aztec` binary under the user's `.aztec` directory.
# Make sure it's on PATH for subsequent `yarn compile` / `yarn codegen` steps.
ENV AZTEC_BIN_DIR=/root/.aztec/current/node_modules/.bin
ENV AZTEC_CLI_BIN_DIR=/root/.aztec/current/bin
ENV PATH="${AZTEC_CLI_BIN_DIR}:${AZTEC_BIN_DIR}:${PATH}"
RUN command -v aztec && aztec --version && command -v nargo && nargo --version

WORKDIR /workspace

# Copy monorepo sources (no node_modules) so we can build the required workspaces.
COPY package.json yarn.lock ./
COPY yarn.lock ./
COPY Nargo.toml ./
COPY tsconfig*.json ./
COPY patches ./patches
COPY crates ./crates
COPY apps ./apps
COPY services ./services
COPY config ./config
COPY src ./src
COPY scripts ./scripts

RUN yarn install && yarn compile && yarn codegen

RUN cd services/guardian-aztec-connect && yarn build
RUN cd services/guardian-backend && yarn build
RUN cd apps/guardian-frontend-reference && yarn build

