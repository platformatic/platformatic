# Docker deployment for Watt 3

Require Node.js 22.19.0 or newer in both build and runtime stages. Use a supported,
pinned image compatible with native dependencies and the target architecture. Preserve
the project's package manager; the example below assumes npm and a committed lockfile.

## Build and start

For a project whose `build` and `start` scripts invoke Watt:

```dockerfile
FROM node:22.19.0-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22.19.0-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app ./
USER node
ENV PLT_SERVER_HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["node", "node_modules/wattpm/bin/cli.js", "start"]
```

The image tag illustrates the minimum version, not a recommendation to stay on that
patch forever. Select a maintained patched tag/digest for actual deployments.

This conservative example keeps the application's complete build tree. Once verified,
narrow copied files to the required runtime artifacts. Do not assume every framework
uses `dist`, or that every project has a `public` directory. For workspaces, copy the
required manifests before installation and retain workspace links and all app outputs.

Ensure `wattpm` and production capabilities are production dependencies. When using
pnpm or Yarn, retain the project's supported deployment/pruning workflow rather than
substituting npm commands. Do not prune dependencies still needed by runtime plugins.

## Ignore local artifacts

```text
node_modules
.git
.env
.env.*
!.env.example
coverage
*.log
*.pb
*.heapsnapshot
tmp
```

Add framework build directories that will be rebuilt inside the image. Do not exclude
source, workspace manifests, assets, or migration files required for the build/runtime.
Supply secrets at runtime or through build-secret mechanisms, never image layers.

## Framework output

- Next.js: deploy required `.next` output, static assets, and public files. When using
  standalone output, inspect `next.standalone` and the app-specific pack workflow.
  Starting `server.js` directly bypasses Watt orchestration.
- Nuxt/Nitro: include the complete `.output` tree, including its server dependencies.
- Vite/React Router/TanStack/Remix/Astro: retain both client and server output as required.
- NestJS: compile decorators/metadata and deploy the actual `node.main` target and dependencies.
- PHP: verify native runtime, extensions, document roots, and persistent data separately.

## Runtime checks

```sh
docker build -t my-watt-app:release .
docker run --rm --init -p 3000:3000 --env-file .env.production my-watt-app:release
```

Run these commands only when authorized. Ensure the configured Watt listener consumes
`PORT` and binds to `0.0.0.0`; environment names alone do not configure a listener.
Test health endpoints that actually exist, asset paths, internal calls, and SIGTERM.
Budget memory for all workers and use writable mounts for caches or temporary files.

For Compose, keep databases/caches in their own services with persistent volumes and
explicit readiness. Database startup order does not replace connection retry logic.
Use [Kubernetes](kubernetes.md) or [cloud](cloud.md) guidance for managed deployments.
