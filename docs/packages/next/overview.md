---
title: Overview
label: Astro
---

import Issues from '../../getting-started/issues.md';

# Platformatic Next

The Platformatic Next allows to run a [Next](https://nextjs.org/) application as a Platformatic Runtime service with no modifications.

## Getting Started

Create or copy an Next application inside the `web` or `services` folder. If you are not using [`autoload`](../../runtime/configuration.md#autoload), you also have to explictly add the new service.

You are all set, you can now start your runtime as usual via `wattpm dev` or `plt start`.

## Example configuration file

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

## API

- **`platformatic.setBasePath(path)`**: This function can be use to override the base path for the service. If not properly configure in the composer, this can make your application unaccessible.
- **`platformatic.id`**: The id of the service.
- **`platformatic.root`**: The root directory of the service.
- **`platformatic.basePath`**: The base path of the service in the composer.
- **`platformatic.logLevel`**: The log level configured for the service.

<Issues />
