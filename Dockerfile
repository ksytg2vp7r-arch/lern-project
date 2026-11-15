# Bauanleitung für das Abbild (Image) der Anwendung.

# Stufe 1: TypeScript nach JavaScript übersetzen
FROM node:22-alpine AS bau
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Stufe 2: schlankes Abbild nur mit dem, was zum Laufen nötig ist
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=bau /app/dist ./dist
COPY drizzle ./drizzle
# Nicht als Administrator laufen
USER node
EXPOSE 3000
# Erst die Datenbank auf den neuesten Stand bringen, dann starten
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
