<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="assets/banner-light.png">
  <img alt="The Platformatic logo" src="assets/banner-light.png">
</picture>

</div>

<div align="center">

[![CI](https://github.com/platformatic/platformatic/actions/workflows/ci.yml/badge.svg)](https://github.com/platformatic/platformatic/actions/workflows/ci.yml)
[![Documentation](https://github.com/platformatic/platformatic/actions/workflows/update-docs.yml/badge.svg)](https://github.com/platformatic/platformatic/actions/workflows/update-docs.yml)
[![NPM version](https://img.shields.io/npm/v/platformatic.svg?style=flat)](https://www.npmjs.com/package/platformatic)
[![Discord](https://img.shields.io/discord/1011258196905689118)](https://discord.gg/platformatic)

</div>

<h1 align="center">
  <br/>
  Watt - The Node.js Application Server
  <br/>
</h1>

<div align="center">

Watt takes any Node.js application, written in any framework, and runs it as a worker thread so you can ship faster and scale smarter in any containerized environment.

</div>
<br/>

## What problems was Watt built to solve?

#### Speed and Stability at Scale

When run as a single-thread, Node.js fails to efficiently consume the CPU allocated to it, causing the event-loop to become blocked during periods of heavy traffic, which leads to spikes in latency and crashes.

Even worse, because that single thread is also responsible for all your key telemetry data, you lose critical observability when your application crashes, leaving teams in the dark when troubleshooting performance issues. 

Finally, container orchestrators don’t measure the metrics that actually matter for scaling Node.js, which means new pods aren’t scaled up until it’s already too late, forcing teams to drastically over-provision critical services or risk downtime.

## Why Watt?

#### Faster, better, stronger

Using Watt to run your app(s) brings the following advantages: 

**⚡ Radically More Performant:** take advantage of multiple CPU cores with Watt’s multi-threaded architectures to run your apps [up to 93% faster](https://blog.platformatic.dev/93-faster-nextjs-in-your-kubernetes)

**⚖️ Stability at Scale** Watt auto-heals and scales worker threads in seconds, keeping latency low and users happy, even at p95 and above 

👁️ **Built-in Observability**: out-of-the-box logging, metrics, tracing, performance profiling (for [memory](https://blog.platformatic.dev/announcing-heap-profiling-support-in-platformaticflame-and-watt-runtime) and [CPU](https://blog.platformatic.dev/introducing-next-gen-flamegraphs-for-nodejs)), and health checks, all managed outside of your worker threads so you don’t lose valuable data if your app crashes

**🫂 Microservice Consolidation:** run services that are frequently orchestrated together (think BFFs, microfrontends) all in the same process, eliminating costly network calls that add complexity and degrade performance. 

🧱 Composable Architecture \- HTTP services, API composers, frontend frameworks, and data services

🧩 Framework Integration \- Works with Next.js, Astro, Remix, Vite, NestJS, and plain Node.js.

📦 Production Ready \- Docker deployment, environment configuration, and scaling built-in.

🧷 TypeScript First \- Full type safety with auto-generated types and SDK.

## Quick Start (2 minutes)

Get your first Watt application running in under 2 minutes:

```bash
npm install -g wattpm
npx wattpm create my-first-app
cd my-first-app && npm start
```

Your application will be running at `http://localhost:3042` with auto-generated REST and GraphQL APIs.

## Choose Your Learning Path

### 👋 New to Node.js?

**Start Here:** [What is Watt?](https://docs.platformatic.dev/docs/Overview) → [Beginner Tutorial](https://docs.platformatic.dev/docs/learn/beginner/crud-application)  
Build a complete Todo API from scratch in 30 minutes with step-by-step guidance.

### ⚡ Experienced Developer?

**Jump In:** [Quick Start](https://docs.platformatic.dev/docs/getting-started/quick-start) → [Architecture Overview](https://docs.platformatic.dev/docs/Overview)  
Get running in 5 minutes, then dive into advanced patterns and integrations.

### 🔄 Migrating Existing Apps?

**Migrate:** [Port Your App](https://docs.platformatic.dev/docs/getting-started/port-your-app) → [Integration Guides](https://docs.platformatic.dev/docs/guides/frameworks)  
Add Watt to your existing Express, Fastify, or Next.js applications.

---

## Documentation Structure

### 📖 [Overview](https://docs.platformatic.dev/docs/Overview)

Understand what Watt is, why it exists, and how it fits your needs

### 🛠️ [How-to Guides](https://docs.platformatic.dev/docs/guides)

Solve specific problems with framework integration, deployment, and production setup

### 📋 [Reference](https://docs.platformatic.dev/docs/reference)

Complete technical specifications for CLI, configuration, and APIs

## Get Support

📖 **Documentation**: [docs.platformatic.dev](https://docs.platformatic.dev)  
💬 **Community**: [Discord](https://discord.gg/platformatic)  
🐛 **Issues**: [GitHub Issues](https://github.com/platformatic/platformatic/issues/new)  
🏢 **Enterprise**: [PlatformaticHQ](https://www.platformatichq.com)

---

## Enterprise Solutions

Platformatic provides enterprise support and architectural guidance for teams looking to use Watt for mission critical applications. Get in touch at sales@platformatic.dev.
