let stallInterval = null

function block (ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    // Busy loop to hard-block the event loop
  }
}

export default async function (fastify) {
  fastify.get('/', async () => {
    return { ok: true }
  })

  // Blocks the event loop for `block` ms every `period` ms: long individual
  // stalls at a moderate average utilization, invisible to ELU thresholds
  fastify.post('/stall/start', async request => {
    if (stallInterval) {
      return { started: false }
    }

    const blockMs = Number(request.query.block ?? 300)
    const periodMs = Number(request.query.period ?? 500)
    stallInterval = setInterval(() => block(blockMs), periodMs)

    return { started: true }
  })

  fastify.post('/stall/stop', async () => {
    if (stallInterval) {
      clearInterval(stallInterval)
      stallInterval = null
    }

    return { stopped: true }
  })
}
