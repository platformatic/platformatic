---
title: Overview
label: Vite
---

import SharedOverview from '../node/\_shared-overview.md';

# Platformatic Vite

The Platformatic Vite allows to run a [Vite](https://vitejs.dev/) application as a Platformatic Runtime service with no modifications.

## Getting Started

Create or copy a Vite application inside the `web` or `services` folder. If you are not using [`autoload`](../../runtime/configuration.md#autoload), you also have to explictly add the new service.

You are all set, you can now start your runtime as usual via `wattpm dev` or `wattpm start`.

## Install

```bash
npm install @platformatic/vite
```

## Example configuration file

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/vite/2.0.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Architecture

When running in development mode, the Vite development server is run a in worker thread in the same process of the Platformatic runtime. The server port is chosen randomly and it will override any user setting.

When running in production mode, a custom Fastify server will serve the built application. The service is run a in worker thread in the same process of the Platformatic runtime and it will not start a TCP server unless it's the runtime entrypoint.

In both modes if the service uses the `commands` property then it's responsible to start a HTTP server. The Platformatic runtime will modify the server port replacing it with a random port and then it will integrate the external service in the runtime.

If the application is a SSR application, it is only supported if using [`@fastify/vite`](https://fastify-vite.dev/).

### Using custom commands and @fastify/vite

Due to [`CVE-2025-24010`](https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6), you need to set:

```js
{
  ...
  "server": {
    "allowedHosts": [".plt.local"]
  }
}
```

This will allow other services inside the platformatic mesh network to contact your Vite server.

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
