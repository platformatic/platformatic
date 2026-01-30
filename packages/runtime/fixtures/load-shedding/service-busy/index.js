import atomicSleep from 'atomic-sleep'

export default async function (app) {
  app.get('/health', async () => {
    return { status: 'ok' }
  })

  // Endpoint that blocks the event loop for specified duration
  app.get('/block/:ms', async (request) => {
    const ms = parseInt(request.params.ms, 10)
    atomicSleep(ms)
    return { blocked: ms }
  })

  // Endpoint that continuously blocks to keep ELU high
  app.get('/busy', async () => {
    // Block for 50ms to spike ELU
    atomicSleep(50)
    return { status: 'busy' }
  })

  return app
}
