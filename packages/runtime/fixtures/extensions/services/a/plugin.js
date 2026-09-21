import { getITC, getSharedContext } from '@platformatic/globals'

export default async function (fastify) {
  const itc = getITC()
  const pings = []

  itc.on('extension:ping', payload => {
    pings.push(payload)
  })

  fastify.get('/context', async () => {
    return itc.send('extension:context', {})
  })

  fastify.get('/sum', async request => {
    const { x, y } = request.query
    const result = await itc.send('extension:sum', { x: Number(x), y: Number(y) })
    return { result }
  })

  fastify.get('/ts', async () => {
    return itc.send('extension:ts', {})
  })

  fastify.get('/pings', async () => {
    return pings
  })

  fastify.get('/shared-context', async () => {
    return getSharedContext().get()
  })
}
