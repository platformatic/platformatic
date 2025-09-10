# Platformatic RPC CLI

Fastify CLI command to generate a server RPC api for a Fastify application.

> [!WARNING]  
> Platformatic RPC API is in the experimental stage. The feature is not subject to semantic versioning rules.
> Non-backward compatible changes or removal may occur in any future release.
> Use of the feature is not recommended in production environments.

## Installation

```bash
npm install @platformatic/rpc-cli
npm install --save-dev @platformatic/rpc-cli
```

## Usage

1. Register an RPC plugin in your Fastify typescript application.
See the [Platformatic RPC](https://github.com/platformatic/platformatic/tree/v2.x/packages/rpc#usage) documentation for more information.

3. Run the CLI command to generate the OpenAPI schema.

```bash
npx plt-rpc --ts-config ./tsconfig.json --path ./openapi.json
```

4. Start the Fastify application.

Your RPC handlers are exposed as http routes under the `/rpc` prefix. All RPC routes are POST routes.

```bash
curl -X POST http://localhost:3042/rpc/getUsers -H 'Content-Type: application/json' -d '{"maxAge": 30}'
```
