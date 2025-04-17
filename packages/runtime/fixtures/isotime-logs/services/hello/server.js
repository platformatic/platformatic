import { createServer } from 'node:http'

const {
  FROM_ENV_FILE,
  FROM_MAIN_CONFIG_FILE,
  FROM_SERVICE_CONFIG_FILE,
  OVERRIDE_TEST
} = process.env

export function build () {
  return createServer((req, res) => {
    globalThis.platformatic.logger.info('Request received')
    res.writeHead(200, {
      'Content-Type': 'application/json'
    })
    res.end(JSON.stringify({
      FROM_ENV_FILE,
      FROM_MAIN_CONFIG_FILE,
      FROM_SERVICE_CONFIG_FILE,
      OVERRIDE_TEST
    }))
  })
}
