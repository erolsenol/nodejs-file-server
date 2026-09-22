FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json .prettierrc eslint.config.mjs ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app ./
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/.data && chown -R app:app /app
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health/live').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "apps/server/dist/server.js"]
