import { FastifyInstance } from 'fastify'

console.error('[CI-LOG-PLUGIN] TypeScript plugin module loading...')

// A function with a distinctive name that we can find in the profile
async function myTypeScriptFunction(value: number): Promise<number> {
  console.error('[CI-LOG-PLUGIN] myTypeScriptFunction called with value:', value)
  let result = 0
  let i = 0
  const totalIterations = 1000000 // Reduced to complete faster

  // Do CPU work in chunks to allow I/O processing
  // 80ms of work, then 20ms pause to allow event loop to process
  while (i < totalIterations) {
    const chunkStart = Date.now()
    // Work for approximately 80ms
    while (Date.now() - chunkStart < 80 && i < totalIterations) {
      result += Math.sqrt(i * value)
      i++
    }
    // Allow event loop to process I/O
    if (i < totalIterations) {
      await new Promise(resolve => setTimeout(resolve, 20))
    }
  }

  return result
}

export default async function (app: FastifyInstance) {
  console.error('[CI-LOG-PLUGIN] Plugin export function called, registering routes...')

  app.get('/', async () => {
    console.error('[CI-LOG-PLUGIN] GET / called')
    return { message: 'Hello from TypeScript' }
  })

  app.get('/compute', async () => {
    console.error('[CI-LOG-PLUGIN] GET /compute called')
    const result = await myTypeScriptFunction(42)
    console.error('[CI-LOG-PLUGIN] GET /compute returning result:', result)
    return { result }
  })

  app.get('/diagnostic', async () => {
    console.error('[CI-LOG-PLUGIN] GET /diagnostic called')
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

    console.error('[CI-LOG-PLUGIN] GET /diagnostic returning:', JSON.stringify(diagnostics))
    return diagnostics
  })

  console.error('[CI-LOG-PLUGIN] All routes registered successfully')
}
