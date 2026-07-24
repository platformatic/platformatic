---
title: Overview
label: NestjS
---

import SharedOverview from '../node/\_shared-overview.md';

# Platformatic NestJS

The Platformatic NestJS allows to run a [NestJS](https://nestjs.com/) application as a Platformatic Runtime application with no modifications.

## Getting Started

Create or copy a NestJS application inside the `applications`, `services` or `web` folder. If you are not using [`autoload`](../runtime/configuration.md#autoload), you also have to explictly add the new application.

You are all set, you can now start your runtime as usual via `wattpm dev` or `wattpm start`.

## Install

```bash
npm install @platformatic/nest
```

## Example configuration file

Create a `watt.json` in the root folder of your application with the following contents:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/nest/2.66.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Architecture

Runtime-managed NestJS capabilities are exposed by default. Set `applications[].exposed` to `false` to keep the capability ITC-only. `applications[].portEnv`, which defaults to `PORT`, provides the fallback port when this capability's `server.port` is not configured. An application that uses the `commands` property is responsible for starting its own server.

## HTTPS

Configure HTTPS in this NestJS capability's `server.https` object. The `server` object belongs in the capability configuration file, not in the Runtime or Watt root configuration.

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
