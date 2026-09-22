FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.json tsconfig.base.json .prettierrc eslint.config.mjs ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --no-frozen-lockfile && pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app ./
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/.data && chown -R app:app /app
USER app
EXPOSE 3000
CMD ["node", "apps/server/dist/server.js"]
