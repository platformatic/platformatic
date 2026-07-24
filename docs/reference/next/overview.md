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

Create a `watt.json` in the root folder of your application with the following contents:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.38.1.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

### Example with Image Optimizer mode (behind Gateway route matching)

Use this mode when you only need the `/_next/image` endpoint and want to expose it through a public Gateway.

In this setup:

- Gateway forwards only `GET /_next/image` to the optimizer service using `proxy.routes`
- all other routes can be forwarded to a regular frontend service
- relative image URLs (for example `/hero.png`) are fetched from the local fallback service via service discovery

`services/gateway/platformatic.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/gateway/4.0.0.json",
  "gateway": {
    "applications": [
      {
        "id": "optimizer",
        "proxy": {
          "prefix": "/",
          "routes": ["/_next/image"],
          "methods": ["GET"]
        }
      },
      {
        "id": "fallback",
        "proxy": {
          "prefix": "/"
        }
      }
    ]
  }
}
```

`services/optimizer/platformatic.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.38.1.json",
  "next": {
    "imageOptimizer": {
      "enabled": true,
      "fallback": "fallback"
    }
  }
}
```

## Architecture

Runtime-managed Next.js capabilities are exposed by default. Set `applications[].exposed` to `false` to keep the capability ITC-only. `applications[].portEnv`, which defaults to `PORT`, provides the fallback port when this capability's `server.port` is not configured. An application that uses the `commands` property is responsible for starting its own server.

## HTTPS

For development, configure HTTPS in this Next.js capability's `server.https` object:

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

The `server` object belongs in the capability configuration file, not in the Runtime or Watt root configuration.

Next.js does not support HTTPS in production mode with `next start`. To run a production Next.js application over HTTPS, terminate TLS before Watt or use a custom command/server that creates its own HTTPS server.

## Features

- **Image Optimizer**: Run a standalone image optimization service. See [Image Optimizer](./image-optimizer.md).

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
