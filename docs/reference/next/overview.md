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

Use this mode when you only need the `/_next/image` endpoint and want to expose it through a Gateway entrypoint.

In this setup:

- Gateway forwards only `GET /_next/image` to the optimizer service using `proxy.routes`
- all other routes can be forwarded to a regular frontend service
- relative image URLs (for example `/hero.png`) are fetched from the local fallback service via service discovery

`services/gateway/platformatic.json`:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/gateway/3.0.0.json",
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

When starting Next.js in development mode, production mode, or by using the `commands` property, Platformatic selects a random internal port for the Next.js HTTP server and overrides any user or application setting.

## Features

- **Image Optimizer**: Run a standalone image optimization service. See [Image Optimizer](./image-optimizer.md).

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
