export default async function setup ({ metrics }) {
  const events = (globalThis.__pltExtensionEvents ??= [])
  events.push({ event: 'setup', extension: 'metrics-1' })

  const { client, registry } = metrics
  const gauge = new client.Gauge({
    name: 'extension_jobs_total',
    help: 'Jobs tracked by the first metrics extension',
    registers: [registry]
  })
  gauge.set(7)

  // Expose registry so tests can assert cleanup after close
  globalThis.__pltExtensionMetricsRegistries ??= []
  globalThis.__pltExtensionMetricsRegistries.push({ name: 'metrics-1', registry })

  return {
    close () {
      events.push({ event: 'close', extension: 'metrics-1' })
    }
  }
}
