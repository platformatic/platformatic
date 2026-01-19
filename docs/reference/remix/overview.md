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
  "$schema": "https://schemas.platformatic.dev/@platformatic/remix/2.0.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Architecture

When running in development mode, the Vite development server instrumented with [@remix-run/dev](https://www.npmjs.com/package/@remix-run/dev) is run a in worker thread in the same process of the Platformatic runtime. The server port is chosen randomly and it will override any user setting.

When running in production mode, a custom Fastify server will serve the built application. The application is run a in worker thread in the same process of the Platformatic runtime and it will not start a TCP server unless it's the runtime entrypoint.

In both modes if the application uses the `commands` property then it's responsible to start a HTTP server. The Platformatic runtime will modify the server port replacing it with a random port and then it will integrate the external application in the runtime.

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

## Using when the entrypoint is a Platformatic Gateway

To properly work when using with in application where the entrypoint is a Platformatic Gateway, you need to adjust your `vite.config.ts` file to
properly set the Vite's `base` property and the `remix.basename` property as follows:

```js
import { vitePlugin as remix } from '@remix-run/dev'
import { defineConfig } from 'vite'
import { getGlobal } from '@platformatic/globals'

export default defineConfig({
  base: getGlobal().basePath ?? '/',
  /* ... */
  plugins: [
    remix({
      basename: getGlobal().basePath ?? '/'
      /* ... */
    })
  ]
})
```

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
