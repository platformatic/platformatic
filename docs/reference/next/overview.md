---
title: Overview
label: Next.js
---

import SharedOverview from '../node/_shared-overview.md';

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

### Example with Image Optimizer mode

Use this mode when you only need the `/_next/image` endpoint and do not want to run a full Next.js application for that service.

In this example:

- requests are served under `/frontend/_next/image` because `application.basePath` is set
- relative image URLs (for example `/hero.png`) are fetched from the local `backend` service
- absolute image URLs are fetched directly

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.38.1.json",
  "application": {
    "basePath": "/frontend"
  },
  "next": {
    "imageOptimizer": {
      "enabled": true,
      "fallback": "backend"
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
