import { getLogger } from '@platformatic/globals'
const version = 123

const logger = getLogger()
logger.info('Log from vite client')

export async function generate () {
  return `<div>Hello from v${version} t${Date.now()}</div>`
}
