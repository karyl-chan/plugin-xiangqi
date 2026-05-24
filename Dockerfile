ARG NODE_VERSION=22
ARG PNPM_VERSION=10.19.0

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
# fairy-stockfish is the AI engine. If Debian doesn't ship it for this
# base image we fall back to downloading the upstream release binary.
FROM node:${NODE_VERSION}-trixie-slim AS runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl xz-utils && \
    ( apt-get install -y --no-install-recommends fairy-stockfish || \
      ( curl -fsSL -o /tmp/fs.bin \
          "https://github.com/fairy-stockfish/Fairy-Stockfish/releases/latest/download/fairy-stockfish-largeboard_x86-64-bmi2" \
        && install -m 0755 /tmp/fs.bin /usr/local/bin/fairy-stockfish \
        && rm /tmp/fs.bin ) || \
      echo "warning: fairy-stockfish not installed; AI will fall back to random legal moves" ) && \
    apt-get purge -y curl xz-utils && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV XIANGQI_ENGINE_PATH=/usr/local/bin/fairy-stockfish
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
