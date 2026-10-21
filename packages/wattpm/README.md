![The Platformatic logo](https://github.com/platformatic/platformatic/raw/HEAD/assets/banner-light.png)

# Watt, the Application Server for Node.js

[![npm](https://img.shields.io/npm/v/wattpm)](https://www.npmjs.com/package/wattpm)
[![CI](https://github.com/platformatic/platformatic/actions/workflows/ci.yml/badge.svg)](https://github.com/platformatic/platformatic/actions/workflows/ci.yml)
[![NPM version](https://img.shields.io/npm/v/platformatic.svg?style=flat)](https://www.npmjs.com/package/platformatic)

Watt, Platformatic's Node.js application server, allows you to run multiple Node.js applications that are centrally managed.

By using Watt, you gain access to a virtual mesh network, fast logging via [Pino](https://getpino.io/),
monitoring through [Prometheus](https://prometheus.io/), and [OpenTelemetry](https://opentelemetry.io/) integrations.

Watt supports the stacks you love most, including [Next.js](https://nextjs.org/), [Astro](https://astro.build/),
[Express](https://expressjs.com/), and [Fastify](https://fastify.dev/).

## Install

```bash
# Create a new application
npx wattpm@latest create

# Or install manually:
npm install wattpm
```

Follow our [Quick Start Guide](https://docs.platformatic.dev/docs/getting-started/quick-start)
to get up and running with Watt.

## Agent instructions

Starting with Watt 3.74.0, the local CLI exposes release-matched instructions offline:

```bash
wattpm skill
wattpm skill references/frameworks/nextjs.md
```

Use the project's installed binary for every read. Relative Markdown links resolve
against the current document inside the bundle. See the
[AI agent guide](https://docs.platformatic.dev/docs/guides/use-watt-with-ai-agents).
Watt 3's existing scaffolding and import commands remain supported.

## Documentation

- [Quick Start](https://docs.platformatic.dev/docs/getting-started/quick-start)
- [Running Your Project in Watt](https://docs.platformatic.dev/docs/getting-started/port-your-app)
- [Reference](https://docs.platformatic.dev/docs/reference/wattpm/overview)
- [Guides](https://docs.platformatic.dev/docs/guides/build-modular-monolith)

Check out our full documentation at [platformatic.dev](https://platformatic.dev).

## Support

If you run into a bug, issues or have a suggestion for improvement, please raise an
[issue on GitHub](https://github.com/platformatic/platformatic/issues/new).

## License

[Apache 2.0](../../LICENSE)
