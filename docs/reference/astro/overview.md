---
title: Overview
label: Astro
---

import SharedOverview from '../node/_shared-overview.md';

# Platformatic Astro

The Platformatic Astro allows to run an [Astro](https://astro.build/) application as a Platformatic Runtime application with no modifications.

## Getting Started

Create or copy an Astro application inside the `application`, `services` or `web` folder. If you are not using [`autoload`](../runtime/configuration.md#autoload), you also have to explictly add the new application.

You are all set, you can now start your runtime as usual via `wattpm dev` or `wattpm start`.

## Example configuration file

Create a `watt.json` in the root folder of your application with the following contents:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/astro/4.0.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Architecture

When running in development mode, the Astro Vite development server runs in a worker thread in the same process as the Platformatic runtime.

When running in production mode, a custom Fastify server serves the static or dynamic (for SSR) application in a worker thread. The runtime-managed server is exposed by default; set `applications[].exposed` to `false` to keep it ITC-only. `applications[].portEnv`, which defaults to `PORT`, provides the fallback port when this capability's `server.port` is not configured.

In both modes, an application that uses the `commands` property is responsible for starting its HTTP server.

## HTTPS

Configure HTTPS in this Astro capability's `server.https` object. The `server` object belongs in the capability configuration file, not in the Runtime or Watt root configuration.

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
  "vite": {
    "server": {
      "allowedHosts": [".plt.local"]
    }
  }
}
```

This will allow other applications inside the platformatic mesh network to contact your Vite server.

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
