export default async function setup ({ metrics }) {
  const { client, registry } = metrics
  // Collides with a runtime process-level metric family
  const gauge = new client.Gauge({
    name: 'process_resident_memory_bytes',
    help: 'Colliding with process metrics',
    registers: [registry]
  })
  gauge.set(1)

  return {
    close () {}
  }
}
