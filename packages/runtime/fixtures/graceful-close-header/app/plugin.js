export default async function (app) {
  app.get('/slow', async (request, reply) => {
    // Simulate slow response to give time for testing
    await new Promise(resolve => setTimeout(resolve, 100))
    return { ok: true }
  })
}
