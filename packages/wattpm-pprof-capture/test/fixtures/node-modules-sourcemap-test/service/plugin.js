// Simple plugin that can trigger CPU-intensive work
// The test uses this to generate profiles while testing nodeModulesSourceMaps option

export default async function (app) {
  app.get('/', async () => {
    return { message: 'Hello from Node Modules Sourcemap Test' }
  })

  app.get('/compute', async () => {
    // Do some CPU-intensive work to generate profiling samples
    let result = 0
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i)
    }
    return { result }
  })
}
