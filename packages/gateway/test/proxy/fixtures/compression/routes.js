export default async function (app) {
  app.get('/page', async (req, reply) => {
    reply.type('text/html')
    reply.header('x-received-accept-encoding', req.headers['accept-encoding'] ?? '')
    return '<p>hello world</p>'.repeat(1000)
  })
}
