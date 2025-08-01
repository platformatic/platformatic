# Compiling Typescript for Deployment

[Platformatic Service](../../packages/service/overview.md), Composer, and DB provide automatic TypeScript compilation during the startup
of your Node.js server. While this provides an amazing developer experience, in production it adds additional
start time, and it requires more resources. In this guide, we show how to compile your TypeScript
source files before shipping to a server.

## Setup

The following is supported by all Platformatic applications, as they are all based on the same [plugin system](../../packages/service/plugin.md).
If you have generated your application using `npx wattpm create`, you will have a similar section in your config file:

```json
{
  ...
  "plugins": {
    "paths": [{
      "path": "plugins",
      "encapsulate": false
    }, "routes"],
    "typescript": "{PLT_TYPESCRIPT}"
  }
}
```

Note that the `{PLT_TYPESCRIPT}` will be automatically replaced with the `PLT_TYPESCRIPT` environment variable, that is configured in your
`.env` (and `.env.sample`) file:

```
PLT_TYPESCRIPT=true
```

Older Platformatic applications might not have the same layout, if so you can update your settings to match (after updating your dependencies).

## Avoid shipping TypeScript sources

If you want to avoid shipping the TypeScript sources you need to configure Platformatic with the location
where your files have been built by adding an `outDir` option:

```json
{
  ...
  "plugins": {
    "paths": [{
      "path": "plugins",
      "encapsulate": false
    }, "routes"],
    "typescript": {
      "enabled": "{PLT_TYPESCRIPT}",
      "outDir": "dist"
    }
  }
}
```

This is not necessary if you include `tsconfig.json` together with the compiled code.
