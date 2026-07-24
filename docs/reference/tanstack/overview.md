---
title: Overview
label: TanStack
---

import SharedOverview from '../node/\_shared-overview.md';

# Platformatic TanStack

The Platformatic TanStack allows to run a [TanStack Start](https://tanstack.com/start/) application as a Platformatic Runtime application with no modifications.

## Getting Started

Create or copy a TanStack Start application inside the `applications`, `services` or `web` folder. If you are not using [`autoload`](../runtime/configuration.md#autoload), you also have to explictly add the new application.

You are all set, you can now start your runtime as usual via `wattpm dev` or `wattpm start`.

## Install

```bash
npm install @platformatic/tanstack
```

## Example configuration file

Create a `watt.json` in the root folder of your application with the following contents:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/tanstack/3.30.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Preparing for production mode

Add the following to your `vite.config.ts` plugins section:

```javascript
process.env.NODE_ENV === 'production' &&
  nitro({
    preset: 'node-server',
    output: {
      dir: 'dist'
    }
  }),
```

## Architecture

Runtime-managed TanStack capabilities are exposed by default. Set `applications[].exposed` to `false` to keep the capability ITC-only. `applications[].portEnv`, which defaults to `PORT`, provides the fallback port when this capability's `server.port` is not configured. An application that uses the `commands` property is responsible for starting its own server.

## HTTPS

Configure HTTPS in this TanStack capability's `server.https` object. The `server` object belongs in the capability configuration file, not in the Runtime or Watt root configuration.

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

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
