![The Platformatic logo](https://github.com/platformatic/platformatic/raw/HEAD/assets/banner-light.png 'The Platformatic logo')

# Watt, the Node.js Application Server

[![npm](https://img.shields.io/npm/v/wattpm)](https://www.npmjs.com/package/wattpm)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/platformatic/platformatic/Node.js%20CI)](https://github.com/platformatic/platformatic/actions/workflows/ci.yml)

[Watt](https://platformatic.dev/watt), Platformatic's Node.js application server, allows you to run multiple Node.js applications (services) that are centrally managed.

By using Watt, you gain access to a virtual mesh network, fast logging via [Pino](https://getpino.io), 
monitoring through [Prometheus](https://prometheus.io/), and [OpenTelemetry](https://opentelemetry.io/) integrations.

Watt supports the stacks you love most, including [Next.js](https://nextjs.org), [Astro](https://astro.build/),
[Express](https://expressjs.com/), and [Fastify](https://fastify.dev).

## Install

```bash
# Create a new application
npx wattpm@latest init

# Or install manually:
npm install wattpm
```

Follow our [Quick Start Guide](https://platformatic.dev/docs/getting-started/quick-start-watt)
guide to get up and running with Platformatic.

## Documentation

- [Getting Started](https://docs.platformatic.dev/docs/getting-started/quick-start-watt)
- [Reference](https://platformatic.dev/docs/watt/overview)
- [Guides](https://platformatic.dev/docs/learn/overview)

Check out our full documentation at [platformatic.dev](https://platformatic.dev).

## Support

If you run into a bug, issues or have a suggestion for improvement, please raise an 
[issue on GitHub](https://github.com/platformatic/platformatic/issues/new) or join our [Discord feedback](https://discord.gg/platformatic) channel.

## License

[Apache 2.0](LICENSE)
