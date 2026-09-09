---
title: Overview
label: Next.js
---

import SharedOverview from '../node/\_shared-overview.md';

# Platformatic Next

Platformatic Next allows you to run a [Next.js](https://nextjs.org/) application as a Platformatic Runtime application with no modifications. It also provides additional features such as an Image Optimizer mode for optimizing images on-the-fly.

## Getting Started

Create or copy a Next.js application inside the `applications`, `services`, or `web` folder. If you are not using [`autoload`](../runtime/configuration.md#autoload), you also need to explicitly add the new application.

You are all set: start your runtime as usual via `wattpm dev` or `wattpm start`.

## Install

```bash
npm install @platformatic/next
```

## Example configuration file

Create a `watt.config.ts` in the root folder of your application with the following contents:

```ts config
import { next } from '@platformatic/next'

export default next({
  application: {
    basePath: '/frontend'
  },
  server: {
    port: Number(process.env.PORT ?? 3042)
  }
})
```

### Example with Image Optimizer mode (behind Gateway route matching)

Use this mode when you only need the `/_next/image` endpoint and want to expose it through a public Gateway.

In this setup:

- Gateway forwards only `GET /_next/image` to the optimizer service using `proxy.routes`
- all other routes can be forwarded to a regular frontend service
- relative image URLs (for example `/hero.png`) are fetched from the local fallback service via service discovery

`web/gateway/watt.config.ts`:

```ts config
import { gateway } from '@platformatic/gateway'

export default gateway({
  gateway: {
    applications: [
      {
        id: 'optimizer',
        proxy: {
          prefix: '/',
          routes: ['/_next/image'],
          methods: ['GET']
        }
      },
      {
        id: 'fallback',
        proxy: {
          prefix: '/'
        }
      }
    ]
  }
})
```

`web/optimizer/watt.config.ts`:

```ts config
import { next } from '@platformatic/next'

export default next({
  next: {
    imageOptimizer: {
      enabled: true,
      fallback: 'fallback'
    }
  },
  server: {
    port: Number(process.env.PORT ?? 3042)
  }
})
```

## Architecture

The Next.js capability owns its managed listener and uses its capability-level `server` configuration. An application that uses the `commands` property is responsible for starting its own server.

## HTTPS

For development, configure HTTPS in this Next.js capability's `server.https` object:

```ts config
import { next } from '@platformatic/next'

export default next({
  server: {
    port: Number(process.env.PORT ?? 3042),
    https: {
      key: { path: './certs/server.key' },
      cert: { path: './certs/server.crt' }
    }
  }
})
```

The `server` object belongs in the capability configuration file, not in the Runtime or Watt root configuration.

Next.js does not support HTTPS in production mode with `next start`. To run a production Next.js application over HTTPS, terminate TLS before Watt or use a custom command/server that creates its own HTTPS server.

## Features

- **Image Optimizer**: Run a standalone image optimization service. See [Image Optimizer](./image-optimizer.md).

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
