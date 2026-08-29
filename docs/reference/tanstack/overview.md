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

Create a `watt.config.ts` in the root folder of your application with the following contents:

```ts config
import { tanstack } from '@platformatic/tanstack'

export default tanstack({
  application: {
    basePath: '/frontend'
  },
  server: {
    port: Number(process.env.PORT ?? 3042)
  }
})
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

The TanStack capability owns its managed listener and uses its capability-level `server` configuration. An application that uses the `commands` property is responsible for starting its own server.

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
