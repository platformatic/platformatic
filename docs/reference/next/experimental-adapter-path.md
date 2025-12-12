import Issues from '../../getting-started/issues.md';

# Using Next.js Experimental adapterPath

Starting from Next.js 16, you can use the [experimental `adapterPath`](https://nextjs.org/docs/app/api-reference/config/next-config-js/adapterPath) feature to integrate Platformatic Next with your Next.js application. This provides a cleaner integration compared to the default method.

## What is adapterPath?

The `adapterPath` is a Next.js experimental feature that allows you to specify a custom adapter module that hooks into the Next.js build process. Adapters can modify the Next.js configuration and execute custom logic after the build completes, making them ideal for platform integrations like Platformatic.

## Benefits

Using the experimental adapter path provides several advantages:

- **Cleaner integration**: No need for Platformatic to automatically patch your `next.config.js` file
- **Explicit configuration**: You have full visibility and control over how Platformatic integrates with Next.js
- **Official Next.js feature**: Uses Next.js's official extension mechanism rather than workarounds

## Requirements

- Next.js 16.0 or higher
- `@platformatic/next` package installed

## Setup

### 1. Update your platformatic.json

Enable the experimental adapter in your Platformatic Next configuration file:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.30.0.json",
  "next": {
    "useExperimentalAdapter": true
  }
}
```

### 2. Configure your next.config.js

Import and configure the Platformatic adapter in your `next.config.js`, `next.config.mjs` or `next.config.ts` file:

**For ESM (next.config.mjs or next.config.ts):**

```js
import { getAdapterPath } from '@platformatic/next'

const nextConfig = {
  experimental: {
    adapterPath: getAdapterPath()
  }
}

export default nextConfig
```

**For CommonJS (next.config.js):**

```js
const { getAdapterPath } = require('@platformatic/next')

module.exports = {
  experimental: {
    adapterPath: getAdapterPath()
  }
}
```

## Troubleshooting

### Warning about adapter not being included

If you see a warning like:

```
The experimental Next.js adapterPath is enabled but the @platformatic/next adapter was not included.
```

This means:

- You have `useExperimentalAdapter: true` in your `platformatic.json`
- But your `next.config.js` doesn't include the `adapterPath` configuration

**Solution**: Add the adapter configuration to your `next.config.js` as shown in step 2 above.

<Issues />
