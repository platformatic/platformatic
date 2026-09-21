import { OpenTelemetryExporter } from '@platformatic/metrics'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'

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

export default async function (app) {
  app.addHook('onClose', async () => {
    await meterProvider.shutdown()
  })

  app.get('/', async () => {
    counter.add(1, { route: 'root' })
    return { ok: true }
  })
}
