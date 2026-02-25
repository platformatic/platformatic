---
title: Overview
label: Vinext
---

import SharedOverview from '../node/_shared-overview.md';

# Platformatic Vinext

The Platformatic Vinext capability allows running a [Vinext](https://github.com/cloudflare/vinext) application under Watt.

Vinext reimplements the Next.js API surface on top of Vite. The capability supports both:

- **App Router** projects (auto-detected via `app/` or `src/app/`)
- **Pages Router** projects

## Getting Started

Create or copy a Vinext application inside the `applications`, `services` or `web` folder. If you are not using [`autoload`](../runtime/configuration.md#autoload), add the application explicitly in the runtime configuration.

Then start Watt as usual with `wattpm dev` / `wattpm start`.

## Install

```bash
npm install @platformatic/vinext
```

## Example configuration file

Create a `watt.json` (or `platformatic.application.json`) in your frontend folder:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/vinext/2.0.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Notes on base paths

When using a non-root base path, keep Vite/Vinext base settings aligned with your routing setup (for example `base: '/frontend/'` and `basePath: '/frontend'`).

## Architecture

- In **development**, the capability starts a Vinext/Vite development server in a worker thread.
- In **production**, it builds with Vite/Vinext and starts Vinext production server logic.
- If you provide `application.commands`, those commands are used instead of default capability-managed startup/build flows.

## Configuration

See the [configuration](./configuration.md) page.

<SharedOverview/>
