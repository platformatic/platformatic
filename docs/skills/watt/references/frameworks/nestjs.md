# NestJS with Watt 4

Detect `nest-cli.json` or `@nestjs/core`. The dedicated capability is **`@platformatic/nest`**.
An existing generic `@platformatic/node` integration can remain when intentionally needed;
do not silently change its bootstrap contract. Install compatible Watt 4 dependencies only
with authorization.

## Configuration

ESM `watt.config.ts`:

```ts
import { createNestConfig } from '@platformatic/nest'

export default createNestConfig({
  server: { port: Number(process.env.PORT || 3000) },
  nest: {
    adapter: 'express',
    setup: { path: './setup', name: 'setupApplication' }
  }
})
```

Use `adapter: 'fastify'` only when the app already uses or requests that adapter. Point
`nest.appModule`/output settings at the actual compiled module; monorepo output is not
always `dist/main.js`. Keep decorators, DI, and Nest compilation; native type stripping
cannot replace it. Build before `wattpm start`.

## Preserve bootstrap customizations

Without a custom production command, the dedicated capability creates the app from
`AppModule` and **does not run `main.ts`** in production. Move global pipes, prefixes,
CORS, Swagger, and other setup into a shared setup module called by both paths.

`setup.ts` (compiled by the existing Nest build):

```ts
import { ValidationPipe } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'

export function setupApplication (app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.enableCors()
  app.setGlobalPrefix('api')
}
```

Existing `main.ts` can retain standalone/development startup:

```ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { setupApplication } from './setup.js'

async function bootstrap (): Promise<void> {
  const app = await NestFactory.create(AppModule)
  setupApplication(app)
  await app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1')
}

await bootstrap()
```

Adapt imports and top-level startup to the project's existing module convention.
Ensure the setup file lands in the output where the capability expects it. Do not
add a second `listen()` to the setup callback.

## Build, health, and environment

- Preserve `nest build`, optional SWC (`@swc/cli`, `@swc/core`), and `nest-cli` assets/watch settings.
- For monorepos, preserve project-targeted builds and actual `dist/apps/<name>` output.
- Use `@nestjs/terminus` health routes only when implemented; configure probes against
  their actual prefixed path, not an invented `/health`.
- Keep `@nestjs/config` and existing env loading. Listener values in configuration must
  be read explicitly; the runtime does not inject `PORT`.
- Preserve Swagger setup and DB connection lifecycle in the shared setup/module hooks.

## Shutdown

Use managed Nest lifecycle hooks for owned resources. For custom commands/standalone
listeners, inspect [shutdown](https://docs.platformatic.dev/docs/reference/runtime/shutdown)
and use awaited `registerCloseCallback()` where appropriate; exported Node factories
are not automatically invoked in child-process command mode. Avoid duplicate cleanup.

## Common issues

- Production lost validation/auth/prefix: inspect shared setup; `main.ts` may be bypassed.
- Build output not found: inspect actual app module, project build, and output directory.
- Watch broken: retain Nest CLI/watch-assets configuration.
- Port conflict: inspect the owning listener rather than assuming automatic reassignment.

See [Nest configuration](https://docs.platformatic.dev/docs/reference/nest/configuration).
