# Builds the API, then runs the compiled code as the unprivileged `node` user
# with production dependencies only.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
# No npm update notices in the output of `docker compose exec backend npm run …`.
ENV NODE_ENV=production \
  NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app
COPY package.json package-lock.json ./
# dist/ is already built, so the build hooks of the seed and migration scripts
# go. `docker compose exec backend npm run seed` then runs the compiled seeder.
RUN npm ci --omit=dev \
  && npm pkg delete scripts.preseed scripts.preseed:reset scripts.premigration:run scripts.premigration:revert \
  && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
USER node
EXPOSE 3000
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
