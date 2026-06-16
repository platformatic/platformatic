---
title: Overview
label: React Router
---

import SharedOverview from '../node/\_shared-overview.md';

# Platformatic React Router

The Platformatic React Router allows to run a [React Router](https://reactrouter.com/) application as a Platformatic Runtime application with no modifications.

## Getting Started

Create or copy a React Router Start application inside the `applications`, `services` or `web` folder. If you are not using [`autoload`](../runtime/configuration.md#autoload), you also have to explictly add the new application.

You are all set, you can now start your runtime as usual via `wattpm dev` or `wattpm start`.

## Install

```bash
npm install @platformatic/react-router
```

## Example configuration file

Create a `watt.json` in the root folder of your application with the following contents:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/react-router/3.30.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Using when the entrypoint is a Platformatic Gateway

To properly work when using with in application where the entrypoint is a Platformatic Gateway, you need to adjust your `react-router.config.ts` file to use the Platformatic base path:

```typescript
import type { Config } from '@react-router/dev/config'
import { getBasePath } from '@platformatic/globals'

export default {
  basename: getBasePath({ throwOnMissing: false }) ?? '/'
  ssr: true
} satisfies Config
```

You also need to adjust the `base` option in your `vite.config.ts`:

```typescript
import { getBasePath } from '@platformatic/globals'
import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  base: getBasePath({ throwOnMissing: false }) ?? '/',
  plugins: [reactRouter(), tsconfigPaths()]
})
```

## Providing a custom entrypoint

If you want provide a custom entrypoint which will be used in `@react-router/node`, you need to make three configuration changes:

1. Modify your Vite configuration to properly handle SSR builds by making it dependent on the SSR flags:

   ```typescript
   import { getBasePath } from '@platformatic/globals'
   import { reactRouter } from '@react-router/dev/vite'
   import { defineConfig } from 'vite'
   import tsconfigPaths from 'vite-tsconfig-paths'

   export default defineConfig(({ isSsrBuild }) => ({
     base: getBasePath({ throwOnMissing: false }) ?? '/',
     build: {
       rollupOptions: isSsrBuild ? { input: './app/server.ts' } : undefined
     },
     plugins: [reactRouter(), tsconfigPaths()],
     server: {
       fs: {
         strict: false
       },
       allowedHosts: ['.plt.local']
     }
   }))
   ```

2. Create an `app/server.ts` file that exports an `entrypoint` variable:

   ```typescript
   export const entrypoint = import('virtual:react-router/server-build')
   ```

   This file serves as the SSR entrypoint for the server build and is referenced in the Vite configuration.

## Architecture

When starting React Router in development mode, production mode or by using the `commands` property, Platformatic will choose a random port for the HTTP server and it will override any user or application setting.

## HTTPS

When a React Router application is the Watt entrypoint, configure HTTPS in the runtime `server.https` object:

```json
{
  "server": {
    "https": {
      "key": { "path": "./certs/server.key" },
      "cert": { "path": "./certs/server.crt" }
    }
  }
}
```

In development mode, Platformatic forwards the HTTPS options to the Vite development server used by React Router. In production mode, Platformatic uses the same HTTPS options for the Fastify server that serves SSR applications, or for the static server used by non-SSR builds.

If the application uses `application.commands`, the command is responsible for creating its own HTTPS server.

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
