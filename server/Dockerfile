FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY server ./server
CMD ["npx", "tsx", "server/index.ts"]
