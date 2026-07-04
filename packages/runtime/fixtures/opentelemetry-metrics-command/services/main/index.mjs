import { getEvents } from '@platformatic/globals'
import { OpenTelemetryExporter } from '@platformatic/metrics'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import fastify from 'fastify'

const meterProvider = new MeterProvider({
  readers: [
    new PeriodicExportingMetricReader({
      exporter: new OpenTelemetryExporter(),
      exportIntervalMillis: 100
    })
  ]
})

const meter = meterProvider.getMeter('test-meter')
const counter = meter.createCounter('test_counter')
const app = fastify()

app.get('/', async () => {
  counter.add(1, { route: 'root' })
  return { ok: true }
})

getEvents().on('close', () => {
  app.close()
    .then(() => meterProvider.shutdown())
    .finally(() => process.exit(0))
})

await app.listen({ host: '127.0.0.1', port: 0 })
