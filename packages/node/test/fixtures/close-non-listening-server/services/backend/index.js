import { getLogger } from '@platformatic/globals'
import { createServer } from 'node:http'

export function create () {
  const logger = getLogger()

  return createServer((_, res) => {
    logger.debug('Serving request.')
    res.end('ok')
  })
}
