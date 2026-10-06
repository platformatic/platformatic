# Trace multiple Watt applications and workers with Datadog

Watt runs applications in isolated worker threads. Each worker needs its own
Datadog tracer, initialized **before** instrumented modules load. Configuring
only Watt's main process is not sufficient.

This setup was verified with Node.js **26.9.0**, Watt **3.69.0**, and `dd-trace`
**6.16.0**. You need a Datadog account and an Agent with APM enabled.

## Create a Watt project

For a new project, use the interactive initializer:

```sh
mkdir watt-datadog
cd watt-datadog
npx wattpm@3.69.0 init --package-manager npm
```

Create three Platformatic Service applications named `frontend`, `orders`, and
`inventory`. For an existing project, use your existing applications instead.
Install the tracer at the project root:

```sh
npm install --save-exact dd-trace@6.16.0
```

## Configure the Agent

Each application worker sends traces to a Datadog Agent. The Agent forwards them
over HTTPS to Datadog's cloud intake, using `DD_API_KEY` to authenticate and
`DD_SITE` to select your Datadog region (for example, `datadoghq.com` or
`datadoghq.eu`). The API key belongs to the Agent, not the application's environment.

### Cloud deployments

Deploy an Agent with APM enabled alongside your workload, or use an existing
reachable Agent. Follow [Datadog's Agent setup instructions](https://docs.datadoghq.com/agent/)
for your infrastructure: a host Agent for a VM, a node Agent for Kubernetes, or
an Agent sidecar for a container deployment such as ECS Fargate.

Configure the Agent with your API key and site, and allow it outbound HTTPS access
to Datadog. When applications connect from another container or host, configure
the Agent to accept non-local APM traffic (`DD_APM_NON_LOCAL_TRAFFIC=true`) and
make its APM port reachable from the applications on the private network.

Set `DD_TRACE_AGENT_URL` in the Watt deployment's environment to the Agent's APM
endpoint, for example `http://datadog-agent:8126`, replacing `datadog-agent` with
the reachable Agent hostname or IP address. Use `127.0.0.1` only when Watt and the
Agent share a host or network namespace. This URL points to the Agent, not to
the Datadog website or cloud intake.

### Optional local Agent

To try the guide locally, create `.env.agent` with your Datadog API key and site:

```dotenv title=".env.agent"
DD_API_KEY=replace-with-your-api-key
DD_SITE=datadoghq.com
```

Keep this file out of version control. Start a local Agent with Docker:

```sh
docker run -d --name watt-datadog-agent \
  --env-file .env.agent \
  -e DD_HOSTNAME=watt-datadog-local \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -p 127.0.0.1:8126:8126 \
  gcr.io/datadoghq/agent:7
```

The application runs on the host; the Agent accepts Docker-forwarded APM traffic
and forwards traces to your Datadog account. Even with this local setup, you view
the traces in Datadog's cloud UI.

### Application environment

For the local setup, add these settings to the project's root `.env`. In a cloud
deployment, provide them through your deployment's environment configuration,
using the Agent URL described above:

```dotenv
DD_TRACE_AGENT_URL=http://127.0.0.1:8126
DD_ENV=local
DD_VERSION=1.0.0
```

Set `DD_ENV` and `DD_VERSION` to your deployment environment and release version;
the values above are examples for local verification. You can temporarily set
`DD_TRACE_SAMPLE_RATE=1` to sample every trace while verifying the integration;
use your normal sampling policy in production.

Tracing does not require disabling profiling or runtime metrics. Configure those
features independently according to your deployment's needs; see Datadog's
[Node.js profiler setup](https://docs.datadoghq.com/profiler/enabling/nodejs/) and
[Node.js runtime metrics configuration](https://docs.datadoghq.com/tracing/metrics/runtime_metrics/nodejs/).

## Initialize Datadog in every application worker

Create `datadog.mjs` at the project root:

```javascript title="datadog.mjs"
import { isMainThread, threadId, workerData } from 'node:worker_threads'

// Child workers inherit execArgv. Skip auxiliary workers without Watt configuration.
if (!isMainThread && workerData?.applicationConfig?.id) {
  const { default: tracer } = await import('dd-trace')
  tracer.init({
    service: `watt-${workerData.applicationConfig.id}`,
    logInjection: true,
    tags: {
      'application.id': workerData.applicationConfig.id,
      'worker.index': workerData.worker.index,
      'worker.thread_id': threadId
    }
  })
}
```

Replicas share a service name, such as `watt-orders`; worker identity is recorded
in span tags. The `.mjs` extension works regardless of the project's module type.

Merge the following into the generated `watt.json`, preserving its other settings.
Adjust paths to match your project:

```json
{
  "entrypoint": "frontend",
  "applications": [
    {
      "id": "frontend",
      "path": "./web/frontend",
      "workers": 1,
      "execArgv": ["--import", "dd-trace/register.js", "--import", "./datadog.mjs"]
    },
    {
      "id": "orders",
      "path": "./web/orders",
      "workers": 2,
      "execArgv": ["--import", "dd-trace/register.js", "--import", "./datadog.mjs"]
    },
    {
      "id": "inventory",
      "path": "./web/inventory",
      "workers": 2,
      "execArgv": ["--import", "dd-trace/register.js", "--import", "./datadog.mjs"]
    }
  ]
}
```

The first import registers Datadog's ESM hooks; the second initializes the tracer.
Use `execArgv` on every application rather than the later `preload` stage.
See [Datadog's Node.js instrumentation documentation](https://docs.datadoghq.com/tracing/trace_collection/automatic_instrumentation/dd_libraries/nodejs/)
for initialization requirements.

:::important Environment configuration
Application-specific `.env` files and `applications[].env` are applied after these
startup imports. Load shared tracer settings before starting Watt; set each
application's service name in the initializer.
:::

For the local setup, start from the project root, loading `.env` before Watt:

```sh
node --env-file=.env node_modules/wattpm/bin/cli.js start
```

In a cloud deployment that already supplies the environment variables, omit
`--env-file=.env`.

Use `start`, not `dev`: development mode forces one worker per application.
This configuration runs five application workers, plus any internal threads.

## Verify in Datadog

Generate concurrent traffic against your application's routes. To verify
cross-application tracing, exercise a route that calls another application through
the mesh, such as `http://orders.plt.local`. The initializer scaffolds applications;
it does not create those business calls. No `useHttp` override or manual tracing
header propagation is needed for the verified Platformatic Service setup.

In **APM → Trace Explorer**, use **Live Search** while generating traffic, or
select a recent time window. Search for:

```text
env:local service:watt-frontend
```

Replace `local` with the `DD_ENV` value used by your deployment.

Check the following:

| Check | Expected result |
| --- | --- |
| Service names | `watt-frontend`, `watt-orders`, and `watt-inventory`, when each receives traffic. |
| Trace continuity | A request crossing applications forms one connected trace, with correct parent/child relationships. |
| Replicas | Across requests, `worker.index` is `0` for frontend and `0` or `1` for each internal application. |
| Latency and errors | Slow downstream operations appear in span duration; failed requests carry the expected status and error details. |
| Replacement workers | After an application restart, thread IDs change but service names and trace continuity remain stable. |

Restart inventory using the project's package name or runtime PID:

```sh
npx wattpm restart <package-name-or-pid> inventory
```

For automated regression tests, capture the real tracer's exports with a local
test intake. Decode MessagePack payloads without losing 64-bit IDs, aggregate
spans from all workers, and poll for complete traces with a bounded timeout.
Assert connected parent chains, isolated concurrent requests, replica coverage,
errors, latency, and tracing after restart. Successful HTTP responses alone do
not prove tracing works; separately verify Agent forwarding and Datadog ingestion.

## Troubleshooting

- **No traces:** check the Agent's status and APM section (for the local Docker
  example, run `docker exec watt-datadog-agent agent status`). Check connectivity
  from Watt to the Agent, the Agent's outbound connectivity to Datadog, its API
  key/site, and the environment filter and time window in Datadog.
- **Missing or disconnected spans:** check the startup imports on every
  application and that the tracer loads before instrumented modules. Temporarily
  set `DD_TRACE_DEBUG=true` in the root `.env` or deployment environment and restart.
- **Only one replica per application:** use production mode with `wattpm start`.
- **No logs in Datadog:** `logInjection` enriches application logs with correlation
  fields; shipping those logs requires separate log collection configuration.

This guide uses native `dd-trace`, without Watt's built-in OpenTelemetry tracing.
Combining tracing SDKs requires separate configuration and verification.

To remove the local Agent when finished:

```sh
docker rm -f watt-datadog-agent
```
