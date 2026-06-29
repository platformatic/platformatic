export default async function (fastify) {
  fastify.get('/custom-pino-keys', async () => {
    console.log(JSON.stringify({
      severity: 30,
      timestamp: Date.now(),
      message: 'custom pino keys'
    }))

    return 'ok'
  })
}
