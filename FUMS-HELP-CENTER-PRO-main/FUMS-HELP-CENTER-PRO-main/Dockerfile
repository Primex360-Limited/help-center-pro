FROM node:22-slim

# Prisma (query engine) needs OpenSSL at runtime; also install CA certs.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first to maximise layer caching.
COPY package*.json ./
RUN npm ci

# Application source.
COPY . .

# `prisma generate` only needs a syntactically valid URL (no live connection).
ENV DATABASE_URL_PRODUCTION="postgresql://postgres:password@localhost:5432/help_center_pro?schema=public"
RUN npx prisma generate

EXPOSE 4008

CMD ["node", "server.js"]
