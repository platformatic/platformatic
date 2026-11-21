---
title: Overview
label: React Router
---

import SharedOverview from '../node/\_shared-overview.md';

# Platformatic React Router

The Platformatic React Router allows to run a [React Router](https://reactrouter.com/) application as a Platformatic Runtime application with no modifications.

## Supported versions

Platformatic React Router supports [React Router](https://reactrouter.com/) 7 and 8.

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

If you want provide a custom entrypoint which will be used in `@react-router/node`, you need to make two configuration changes:

1. Point the Vite SSR build at your custom server entry. The following configuration works with React Router 7 and 8. For React Router 8, the Vite Environment API is always enabled and `build.rollupOptions.input` gated on `isSsrBuild` is ignored, so the input also has to be set under `environments.ssr.build.rollupOptions.input`. See [Migrating to React Router 8](#migrating-to-react-router-8).

   ```typescript
   import { getBasePath } from '@platformatic/globals'
   import { reactRouter } from '@react-router/dev/vite'
   import { defineConfig } from 'vite'
   import tsconfigPaths from 'vite-tsconfig-paths'

   export default defineConfig(({ isSsrBuild }) => ({
     base: getBasePath({ throwOnMissing: false }) ?? '/',
     // React Router 7
     build: {
       rollupOptions: isSsrBuild ? { input: './app/server.ts' } : undefined
     },
     // React Router 8
     environments: {
       ssr: {
         build: {
           rollupOptions: {
             input: './app/server.ts'
           }
         }
       }
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

## Migrating to React Router 8

When upgrading an application to React Router 8, follow the official [React Router upgrade guide](https://reactrouter.com/upgrading/v7).

React Router 8 requires Node.js 22.22 or later, React 19.2.7 or later, and Vite 7 or later. The `react-router-dom` package has been removed; import from `react-router` instead (use `react-router/dom` only for `RouterProvider` or `HydratedRouter`).

If you use a custom server whose Vite SSR input is set with `build.rollupOptions.input` conditioned on `isSsrBuild`, move that input to `environments.ssr.build.rollupOptions.input`. In React Router 8 the Vite Environment API is always on, so the old `isSsrBuild` input is ignored and a production command such as `node build/server/index.js` will not start a server. Keep both forms if you still need to support React Router 7, as shown in [Providing a custom entrypoint](#providing-a-custom-entrypoint).

## Skew protection

React Router uses a user-provided Vite configuration. To tag assets, add the shared plugin:

```ts
import { platformaticSkewPlugin } from '@platformatic/vite/skew-plugin'

export default defineConfig({
  plugins: [platformaticSkewPlugin()]
})
```

The plugin is enabled when `PLT_DEPLOYMENT_ID` is set during the build.

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
