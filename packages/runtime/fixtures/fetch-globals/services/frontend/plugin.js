/** @param {import('fastify').FastifyInstance} app */
export default async function (app) {
  // Test fetch with string URL
  app.get('/fetch-string', async () => {
    const response = await fetch('http://backend.plt.local/data')
    const data = await response.json()
    return { method: 'string', ok: response.ok, data }
  })

  // Test fetch with Request object
  app.get('/fetch-request', async () => {
    const request = new Request('http://backend.plt.local/data')
    const response = await fetch(request)
    const data = await response.json()
    return { method: 'request', ok: response.ok, data }
  })

  // Test that Request and Response are the undici versions
  app.get('/check-globals', async () => {
    return {
      hasRequest: typeof globalThis.Request === 'function',
      hasResponse: typeof globalThis.Response === 'function',
      hasFetch: typeof globalThis.fetch === 'function'
    }
  })
}
