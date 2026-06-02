# ── Build stage ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Run stage ────────────────────────────────────────────────────────────────────
FROM node:22-alpine
RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
COPY public ./public
COPY package.json ./

EXPOSE 3000
CMD ["node", "src/server.js"]
