---
title: Overview
label: NestjS
---

import SharedOverview from '../node/\_shared-overview.md';

# Platformatic NestJS

The Platformatic NestJS allows to run a [NestJS](https://nestjs.com/) application as a Platformatic Runtime service with no modifications.

## Getting Started

Create or copy a NestJS application inside the `web` or `services` folder. If you are not using [`autoload`](../../runtime/configuration.md#autoload), you also have to explictly add the new service.

You are all set, you can now start your runtime as usual via `wattpm dev` or `wattpm start`.

## Install

```bash
npm install @platformatic/nest
```

## Example configuration file

Create a `watt.json` in the root folder of your service with the following contents:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/nest/2.66.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Architecture

When starting NestJS in development mode, production mode or by using the `commands` property, Platformatic will choose a random port for the HTTP server and it will override any user or application setting.

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
