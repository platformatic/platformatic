import Issues from '../../getting-started/issues.md';

# Configuration

Platformatic NestJS is configured with a configuration file. It supports the use
of environment variables as setting values with [configuration placeholders](#configuration-placeholders).

## `application`

Supported object properties:

- **`basePath`**: Service proxy base path when exposing this application in a [gateway](../gateway/configuration.md) when setting the `proxy` property. If not specified, the application will be exposed on the `/$ID` (where `$ID` is the application ID) id or a value specified in the application code via `platformatic.setBasePath()`.
- **`outputDirectory`**: The subdirectory where production build is stored at when using `wattpm build` or `plt build`. The default is `dist`.
- **`include`**: The paths to include when deploying the application. The default is `['dist']`.
- **`commands`**: An object specifying the commands to manage the application instead of using the NestJS defaults. Supported commands are:
  - **`install`**: The command to execute to install the application dependencies. The default is `npm ci --omit-dev`.
  - **`build`**: The command to execute to build the application.
  - **`development`**: The command to execute to start the application in development mode.
  - **`production`**: The command to execute to start the application in production mode.

## `logger`

Configures the `logger`, see the [runtime](../runtime/configuration.md#logger) documentation.

## `server`

Configures the HTTP server, see the [runtime](../runtime/configuration.md#server) documentation.

## `watch`

Manages watching of the application, see the [application](../service/configuration.md#watch) documentation.

Supported object properties:

- **`adapter`**: The adapter to use. The only supported value is `valkey` (of which `redis` is a synonym).
- **`url`**: The URL of the Valkey/Redis server.
- **`prefix`**: The prefix to use for all cache keys.
- **`maxTTL`**: The maximum life of a server key, in seconds. If the Next.js `revalidate` value is greater than this value, then
  the adapter will refresh the key expire time as long as it is accessed every `maxTTL` seconds. The default value is `604800` (one week).

## `nest`

Configures NestJS. Supported object properties:

- **`adapter`**: Chooses which HTTP adapter to use. Supported values are `express` (the default) or `fastify`.
- **`appModule`**: The application module to bootstrap. This option is ignored when running in development mode.
  Supported properties are:
  - **`path`**: The path of the application module, without any extension. The default is `app.module`.
  - **`name`**: The name of the exported class. The default is `AppModule`.
- **`setup`**: The setup file used to perform application customizations before starting it. See section below for more information. This option is only used when running in production mode without custom commands. Supported properties are:
  - **`path`**: The path of the setup file, without any extension.
  - **`name`**: The name of the exported class. The default is to use the default export.

# Migrate application setup

`@platformatic/nest` will ignore your `main.ts` file when running in production mode an no `application.commands.production` value is provided.

If your `main.ts` looked like this one (the default one created by `nest create`), you are good to go:

```typescript
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
```

If, instead, you had some custom logic between the application creation and and the `listen` invocation, then you will have to extract in another file otherwise it will not be executed.

For instance, let's say your `main.ts` looked like this one:

```typescript
// original main.ts

import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalApiPrefix('/api')

  await app.listen(process.env.PORT ?? 3000)
}

bootstrap()
```

Then you will have to create a `setup.ts` like this one:

```typescript
// setup.ts

export function setupApplication(app) {
  app.setGlobalApiPrefix('/api')
}
```

And modify `main.ts` to look like this:

```typescript
// new main.ts

import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { setupApplication } from './setup'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  setupApplication(app)

  await app.listen(process.env.PORT ?? 3000)
}

bootstrap()
```

Then, modify the `watt.json` file like this:

```javascript
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/nest/2.66.0.json",
  // ...
  "nest": {
    // ...
    "setup": {
      "path": "setup",
      "name": "setupApplication
    }
  }
}
```

<Issues />
