---
title: Overview
label: Remix
---

import SharedOverview from '../node/\_shared-overview.md';

# Platformatic Remix

The Platformatic Remix allows to run a [Remix](https://remix.run/) application as a Platformatic Runtime application with no modifications.

## Getting Started

Create or copy a Remix application inside the `applications`, `services` or `web` folder. If you are not using [`autoload`](../runtime/configuration.md#autoload), you also have to explictly add the new application.

You are all set, you can now start your runtime as usual via `wattpm dev` or `wattpm start`.

## Install

```bash
npm install @platformatic/remix
```

## Example configuration file

Create a `watt.json` in the root folder of your application with the following contents:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/remix/4.0.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Architecture

When running in development mode, the Vite development server instrumented with [@remix-run/dev](https://www.npmjs.com/package/@remix-run/dev) runs in a worker thread in the same process as the Platformatic runtime.

When running in production mode, a custom Fastify server serves the built application in a worker thread. The runtime-managed server is exposed by default; set `applications[].exposed` to `false` to keep it ITC-only. `applications[].portEnv`, which defaults to `PORT`, provides the fallback port when this capability's `server.port` is not configured.

In both modes, an application that uses the `commands` property is responsible for starting its HTTP server.

## HTTPS

Configure HTTPS in this Remix capability's `server.https` object. The `server` object belongs in the capability configuration file, not in the Runtime or Watt root configuration.

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

### Using custom commands

Due to [`CVE-2025-24010`](https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6), you need to set:

```js
{
  ...
  "server": {
    "allowedHosts": [".plt.local"]
  }
}
```

This will allow other applications inside the platformatic mesh network to contact your Vite server.

## Using behind a Platformatic Gateway

When exposing the application through a Platformatic Gateway, adjust your `vite.config.ts` file to
properly set the Vite's `base` property and the `remix.basename` property as follows:

```js
import { vitePlugin as remix } from '@remix-run/dev'
import { defineConfig } from 'vite'
import { getBasePath } from '@platformatic/globals'

export default defineConfig({
  base: getBasePath({ throwOnMissing: false }) ?? '/',
  /* ... */
  plugins: [
    remix({
      basename: getBasePath({ throwOnMissing: false }) ?? '/'
      /* ... */
    })
  ]
})
```

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
