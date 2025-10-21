import { FastifyInstance } from 'fastify'

// A function with a distinctive name that we can find in the profile
// This function allocates significant memory to ensure heap profiler captures samples
async function myTypeScriptFunction(value: number): Promise<number> {
  let result = 0
  const allocations: Array<{ data: number[], metadata: object }> = []

  // Allocate memory in chunks larger than heap profiler sampling interval (512KB)
  // Each iteration allocates ~1MB to ensure we trigger heap profiler sampling
  for (let i = 0; i < 10; i++) {
    // Allocate a large array (~800KB of numbers)
    const largeArray = new Array(100000)
    for (let j = 0; j < largeArray.length; j++) {
      largeArray[j] = Math.sqrt(j * value)
      result += largeArray[j]
    }

    // Allocate objects with metadata
    const metadata = {
      index: i,
      timestamp: Date.now(),
      value,
      description: 'Memory allocation for heap profiling test'.repeat(10)
    }

    allocations.push({ data: largeArray, metadata })

    // Small delay to allow heap profiler to sample
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  // Keep allocations alive until we're done computing
  return result + allocations.length
}

export default async function (app: FastifyInstance) {
  app.get('/', async () => {
    return { message: 'Hello from TypeScript' }
  })

  app.get('/compute', async () => {
    const result = await myTypeScriptFunction(42)
    return { result }
  })

  app.get('/diagnostic', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const url = await import('node:url')
    const serviceDir = path.dirname(url.fileURLToPath(import.meta.url))
    const pluginJsPath = path.join(serviceDir, 'plugin.js')
    const pluginMapPath = path.join(serviceDir, 'plugin.js.map')

    const diagnostics = {
      serviceDir,
      pluginJsExists: false,
      pluginMapExists: false
    }

    try {
      await fs.access(pluginJsPath)
      diagnostics.pluginJsExists = true
    } catch {}

    try {
      await fs.access(pluginMapPath)
      diagnostics.pluginMapExists = true
    } catch {}

    return diagnostics
  })
}
