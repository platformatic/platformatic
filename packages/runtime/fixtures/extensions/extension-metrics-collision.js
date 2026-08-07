export default async function setup ({ metrics }) {
  const { client, registry } = metrics
  // Intentionally collides with extension-metrics-1.js
  const gauge = new client.Gauge({
    name: 'extension_jobs_total',
    help: 'Colliding metric family',
    registers: [registry]
  })
  gauge.set(1)

  return {
    close () {}
  }
}
