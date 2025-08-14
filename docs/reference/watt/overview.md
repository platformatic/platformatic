---
title: Overview
label: Watt
---

import Issues from '../../getting-started/issues.md';

# Watt

Watt is the Node.js application server.

Watt allows you to run multiple Node.js applications that are managed centrally - we call them “services”.
Some are run inside worker threads, allowing faster startups and lower overhead, while others are executed as child processes to accommodate their complex start-up sequences.

## Features

- **Automatic multithreading**: Enable automatic multithreading with a single command, optimizing resource allocation without manual setup.
- **Comprehensive NFR management**: Abstract away tedious tasks like logging, tracing, and resource allocation, letting you manage non-functional requirements (NFRs) without the hassle.
- **Integrated OpenTelemetry tracing**: Gain deep insights into your app’s performance with built-in OpenTelemetry, enabling real-time monitoring of distributed services and pinpointing dependencies and bottlenecks.
- **Unified logging with Pino**: Implement a cohesive logging strategy using Pino, ensuring structured logging across all your Node.js apps and enabling you to track performance seamlessly.

## Installation

To install Watt, run the following command:

```bash
npm install -g wattpm
```

## Getting started

- For complete configuration and CLI details, see the [reference](./reference.md)
- To integrate with frontend frameworks, see the [Framework Integration Guides](/docs/guides/frameworks)

<Issues />
