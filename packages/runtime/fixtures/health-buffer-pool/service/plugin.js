import { Buffer } from 'node:buffer'
import { getDefaultHighWaterMark } from 'node:stream'

export default async function (app) {
  app.get('/', async () => {
    return {
      bufferPoolSize: Buffer.poolSize,
      defaultHighWaterMark: getDefaultHighWaterMark(false)
    }
  })
}
