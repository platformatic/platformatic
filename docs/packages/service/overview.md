---
title: Overview
label: Platformatic Service
---

import Issues from '../../getting-started/issues.md';

# Platformatic Service

Platformatic Service is an HTTP server that provides a developer tools for
building robust APIs with Node.js.

For a high level overview of how Platformatic Service works, please reference the
[Overview](../Overview.md) guide.

## Features

- Command-line interface: [`platformatic service`](../cli.md)
- Add custom functionality in a [Fastify plugin](./plugin.md)
- Write plugins in JavaScript or [TypeScript](../cli.md#compile)
- Start Platformatic Service [programmatically](./programmatic.md) in tests or other applications
- Fully typed

## Issues

If you run into a bug or have a suggestion for improvement, please
[raise an issue on GitHub](https://github.com/platformatic/platformatic/issues/new).

## Standalone usage

If you're only interested in the features available in Platformatic Service, you can simply switch `platformatic` with `@platformatic/service` in the `dependencies` of your `package.json`, so that you'll only import fewer deps.

You can use the `plt-service` command, it's the equivalent of `plt service`.

## TypeScript

To generate the types for the application, run `platformatic db types`.

<Issues />
