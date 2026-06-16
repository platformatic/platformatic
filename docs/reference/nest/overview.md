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

When starting NestJS in development mode, production mode or by using the `commands` property, Platformatic will choose a random port for the HTTP server and it will override any user or application setting.

## HTTPS

When a NestJS application is the Watt entrypoint, configure HTTPS in the runtime `server.https` object:

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

In production mode, Platformatic passes the HTTPS options to the configured NestJS adapter. Both the Fastify and Express adapters are supported.

In development mode, Platformatic runs the Nest CLI. If the application uses the CLI or `application.commands`, the command is responsible for creating its own HTTPS server.

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
