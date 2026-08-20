export default async function (app) {
  app.get('/boom', async () => {
    throw new Error('relation "public.users" does not exist')
  })

  app.get('/not-found', async () => {
    const error = new Error('nope')
    error.statusCode = 404
    throw error
  })

  app.register(async scoped => {
    scoped.setErrorHandler((error, request, reply) => {
      reply.status(error.statusCode ?? 500).send({ envelope: 'scoped' })
    })

    scoped.get('/scoped/boom', async () => {
      throw new Error('boom')
    })
  })
}
