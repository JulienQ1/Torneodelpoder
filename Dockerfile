# syntax=docker/dockerfile:1

# Torneo del Poder — production image.
# Runs Next.js + Socket.IO in one long-lived Node process (see server/index.ts),
# which is why this deploys to a persistent host (Railway/Render/Fly), not a
# serverless platform.

FROM node:22-slim AS build
WORKDIR /app

# Prisma needs OpenSSL to generate its client.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Install deps. The Prisma schema must be present because `postinstall` runs
# `prisma generate`, so copy it before `npm ci`.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Build the app (prisma generate && next build).
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy the built app and its dependencies. `npm start` runs the custom server
# via tsx (a dependency), so node_modules is kept as-is.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.js ./next.config.js
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma

# The host provides PORT; the server binds 0.0.0.0 by default.
EXPOSE 3000
CMD ["npm", "start"]
