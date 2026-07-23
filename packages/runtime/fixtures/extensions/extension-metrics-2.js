export default async function setup ({ metrics }) {
  const events = (globalThis.__pltExtensionEvents ??= [])
  events.push({ event: 'setup', extension: 'metrics-2' })

  const { client, registry } = metrics
  const counter = new client.Counter({
    name: 'extension_events_total',
    help: 'Events tracked by the second metrics extension',
    registers: [registry]
  })
  counter.inc(3)

  globalThis.__pltExtensionMetricsRegistries ??= []
  globalThis.__pltExtensionMetricsRegistries.push({ name: 'metrics-2', registry })

  return {
    close () {
      events.push({ event: 'close', extension: 'metrics-2' })
    }
  }
}
