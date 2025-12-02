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

When starting TanStack in development mode, production mode or by using the `commands` property, Platformatic will choose a random port for the HTTP server and it will override any user or application setting.

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
