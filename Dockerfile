FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS server-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM nginx:alpine AS frontend
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM base AS server
COPY --from=server-deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
RUN npx tsx --version > /dev/null 2>&1 || npm install tsx
EXPOSE 3001
CMD ["npx", "tsx", "server/index.ts"]
