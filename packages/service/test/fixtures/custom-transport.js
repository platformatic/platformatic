import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import build from 'pino-abstract-transport'

export default function (opts) {
  const dest = opts.path || join(process.cwd(), 'transport.log')
  return build(function (source) {
    source.on('data', function (obj) {
      obj.fromTransport = true
      appendFileSync(dest, JSON.stringify(obj) + '\n')
    })
  })
}
