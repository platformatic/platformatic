import { defineEventHandler, getHeader, readBody } from 'nitro/h3'
import { env } from 'node:process'

export default defineEventHandler(async event => {
  return {
    body: await readBody(event),
    environment: Object.fromEntries([
      'HOST',
      'NITRO_HOST',
      'PORT',
      'NITRO_PORT',
      'NITRO_SHUTDOWN_DISABLED',
      'NITRO_SHUTDOWN_FORCE',
      'NITRO_SHUTDOWN_NO_FORCE_EXIT'
    ].map(key => [key, env[key]])),
    header: getHeader(event, 'x-inspect')
  }
})
