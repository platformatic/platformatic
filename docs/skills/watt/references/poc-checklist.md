# POC preparation checklist

This is onboarding for a non-Watt application. For an existing Watt 3 project, use
[migration-v4.md](migration-v4.md) instead of silently upgrading during the POC.

## Prerequisites

- Node.js **24.20.0+**, also supported by the existing application.
- A working local copy with its normal build/start pipeline understood.
- Required DB/API access, or isolated local mocks for load tests.
- Docker only when the selected infrastructure/deployment requires it.
- Existing package manager, lockfile, module type, and workspace boundaries identified.
- Agreed scope and authorization before installs, tests, profiling, or startup.

Prefer Linux for testing Linux port-sharing behavior. macOS/Windows multi-worker fixed
ports may require supported `portAssignment`; do not assume identical performance.

## Make it run

1. Detect the app using [frameworks](frameworks.md) and its detailed framework guide.
2. Add compatible `wattpm` and capability dependencies only with permission.
3. Write `watt.config.*` directly. Do not invoke generators/import commands or add
   a second configuration. For a generic Node factory, an ESM example is:

```js
import { createNodeConfig } from '@platformatic/node'

export default createNodeConfig({
  main: './src/server.js',
  server: {
    hostname: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3000)
  }
})
```

4. Prefer `create()` returning Express/Fastify/Koa or a supported HTTP server. Retain
   standalone usage when needed. In-thread self-listening apps need a `close()` export
   or `registerCloseCallback()`; custom commands own their child-process cleanup.
5. Preserve original scripts/build transforms under clear names when introducing
   `wattpm dev`, `build`, `start`. Point config at real source or production output.
6. Document env names in `.env.example`, preserve `.env`, and ignore generated artifacts.

For NestJS, review the dedicated capability's setup contract: production may bypass
`main.ts`. For Koa, return the Koa instance rather than a raw callback. For generic
HTTP, return the server without listening twice. See the individual framework guides.

## Authorized validation

- Exercise development startup and a representative public endpoint.
- Build, then exercise production startup; do not skip framework compilation.
- Check DB/API integrations, internal mesh calls, auth, static assets, and SSR.
- Test shutdown/cleanup and missing/empty required env values.
- Probe a real health route, not an invented path. Watt does not rewrite conflicting ports.
- Report remaining gaps; a CLI version check is not integration validation.

## Next steps

- [Workers, caching, and profiling](performance.md)
- [Enterprise architecture](enterprise.md)
- [Docker deployment](deployment/docker.md)
- [Kafka integration](https://github.com/platformatic/skills/blob/main/skills/kafka/SKILL.md) — separate, externally distributed skill; do not rewrite it during Watt work.
