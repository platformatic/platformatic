---
title: Overview
label: Next.js
---

import SharedOverview from '../node/\_shared-overview.md';

# Platformatic Next

The Platformatic Next allows to run a [Next](https://nextjs.org/) application as a Platformatic Runtime service with no modifications.

## Getting Started

Create or copy an Next application inside the `web` or `services` folder. If you are not using [`autoload`](../../runtime/configuration.md#autoload), you also have to explictly add the new service.

You are all set, you can now start your runtime as usual via `wattpm dev` or `wattpm start`.

## Install

```bash
npm install @platformatic/next
```

## Example configuration file

Create a `watt.json` in the root folder of your service with the following contents:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/2.0.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Architecture

When starting Next.js in development mode, production mode or by using the `commands` property, Platformatic will choose a random port for the HTTP server and it will override any user or application setting.

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
