ARG NODE_VERSION=22
ARG PNPM_VERSION=10.19.0

# ── engine-build ──────────────────────────────────────────────────────────
# Compile Pikafish (xiangqi-specialised Stockfish fork with NNUE, ~3200
# Elo). fairy-stockfish without NNUE tops out around 1600-1800 Elo even
# at depth 20+, which made "hard" feel weak. Building from source rather
# than downloading prebuilts because the Pikafish release zip layout
# changes between versions and the per-arch binaries aren't trivially
# selectable in a Docker context.
FROM node:${NODE_VERSION}-trixie-slim AS engine-build
ARG TARGETARCH
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates git make g++ curl && \
    git clone --depth 1 https://github.com/official-pikafish/Pikafish.git /pf
WORKDIR /pf/src
# Pikafish uses Stockfish-style ARCH names. `x86-64-modern` and `armv8`
# are the widest-compatible profiles for their respective arches.
RUN case "$TARGETARCH" in \
        amd64) PKARCH=x86-64-modern ;; \
        arm64) PKARCH=armv8 ;; \
        *) echo "unsupported TARGETARCH=$TARGETARCH" >&2; exit 1 ;; \
    esac && \
    make -j"$(nproc)" net && \
    make -j"$(nproc)" build ARCH="$PKARCH" && \
    install -Dm0755 pikafish /out/usr/local/bin/pikafish && \
    install -Dm0644 ../*.nnue /out/usr/local/bin/pikafish.nnue

# ── build ─────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-trixie-slim AS build
ARG PNPM_VERSION
ENV CI=true
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && \
    pnpm build && \
    pnpm prune --prod

# ── runtime ───────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-trixie-slim AS runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV XIANGQI_ENGINE_PATH=/usr/local/bin/pikafish
# Pikafish auto-loads pikafish.nnue from the directory containing the
# binary, so co-locating them under /usr/local/bin is all we need.
COPY --from=engine-build /out/ /
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
