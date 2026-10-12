FROM node:22-slim

WORKDIR /app

# Install dependencies first to maximise layer caching.
COPY package*.json ./
RUN npm ci

# Application source.
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
