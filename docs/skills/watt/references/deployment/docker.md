# Docker deployment with Watt 4

Preserve an existing Dockerfile unless replacement is requested. Require Node.js
**24.20.0+**, compatible capability dependencies, actual build output, and a startup
that runs Watt. Do not default to a development server or dependency installation at startup.

## npm single-application example

This template assumes an npm lockfile, `build: wattpm build`, `start: wattpm start`,
and configuration explicitly reading `HOST`/`PORT`. Select a supported exact Node image
for the target architecture/libc; the example uses 24.20.0 Alpine.

```dockerfile
FROM node:24.20.0-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24.20.0-alpine AS production
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000

# Keep complete source/configuration/build assets; prune dependencies during image build.
COPY --from=builder --chown=node:node /app ./
RUN npm prune --omit=dev
USER node
EXPOSE 3000
CMD ["npm", "start"]
```

Ensure `wattpm` and capability packages are **production dependencies**, not pruned
development tools. Copying complete project output is conservative; narrow copies only
after inventorying config imports, source entrypoints, assets, and framework runtime needs.
Use `COPY --chown` and writable cache/temp directories. A build may read secrets but must
not bake `.env`, tokens, or private credentials into image layers; use build secrets where needed.

Native DB/PHP drivers must be built for the image architecture/libc. Use a Debian-based
image when native dependencies do not support musl; never copy host `node_modules`.

## Workspace/package managers

Copy all workspace manifests before dependency installation and include each app's
configuration/source/output/capability dependencies. Root npm `npm ci` requires declared
workspaces and the correct lockfile. Preserve existing Yarn/pnpm/Bun conventions; use a
supported pinned installer and frozen lockfile. Do not assume Corepack or generate a
second lockfile. Review production pruning and hoisting before narrowing copies.

## Framework output

- Next.js: keep required `.next`, `public`, configuration, manifests, Watt and capability.
  For standalone deployments, set Next `output: 'standalone'` and capability
  `next.standalone: true`, inspect the supported pack command, and retain Watt startup.
  `CMD ["node", "server.js"]` by itself is framework-only hosting, not this Watt deployment.
- Nuxt/Nitro: copy complete `.output`, including server, public assets, and bundled deps.
- React Router/Remix/TanStack: copy the actual server/client output and adapter dependencies.
- Astro: include both server and client output matching its Node adapter.
- NestJS: preserve compiled app module/shared setup, assets, and `@platformatic/nest`.
  Starting only `dist/main.js` bypasses the dedicated Watt capability.
- Generic Node: include its actual source or compiled `main`; do not assume `dist` exists.

Build before production startup; retain framework original scripts without recursive
`wattpm build` invocation through custom command settings.

## .dockerignore

```text
node_modules
.git
.env
.env.*
!.env.example
.next
.nuxt
.output
dist
build
coverage
*.log
pprof-*.pb
*.heapsnapshot
flame-*.html
tmp
```

Adjust these exclusions to actual profiling paths and build output intentionally supplied
instead of rebuilt. Keep package manifests/lockfiles and
configuration imports. Add IDE/OS artifacts as appropriate.

## Health checks

No universal `/health` route exists. Probe an implemented public app route, or configure
the runtime's documented private readiness/liveness listener explicitly. Choose startup
period and timeouts for the real application. For an implemented `/health` on 3000:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
```

The snippet does not create the endpoint. Framework `.json` routes or Gateway prefixes
may change its path. Keep metrics/control ports private and protected.

## Compose development

```yaml
services:
  app:
    build:
      context: .
      target: builder
    ports:
      - '127.0.0.1:3000:3000'
    environment:
      NODE_ENV: development
      HOST: 0.0.0.0
      PORT: '3000'
      LOG_LEVEL: debug
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev
```

This volume layout is single-app only; workspaces may need additional dependency/output
mount handling. Preserve container dependencies when bind-mounting source.

## Compose production and infrastructure

```yaml
services:
  app:
    build:
      context: .
      target: production
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: '3000'
      LOG_LEVEL: info
    restart: unless-stopped
```

Add only requested DB/cache services. For PostgreSQL, use a supported pinned image,
persistent data volume, and `pg_isready` health check; `depends_on: condition:
service_healthy` does not replace application connection retries. Redis/Valkey need
persistent/auth configuration according to the requested cache semantics. Credentials
belong in untracked env files/secret stores, not copied production templates.
An optional Nginx reverse proxy can terminate TLS with read-only config/certificate mounts.

## Build/run and registry commands

Provide commands, but execute only with authorization:

```sh
docker build -t my-watt-app:v1.0.0 .
docker run -d -p 3000:3000 --env-file .env.production --name my-watt-app my-watt-app:v1.0.0
docker logs -f my-watt-app
docker stop my-watt-app
docker tag my-watt-app:v1.0.0 registry.example.com/my-watt-app:v1.0.0
docker push registry.example.com/my-watt-app:v1.0.0
```

Use actual image names, approved env files, measured CPU/memory limits, non-root startup,
vulnerability scanning, and restart policies. Push/pull/provisioning are separate authorized
operations. Validate public routing, private mesh, assets, secrets exclusion, and termination.
