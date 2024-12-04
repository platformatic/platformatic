import { createServer } from 'node:http'

const {
  FROM_ENV_FILE,
  FROM_MAIN_CONFIG_FILE,
  FROM_SERVICE_CONFIG_FILE
} = process.env

export function build () {
  return createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/json'
    })
    res.end(JSON.stringify({
      FROM_ENV_FILE,
      FROM_MAIN_CONFIG_FILE,
      FROM_SERVICE_CONFIG_FILE
    }))
  })
}
