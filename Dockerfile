# Nectarium — imagine Docker de producție.
# Build multi-stage: instalează dependențele o singură dată, generează
# clientul Prisma, apoi copiază totul într-o imagine finală slabă.

FROM node:20-slim AS base
# OpenSSL e necesar pentru motorul Prisma pe Debian slim.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Instalează TOATE dependențele (inclusiv devDependencies — are nevoie de CLI-ul
# Prisma aici, ca "prisma generate" să nu încerce să-l descarce din nou mai jos).
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY src ./src
COPY public ./public
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh \
  && npx prisma generate \
  && mkdir -p uploads

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
