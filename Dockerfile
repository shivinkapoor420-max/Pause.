# Pause — production image (Node server + static assets). Needs a Postgres DATABASE_URL at runtime.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
COPY --from=build /app/.output ./.output
# Migrations are bundled into the server and applied automatically on first request.
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
